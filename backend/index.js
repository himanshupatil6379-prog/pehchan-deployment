/**
 * Pehchan – Express server (replaces Django's WSGI app).
 *   /api/*    JSON API (docs/API.md, docs/ADMIN_API.md)
 *   /media/*  uploaded files (MEDIA_ROOT)
 *   /*        React single-page app (frontend/dist)
 */
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import compression from 'compression';
import config from './config.js';
import { sequelize } from './models/index.js';
import { runSetup } from './setup.js';
import { registerSignals } from './services/signals.js';
import { sessionMiddleware, initSessionMiddleware, loadUser, csrfGuard } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import siteRoutes from './routes/site.js';
import adminRoutes from './routes/admin.js';

registerSignals();

// Becomes true once backend/setup.js has checked the database (tables, admin, secret key).
const state = { ready: false, error: null, startedAt: new Date() };

const app = express();
app.disable('x-powered-by');
if (config.TRUST_PROXY) app.set('trust proxy', 1);

// SecurityMiddleware + XFrameOptionsMiddleware equivalents
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // SAMEORIGIN: the admin "related object" popups open in a same-origin iframe
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', config.DEBUG ? 'same-origin' : 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (config.SECURE_SSL_REDIRECT && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  return next();
});
app.use(compression());

// favicon.ico -> /static/images/favicon.ico (RedirectView, permanent)
app.get('/favicon.ico', (req, res) => res.redirect(301, '/static/images/favicon.ico'));

// Uploaded media
app.use(config.MEDIA_URL, express.static(config.MEDIA_ROOT, { fallthrough: false, maxAge: '7d' }));

// API
const api = express.Router();

// Health check (works before the database is ready) – useful for Hostinger monitoring.
api.get('/health/', (req, res) => {
  res.status(state.ready ? 200 : 503).json({
    ok: state.ready,
    database: state.ready ? 'ready' : 'unavailable',
    ...(state.error && !state.ready ? { error: state.error } : {}),
    uptime_seconds: Math.round(process.uptime()),
  });
});

// Until the setup has finished every other API call answers 503 instead of crashing.
api.use((req, res, next) => {
  if (state.ready) return next();
  res.setHeader('Retry-After', '10');
  return res.status(503).json({
    ok: false,
    starting: true,
    messages: [{ level: 'error', text: 'The site is starting up or the database is unavailable. Please try again in a moment.' }],
  });
});
api.use(express.json({ limit: '2mb' }));
api.use(express.urlencoded({ extended: true, limit: '2mb' }));
api.use(sessionMiddleware);
api.use(loadUser);
api.use(csrfGuard);
api.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
api.use('/auth', authRoutes);
api.use('/admin', adminRoutes);
api.use('/', siteRoutes);
api.use((req, res) => res.status(404).json({ ok: false, not_found: true }));
// eslint-disable-next-line no-unused-vars
api.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ ok: false, messages: [{ level: 'error', text: 'Uploaded file is too large.' }] });
  }
  console.error(err);
  return res.status(500).json({ ok: false, server_error: true, ...(config.DEBUG ? { detail: String(err && err.stack) } : {}) });
});
app.use('/api', api);

// React build (static files + SPA fallback)
const distDir = path.join(config.BASE_DIR, 'frontend', 'dist');
const indexHtml = path.join(distDir, 'index.html');
app.use(
  express.static(distDir, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  })
);
app.get('*', (req, res) => {
  if (req.path.startsWith('/static/') || req.path.startsWith('/assets/')) return res.status(404).send('Not Found');
  if (!fs.existsSync(indexHtml)) {
    return res
      .status(503)
      .send('Frontend build not found. Run "npm run build" (production) or use "npm run dev" and open http://localhost:5173 (development).');
  }
  res.setHeader('Cache-Control', 'no-cache');
  return res.sendFile(indexHtml);
});

const server = app.listen(config.PORT, () => {
  console.log(`Pehchan server running on port ${config.PORT} (${config.DEBUG ? 'development' : 'production'})`);
});

/**
 * Database setup with retries: the web server stays up (no crash loop on Hostinger) and keeps
 * retrying until MySQL is reachable – e.g. wrong credentials can be fixed in hPanel and the app recovers.
 */
async function setupWithRetry(attempt = 1) {
  try {
    await runSetup();
    initSessionMiddleware();
    state.ready = true;
    state.error = null;
    console.log('[setup] Ready.');
  } catch (err) {
    state.error = err.message;
    const delay = Math.min(60, 5 * attempt);
    console.error(`[setup] Database setup failed (attempt ${attempt}): ${err.message}`);
    console.error(`[setup] Check DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD. Retrying in ${delay}s…`);
    setTimeout(() => setupWithRetry(attempt + 1), delay * 1000).unref();
  }
}
setupWithRetry();

// Keep the process alive on unexpected async errors and log them.
process.on('unhandledRejection', (reason) => console.error('Unhandled promise rejection:', reason));

// Graceful shutdown (Hostinger restarts the app on every deploy).
function shutdown(signal) {
  console.log(`${signal} received – shutting down…`);
  server.close(() => {
    sequelize.close().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
