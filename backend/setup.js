/**
 * Automatic database setup – runs on every start (i.e. every Hostinger deploy/restart).
 *
 *   1. Creates the MySQL database if the account is allowed to (local development).
 *   2. Checks which tables already exist:
 *        - all present  -> nothing is created, nothing is touched;
 *        - some missing -> only the missing tables are created (existing data is never dropped).
 *   3. First deploy only: creates the superuser from ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD
 *      when the database has no superuser yet (later deploys skip this).
 *   4. Makes sure a SECRET_KEY exists (env var, or one generated once and stored in app_settings).
 *
 * A MySQL named lock prevents two app instances from running the setup at the same time.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import config from './config.js';
import { sequelize, User, AppSetting } from './models/index.js';
import { sessionStore } from './middleware/auth.js';
import { ensureDatabase } from './scripts/ensure-database.js';
import { makePassword } from './utils/passwords.js';

const LOCK_NAME = 'pehchan_setup';

async function withLock(fn) {
  const [[row]] = await sequelize.query(`SELECT GET_LOCK('${LOCK_NAME}', 60) AS locked`);
  if (!row || Number(row.locked) !== 1) throw new Error('Could not obtain the setup lock (another instance is running the setup).');
  try {
    return await fn();
  } finally {
    await sequelize.query(`SELECT RELEASE_LOCK('${LOCK_NAME}')`).catch(() => {});
  }
}

function tableNameOf(entry) {
  if (typeof entry === 'string') return entry;
  return entry.tableName || entry.TABLE_NAME || Object.values(entry)[0];
}

/** Models in an order where every table comes after the tables it references. */
function modelsInDependencyOrder() {
  const models = [];
  sequelize.modelManager.forEachModel((model) => models.push(model));
  return models;
}

/** Create the tables that do not exist yet. Returns { existing, created }. */
export async function ensureTables({ alter = config.DB.syncAlter, log = console.log } = {}) {
  // make sure the session store model is registered before listing models
  void sessionStore;
  const qi = sequelize.getQueryInterface();
  const existing = new Set((await qi.showAllTables()).map((t) => String(tableNameOf(t)).toLowerCase()));
  const models = modelsInDependencyOrder();
  const missing = models.filter((m) => !existing.has(String(m.getTableName()).toLowerCase()));

  if (!missing.length) {
    log(`[setup] Database check: all ${models.length} tables already exist – nothing to create.`);
  } else {
    log(`[setup] Database check: ${models.length - missing.length}/${models.length} tables exist, creating ${missing.length} missing table(s)…`);
    for (const model of missing) {
      // eslint-disable-next-line no-await-in-loop
      await model.sync();
      log(`[setup]   created table ${model.getTableName()}`);
    }
  }

  if (alter) {
    log('[setup] DB_SYNC_ALTER=True – adding new columns/indexes to existing tables…');
    await sequelize.sync({ alter: true });
    log('[setup]   tables altered. Set DB_SYNC_ALTER back to False.');
  }
  return { existing: models.length - missing.length, created: missing.map((m) => m.getTableName()) };
}

/** First deploy: create the superuser if the database has none. */
export async function ensureSuperuser({ log = console.log } = {}) {
  const superusers = await User.count({ where: { is_superuser: true } });
  if (superusers > 0) {
    log(`[setup] Admin check: ${superusers} superuser(s) already exist – skipping admin creation.`);
    return { created: false };
  }
  const username = config.ADMIN_USERNAME;
  const existing = await User.findOne({ where: { username } });
  if (existing && existing.username === username) {
    log(`[setup] Admin check: user "${username}" exists but is not a superuser – not changing it. Run "npm run create-admin" to promote it.`);
    return { created: false };
  }

  let password = config.ADMIN_PASSWORD;
  const generated = !password;
  if (generated) password = crypto.randomBytes(12).toString('base64url');

  await User.create({
    username,
    email: config.ADMIN_EMAIL,
    password: await makePassword(password),
    is_staff: true,
    is_superuser: true,
    is_active: true,
    date_joined: new Date(),
  });
  log(`[setup] Admin check: created superuser "${username}" (${config.ADMIN_EMAIL}).`);
  if (generated) {
    log('[setup] ------------------------------------------------------------------');
    log('[setup] ADMIN_PASSWORD was not set, so a one-time password was generated:');
    log(`[setup]     username: ${username}`);
    log(`[setup]     password: ${password}`);
    log('[setup] Log in at /admin/ and change it (Change password), or set ADMIN_PASSWORD');
    log('[setup] before the first deploy. This message is shown only once.');
    log('[setup] ------------------------------------------------------------------');
  }
  return { created: true, generatedPassword: generated };
}

/** SECRET_KEY from the environment, or generated once and kept in app_settings. */
export async function ensureSecretKey({ log = console.log } = {}) {
  if (config.SECRET_KEY) return 'env';
  await AppSetting.sync(); // CREATE TABLE IF NOT EXISTS – needed even when DB_AUTO_SYNC=False
  let row = await AppSetting.findByPk('secret_key');
  if (!row) {
    row = await AppSetting.create({ key: 'secret_key', value: crypto.randomBytes(48).toString('hex') });
    log('[setup] SECRET_KEY is not set – generated a permanent one and stored it in the database (app_settings).');
  }
  config.SECRET_KEY = row.value;
  return 'database';
}

function ensureMediaRoot(log) {
  try {
    fs.mkdirSync(config.MEDIA_ROOT, { recursive: true });
    fs.accessSync(config.MEDIA_ROOT, fs.constants.W_OK);
    log(`[setup] Uploads folder: ${config.MEDIA_ROOT}`);
  } catch (err) {
    log(`[setup] WARNING: uploads folder ${config.MEDIA_ROOT} is not writable (${err.message}). Set MEDIA_ROOT.`);
  }
}

/** Full setup used by the server on start and by `npm run setup`. */
export async function runSetup({ log = console.log, createAdmin = config.AUTO_CREATE_ADMIN, syncTables = config.DB.autoSync } = {}) {
  await ensureDatabase();
  await sequelize.authenticate();
  log(`[setup] Connected to MySQL database "${config.DB.name}" at ${config.DB.host}:${config.DB.port}`);
  const result = await withLock(async () => {
    const tables = syncTables ? await ensureTables({ log }) : (log('[setup] DB_AUTO_SYNC=False – skipping the table check.'), null);
    const admin = createAdmin ? await ensureSuperuser({ log }) : null;
    const secret = await ensureSecretKey({ log });
    return { tables, admin, secret };
  });
  ensureMediaRoot(log);
  return result;
}
