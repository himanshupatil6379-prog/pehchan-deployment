/**
 * Session authentication – django.contrib.sessions + django.contrib.auth equivalents.
 */
import crypto from 'node:crypto';
import session from 'express-session';
import connectSessionSequelize from 'connect-session-sequelize';
import config from '../config.js';
import sequelize from '../db.js';
import { User } from '../models/index.js';
import { checkPassword } from '../utils/passwords.js';

const SequelizeStore = connectSessionSequelize(session.Store);

export const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'django_session_store',
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: config.SESSION_COOKIE_AGE_MS,
});

let sessionHandler = null;

/**
 * Creates the session middleware once the SECRET_KEY is known
 * (from the environment, or generated and stored in the database by backend/setup.js).
 */
export function initSessionMiddleware() {
  if (!config.SECRET_KEY) throw new Error('SECRET_KEY is not available');
  sessionHandler = session({
    name: config.SESSION_COOKIE_NAME,
    secret: config.SECRET_KEY,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    proxy: config.TRUST_PROXY,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.SESSION_COOKIE_SECURE ? 'auto' : false,
      maxAge: config.SESSION_COOKIE_AGE_MS,
    },
  });
}

export function sessionMiddleware(req, res, next) {
  if (!sessionHandler) {
    return res.status(503).json({ ok: false, starting: true });
  }
  return sessionHandler(req, res, next);
}

/** get_session_auth_hash(): sessions die when the password changes */
function sessionAuthHash(user) {
  return crypto.createHmac('sha256', `${config.SECRET_KEY}:auth`).update(user.password || '').digest('hex');
}

/** django.contrib.auth.authenticate() (ModelBackend) */
export async function authenticate(username, password) {
  if (!username || password === undefined || password === null) return null;
  const user = await User.findOne({ where: { username } });
  // MySQL collation is case-insensitive – Django usernames are case-sensitive.
  if (!user || user.username !== username) {
    // Run the hasher once to reduce timing differences (Django does the same).
    await checkPassword(String(password), 'pbkdf2_sha256$1000$dummy$dummy');
    return null;
  }
  if (!(await checkPassword(String(password), user.password))) return null;
  if (!user.is_active) return null;
  return user;
}

/** django.contrib.auth.login() */
export function login(req, user) {
  return new Promise((resolve, reject) => {
    // Django cycles the session key and keeps its data, unless it belonged to another user.
    const keep = {};
    if (req.session && (!req.session.userId || req.session.userId === user.id)) {
      Object.keys(req.session).forEach((k) => {
        if (!['cookie', 'userId', 'authHash'].includes(k)) keep[k] = req.session[k];
      });
    }
    req.session.regenerate(async (err) => {
      if (err) return reject(err);
      Object.assign(req.session, keep);
      req.session.userId = user.id;
      req.session.authHash = sessionAuthHash(user);
      req.user = user;
      try {
        user.last_login = new Date();
        await user.save({ fields: ['last_login'] });
      } catch {
        /* ignore */
      }
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

/** django.contrib.auth.logout() – flushes the session */
export function logout(req) {
  return new Promise((resolve) => {
    req.user = null;
    if (!req.session) return resolve();
    req.session.regenerate(() => resolve());
  });
}

/** Refresh the auth hash after the user changes their own password (update_session_auth_hash). */
export function updateSessionAuthHash(req, user) {
  if (req.session && req.session.userId === user.id) req.session.authHash = sessionAuthHash(user);
}

/** AuthenticationMiddleware: populates req.user */
export async function loadUser(req, res, next) {
  req.user = null;
  try {
    const id = req.session && req.session.userId;
    if (id) {
      const user = await User.findByPk(id);
      if (user && user.is_active && req.session.authHash === sessionAuthHash(user)) {
        req.user = user;
      } else {
        delete req.session.userId;
        delete req.session.authHash;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** @login_required for API routes */
export function loginRequired(req, res, next) {
  if (req.user) return next();
  const next_ = req.get('X-Page-Path') || '/';
  return res.status(401).json({ ok: false, redirect: `/login/?next=${next_}` });
}

/** @staff_member_required */
export function staffRequired(req, res, next) {
  if (req.user && req.user.is_staff && req.user.is_active) return next();
  if (!req.user) return res.status(401).json({ ok: false, login_required: true });
  return res.status(403).json({ ok: false, permission_denied: true });
}

/**
 * CSRF protection for the JSON API: state-changing requests must carry
 * X-Requested-With (cannot be set cross-site without CORS) – on top of SameSite=Lax cookies.
 */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') === 'XMLHttpRequest') return next();
  return res.status(403).json({ ok: false, csrf_failed: true, messages: [{ level: 'error', text: 'CSRF verification failed. Request aborted.' }] });
}
