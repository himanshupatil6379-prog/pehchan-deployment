/**
 * Settings – equivalent of pehchan_webapp/settings.py.
 * Every value comes from environment variables (.env in development,
 * Hostinger "Environment variables" panel in production).
 */
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const BASE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(BASE_DIR, '.env') });

const env = process.env;
const bool = (v, def = false) => (v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

export const DEBUG = bool(env.DEBUG, false);

// In production a missing SECRET_KEY no longer crashes the app: backend/setup.js generates one
// on the first start and keeps it in the database (table app_settings), so sessions survive redeploys.
let secretKey = env.SECRET_KEY || '';
if (!secretKey && DEBUG) secretKey = 'pehchan-insecure-dev-secret-key-change-me';

/**
 * Uploaded files must live OUTSIDE the deployed app folder on Hostinger, otherwise every
 * redeploy wipes them. Default: <app>/media in development, ~/pehchan_media in production.
 */
function defaultMediaRoot() {
  if (DEBUG) return path.join(BASE_DIR, 'media');
  try {
    return path.join(os.homedir(), 'pehchan_media');
  } catch {
    return path.join(BASE_DIR, 'media');
  }
}

const config = {
  BASE_DIR,
  DEBUG,
  NODE_ENV: env.NODE_ENV || (DEBUG ? 'development' : 'production'),
  PORT: Number(env.PORT || 8000),
  SECRET_KEY: secretKey,

  // Database (MySQL on Hostinger: host 127.0.0.1, port 3306)
  DB: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    name: env.DB_NAME || 'pehchan',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    logging: bool(env.DB_LOGGING, false),
    // On every start: create the tables that do not exist yet (existing tables and data are never touched)
    autoSync: bool(env.DB_AUTO_SYNC, true),
    // Also add new columns/indexes to existing tables (use once after an upgrade that changes the models)
    syncAlter: bool(env.DB_SYNC_ALTER, false),
  },

  // First start: create the superuser when the database has none (ADMIN_* variables)
  AUTO_CREATE_ADMIN: bool(env.AUTO_CREATE_ADMIN, true),
  ADMIN_USERNAME: env.ADMIN_USERNAME || 'admin',
  ADMIN_EMAIL: env.ADMIN_EMAIL || 'admin@pehchanyui.in',
  ADMIN_PASSWORD: env.ADMIN_PASSWORD || '',

  TIME_ZONE: 'Asia/Kolkata',

  // Media files (uploads)
  MEDIA_URL: '/media/',
  MEDIA_ROOT: path.resolve(env.MEDIA_ROOT || defaultMediaRoot()),

  // Email
  EMAIL_HOST: env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: Number(env.EMAIL_PORT || 587),
  EMAIL_USE_TLS: bool(env.EMAIL_USE_TLS, true),
  EMAIL_USE_SSL: bool(env.EMAIL_USE_SSL, false),
  EMAIL_HOST_USER: env.EMAIL_HOST_USER || '',
  EMAIL_HOST_PASSWORD: env.EMAIL_HOST_PASSWORD || '',
  DEFAULT_FROM_EMAIL: env.DEFAULT_FROM_EMAIL || env.EMAIL_HOST_USER || 'webmaster@localhost',
  EMAIL_TIMEOUT: 10000,

  DONATION_UPI_ID: env.DONATION_UPI_ID || 'anikshaupadhyay2001@okicici',

  // Sessions (Django: SESSION_COOKIE_AGE = 30 days, HttpOnly, SameSite=Lax)
  SESSION_COOKIE_NAME: 'sessionid',
  SESSION_COOKIE_AGE_MS: 2592000 * 1000,
  SESSION_COOKIE_SECURE: bool(env.SESSION_COOKIE_SECURE, !DEBUG && bool(env.HTTPS, true)),
  TRUST_PROXY: bool(env.TRUST_PROXY, true),
  SECURE_SSL_REDIRECT: bool(env.SECURE_SSL_REDIRECT, false),

  // Password hashing (Django compatible pbkdf2_sha256)
  PASSWORD_ITERATIONS: Number(env.PASSWORD_ITERATIONS || 600000),
};

export default config;
