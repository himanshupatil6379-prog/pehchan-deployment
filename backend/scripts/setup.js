/**
 * Runs the same automatic setup as the server start, then exits:
 * database check, missing tables, first superuser, secret key.
 *   npm run setup
 */
import { sequelize } from '../models/index.js';
import { runSetup } from '../setup.js';

try {
  await runSetup();
  console.log('[setup] Done.');
  await sequelize.close();
  process.exit(0);
} catch (err) {
  console.error('[setup] Failed:', err.message);
  process.exit(1);
}
