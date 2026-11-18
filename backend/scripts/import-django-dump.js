/**
 * Import data from the old Django site into MySQL (ids and password hashes are kept,
 * so every existing user can log in with the same password).
 *
 * 1. On the Django side:
 *      python manage.py dumpdata auth.user pehchan admin.logentry --natural-foreign --indent 2 -o pehchan-dump.json
 * 2. Here:
 *      npm run import:django -- pehchan-dump.json
 *
 * Existing rows with the same primary key are updated (safe to run twice).
 * Uploaded files (media/) must be copied separately into MEDIA_ROOT.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  sequelize,
  User,
  Event,
  EventVolunteer,
  LifetimeVolunteer,
  Certificate,
  MaterialDonation,
  MoneyDonation,
  DonorCertificate,
  AnonymousDonation,
  ContactMessage,
  PasswordResetOTP,
  PehchanWallet,
  WalletTransaction,
  Expense,
  AdminLog,
} from '../models/index.js';
import { ensureDatabase } from './ensure-database.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import:django -- <dumpdata.json>');
  process.exit(1);
}

const MODELS = [
  ['auth.user', User, []],
  ['pehchan.event', Event, ['created_by']],
  ['pehchan.eventvolunteer', EventVolunteer, ['user', 'event']],
  ['pehchan.lifetimevolunteer', LifetimeVolunteer, ['user', 'reviewed_by']],
  ['pehchan.certificate', Certificate, ['event', 'volunteer']],
  ['pehchan.materialdonation', MaterialDonation, ['user']],
  ['pehchan.moneydonation', MoneyDonation, ['user', 'event']],
  ['pehchan.donorcertificate', DonorCertificate, ['user', 'material_donation', 'money_donation']],
  ['pehchan.anonymousdonation', AnonymousDonation, []],
  ['pehchan.contactmessage', ContactMessage, ['responded_by']],
  ['pehchan.passwordresetotp', PasswordResetOTP, ['user']],
  ['pehchan.pehchanwallet', PehchanWallet, []],
  ['pehchan.expense', Expense, ['created_by', 'approved_by']],
  ['pehchan.wallettransaction', WalletTransaction, ['wallet', 'related_donation', 'related_expense']],
  ['admin.logentry', AdminLog, ['user']],
];

const raw = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
const usernameToId = new Map(raw.filter((r) => r.model === 'auth.user').map((r) => [r.fields.username, r.pk]));

function fkValue(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return usernameToId.get(v[0]) ?? null; // natural key of auth.user
  return v;
}

function rowFor(model, record, fks) {
  const row = { id: record.pk };
  const attrs = model.getAttributes();
  for (const [name, value] of Object.entries(record.fields)) {
    if (fks.includes(name)) {
      row[`${name}_id`] = fkValue(value);
    } else if (name === 'content_type') {
      row.content_type = Array.isArray(value) ? value.join('.') : null;
    } else if (attrs[name]) {
      row[name] = value;
    }
  }
  return row;
}

try {
  await ensureDatabase();
  await sequelize.sync();
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const [label, Model, fks] of MODELS) {
    const records = raw.filter((r) => r.model === label);
    if (!records.length) continue;
    const rows = records.map((r) => rowFor(Model, r, fks));
    const updateCols = Object.keys(Model.getAttributes()).filter((a) => a !== 'id');
    // hooks are disabled so certificate numbers / event status / wallet signals are not re-applied
    await Model.bulkCreate(rows, { updateOnDuplicate: updateCols, hooks: false, validate: false });
    console.log(`[+] ${label}: ${rows.length} row(s)`);
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('Import finished.');
  await sequelize.close();
  process.exit(0);
} catch (err) {
  console.error('Import failed:', err.message);
  process.exit(1);
}
