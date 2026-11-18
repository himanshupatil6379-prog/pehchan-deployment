/**
 * Table check (equivalent of `python manage.py migrate`) – the same check the server runs on start.
 *   npm run db:sync            -> create only the tables that do not exist yet
 *   npm run db:sync -- --alter -> also add new columns/indexes to existing tables
 */
import { sequelize } from '../models/index.js';
import { ensureDatabase } from './ensure-database.js';
import { ensureTables } from '../setup.js';

const alter = process.argv.includes('--alter');

try {
  await ensureDatabase();
  await sequelize.authenticate();
  await ensureTables({ alter });
  await sequelize.close();
  process.exit(0);
} catch (err) {
  console.error('db:sync failed:', err.message);
  process.exit(1);
}
