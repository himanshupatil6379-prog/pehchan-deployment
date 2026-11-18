/**
 * Django-compatible password hashing (django.contrib.auth.hashers.PBKDF2PasswordHasher).
 * Format: pbkdf2_sha256$<iterations>$<salt>$<base64 hash>
 * Existing users imported from the Django database keep working, and hashes
 * created here can be read by Django too.
 */
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.js';

const ALNUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function getRandomString(length = 22, chars = ALNUM) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function pbkdf2(password, salt, iterations, keylen = 32, digest = 'sha256') {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function makePassword(raw, iterations = config.PASSWORD_ITERATIONS) {
  const salt = getRandomString(22);
  const hash = (await pbkdf2(String(raw), salt, iterations)).toString('base64');
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

export function makeUnusablePassword() {
  return `!${getRandomString(40)}`;
}

export function hasUsablePassword(encoded) {
  return !!encoded && !encoded.startsWith('!');
}

export async function checkPassword(raw, encoded) {
  if (!encoded || !hasUsablePassword(encoded)) return false;
  const parts = encoded.split('$');
  if (parts[0] === 'pbkdf2_sha256' || parts[0] === 'pbkdf2_sha1') {
    const [algorithm, iterStr, salt, hash] = parts;
    const digest = algorithm === 'pbkdf2_sha1' ? 'sha1' : 'sha256';
    const keylen = digest === 'sha1' ? 20 : 32;
    const computed = (await pbkdf2(String(raw), salt, Number(iterStr), keylen, digest)).toString('base64');
    const a = Buffer.from(computed);
    const b = Buffer.from(hash || '');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return false;
}

/** Summary used by the admin "Password" read-only field. */
export function passwordSummary(encoded) {
  if (!encoded || !hasUsablePassword(encoded)) return null;
  const [algorithm, iterations, salt, hash] = encoded.split('$');
  const mask = (s, show = 6) => (s ? s.slice(0, show) + '*'.repeat(Math.max(0, s.length - show)) : '');
  return { algorithm, iterations, salt: mask(salt), hash: mask(hash) };
}

// ---------------------------------------------------------------------------
// AUTH_PASSWORD_VALIDATORS (settings.py)
// ---------------------------------------------------------------------------
let commonPasswords = null;
function getCommonPasswords() {
  if (!commonPasswords) {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'common-passwords.txt.gz');
    try {
      const text = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
      commonPasswords = new Set(text.split('\n').map((l) => l.trim()).filter(Boolean));
    } catch {
      commonPasswords = new Set();
    }
  }
  return commonPasswords;
}

function quickRatio(a, b) {
  // difflib.SequenceMatcher.quick_ratio
  const counts = new Map();
  for (const ch of b) counts.set(ch, (counts.get(ch) || 0) + 1);
  let matches = 0;
  const avail = new Map();
  for (const ch of a) {
    const num = avail.has(ch) ? avail.get(ch) : counts.get(ch) || 0;
    avail.set(ch, num - 1);
    if (num > 0) matches += 1;
  }
  const total = a.length + b.length;
  return total ? (2 * matches) / total : 1;
}

function exceedsMaximumLengthRatio(password, maxSimilarity, value) {
  const pwdLen = password.length;
  const lengthBoundSimilarity = (maxSimilarity / 2) * pwdLen;
  const valueLen = value.length;
  return pwdLen >= 10 * valueLen && valueLen < lengthBoundSimilarity;
}

const USER_ATTRIBUTES = [
  ['username', 'username'],
  ['first_name', 'first name'],
  ['last_name', 'last name'],
  ['email', 'email address'],
];

/**
 * django.contrib.auth.password_validation.validate_password
 * Returns an array of error messages (empty when valid).
 */
export function validatePassword(password, user = null) {
  const errors = [];
  const pwd = String(password ?? '');

  // UserAttributeSimilarityValidator
  if (user) {
    const lower = pwd.toLowerCase();
    outer: for (const [attr, verbose] of USER_ATTRIBUTES) {
      const value = user[attr];
      if (!value || typeof value !== 'string') continue;
      const valueLower = value.toLowerCase();
      const parts = [...valueLower.split(/[^\p{L}\p{N}_]+/u), valueLower];
      for (const part of parts) {
        if (exceedsMaximumLengthRatio(lower, 0.7, part)) continue;
        if (quickRatio(lower, part) >= 0.7) {
          errors.push(`The password is too similar to the ${verbose}.`);
          break outer;
        }
      }
    }
  }

  // MinimumLengthValidator (min_length = 8)
  if (pwd.length < 8) {
    errors.push('This password is too short. It must contain at least 8 characters.');
  }

  // CommonPasswordValidator
  if (getCommonPasswords().has(pwd.toLowerCase().trim())) {
    errors.push('This password is too common.');
  }

  // NumericPasswordValidator
  if (/^\d+$/.test(pwd)) {
    errors.push('This password is entirely numeric.');
  }

  return errors;
}

export const PASSWORD_HELP_TEXTS = [
  'Your password can’t be too similar to your other personal information.',
  'Your password must contain at least 8 characters.',
  'Your password can’t be a commonly used password.',
  'Your password can’t be entirely numeric.',
];
