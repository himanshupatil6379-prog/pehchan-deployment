/**
 * Port of `python manage.py create_admin_user`.
 *   npm run create-admin -- --username admin --email admin@pehchanyui.in --password "secret"
 * Defaults come from ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD.
 */
import config from '../config.js';
import { sequelize, User } from '../models/index.js';
import { makePassword } from '../utils/passwords.js';
import { ensureDatabase } from './ensure-database.js';
import { ensureTables } from '../setup.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const username = arg('username', process.env.ADMIN_USERNAME || 'admin') || 'admin';
const email = arg('email', process.env.ADMIN_EMAIL || 'admin@pehchanyui.in') || 'admin@pehchanyui.in';
const password = arg('password', process.env.ADMIN_PASSWORD || 'admin') || 'admin';

const line = '='.repeat(60);
console.log(line);
console.log('Pehchan Admin User Setup');
console.log(line);

if (password === 'admin' && !config.DEBUG) {
  console.log('WARNING: Using default admin password in production!');
  console.log('Please set ADMIN_PASSWORD environment variable to a secure password.');
}

try {
  await ensureDatabase();
  await sequelize.authenticate();
  await ensureTables({ log: () => {} });
  const existing = await User.findOne({ where: { username } });
  if (existing && existing.username === username) {
    existing.password = await makePassword(password);
    existing.email = email;
    existing.is_staff = true;
    existing.is_superuser = true;
    await existing.save();
    console.log(`[*] Updated existing superuser "${username}"`);
  } else {
    await User.create({
      username,
      email,
      password: await makePassword(password),
      is_staff: true,
      is_superuser: true,
      is_active: true,
      date_joined: new Date(),
    });
    console.log(`[*] Created new superuser "${username}"`);
  }
  console.log(`  Email: ${email}`);
  console.log('  Login at: /admin/');
  console.log(line);
  console.log('[*] Admin setup completed successfully!');
  console.log(line);
  await sequelize.close();
  process.exit(0);
} catch (err) {
  console.log(`[ERROR] Failed to create superuser: ${err.message}`);
  process.exit(1);
}
