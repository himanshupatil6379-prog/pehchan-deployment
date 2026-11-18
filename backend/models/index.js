/**
 * Data models – one-to-one port of pehchan/models.py + django.contrib.auth User.
 * Table and column names are identical to the Django schema so an existing
 * Django database can be imported without transformation.
 */
import { DataTypes, Op } from 'sequelize';
import sequelize from '../db.js';
import { todayISO } from '../../shared/dateformat.js';

const { STRING, TEXT, BOOLEAN, DATE, DATEONLY, DECIMAL, INTEGER, BIGINT, SMALLINT } = DataTypes;

const pk = { type: BIGINT, primaryKey: true, autoIncrement: true };
const touchUpdatedAt = (instance) => {
  instance.updated_at = new Date();
};

// ---------------------------------------------------------------------------
// django.contrib.auth.models.User  (table auth_user)
// ---------------------------------------------------------------------------
export const User = sequelize.define(
  'User',
  {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    password: { type: STRING(128), allowNull: false },
    last_login: { type: DATE, allowNull: true },
    is_superuser: { type: BOOLEAN, allowNull: false, defaultValue: false },
    username: { type: STRING(150), allowNull: false, unique: true },
    first_name: { type: STRING(150), allowNull: false, defaultValue: '' },
    last_name: { type: STRING(150), allowNull: false, defaultValue: '' },
    email: { type: STRING(254), allowNull: false, defaultValue: '' },
    is_staff: { type: BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
    date_joined: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'auth_user' }
);
User.prototype.getFullName = function getFullName() {
  return `${this.first_name || ''} ${this.last_name || ''}`.trim();
};
User.prototype.toString = function toString() {
  return this.username;
};

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------
export const EVENT_STATUS_CHOICES = [
  ['upcoming', 'Upcoming'],
  ['ongoing', 'Ongoing'],
  ['completed', 'Completed'],
];

export function eventStatusFor(eventDate) {
  const today = todayISO();
  if (!eventDate) return 'upcoming';
  if (eventDate < today) return 'completed';
  if (eventDate === today) return 'ongoing';
  return 'upcoming';
}

export const Event = sequelize.define(
  'Event',
  {
    id: pk,
    name: { type: STRING(200), allowNull: false },
    description: { type: TEXT, allowNull: false },
    event_date: { type: DATEONLY, allowNull: false },
    location: { type: STRING(200), allowNull: false },
    image: { type: STRING(100), allowNull: true },
    is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
    fundraising_goal: { type: DECIMAL(10, 2), allowNull: true },
    status: { type: STRING(20), allowNull: false, defaultValue: 'upcoming' },
    created_by_id: { type: INTEGER, allowNull: true },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: 'pehchan_event',
    indexes: [{ fields: ['event_date'] }, { fields: ['status'] }],
    hooks: {
      beforeSave(instance) {
        // Automatically update status based on event date (Event.save())
        instance.status = eventStatusFor(instance.event_date);
        touchUpdatedAt(instance);
      },
    },
  }
);
Event.prototype.getStatusDisplay = function getStatusDisplay() {
  const s = eventStatusFor(this.event_date);
  return s === 'completed' ? 'Completed' : s === 'ongoing' ? 'Ongoing' : 'Upcoming';
};

// ---------------------------------------------------------------------------
// EventVolunteer
// ---------------------------------------------------------------------------
export const EVENT_VOLUNTEER_STATUS_CHOICES = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
];

export const EventVolunteer = sequelize.define(
  'EventVolunteer',
  {
    id: pk,
    user_id: { type: INTEGER, allowNull: false },
    event_id: { type: BIGINT, allowNull: false },
    contact_number: { type: STRING(10), allowNull: false, defaultValue: '0000000000' },
    joined_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    status: { type: STRING(20), allowNull: false, defaultValue: 'pending' },
    attended: { type: BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: 'pehchan_eventvolunteer',
    indexes: [{ unique: true, fields: ['user_id', 'event_id'] }, { fields: ['status'] }],
  }
);

// ---------------------------------------------------------------------------
// LifetimeVolunteer
// ---------------------------------------------------------------------------
export const LIFETIME_STATUS_CHOICES = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
];

export const LifetimeVolunteer = sequelize.define(
  'LifetimeVolunteer',
  {
    id: pk,
    user_id: { type: INTEGER, allowNull: false, unique: true },
    contact_number: { type: STRING(10), allowNull: false, defaultValue: '0000000000' },
    joined_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    motivation: { type: TEXT, allowNull: false },
    status: { type: STRING(20), allowNull: false, defaultValue: 'pending' },
    approved_at: { type: DATE, allowNull: true },
    rejected_at: { type: DATE, allowNull: true },
    reviewed_by_id: { type: INTEGER, allowNull: true },
  },
  { tableName: 'pehchan_lifetimevolunteer', indexes: [{ fields: ['status'] }] }
);

// ---------------------------------------------------------------------------
// Certificate numbering helper (PYUI/<year>/V/0001, PYUI/<year>/D/0001)
// ---------------------------------------------------------------------------
async function nextCertificateNumber(Model, kind, transaction) {
  const year = Number(todayISO().slice(0, 4));
  const prefix = `PYUI/${year}/${kind}/`;
  const last = await Model.findOne({
    where: { certificate_number: { [Op.like]: `${prefix}%` } },
    order: [['certificate_number', 'DESC']],
    transaction,
  });
  let seq = 1;
  if (last) {
    const n = parseInt(String(last.certificate_number).split('/').pop(), 10);
    seq = Number.isNaN(n) ? 1 : n + 1;
  }
  let number = `${prefix}${String(seq).padStart(4, '0')}`;
  // eslint-disable-next-line no-await-in-loop
  while (await Model.count({ where: { certificate_number: number }, transaction })) {
    seq += 1;
    number = `${prefix}${String(seq).padStart(4, '0')}`;
  }
  return number;
}

// ---------------------------------------------------------------------------
// Certificate (volunteer)
// ---------------------------------------------------------------------------
export const Certificate = sequelize.define(
  'Certificate',
  {
    id: pk,
    event_id: { type: BIGINT, allowNull: false },
    volunteer_id: { type: BIGINT, allowNull: false },
    certificate_number: { type: STRING(50), allowNull: true, unique: true },
    issue_date: { type: DATEONLY, allowNull: false, defaultValue: () => todayISO() },
    file: { type: STRING(100), allowNull: true },
  },
  {
    tableName: 'pehchan_certificate',
    indexes: [{ unique: true, fields: ['event_id', 'volunteer_id'] }, { fields: ['issue_date'] }],
    hooks: {
      async beforeCreate(instance, options) {
        if (!instance.certificate_number) {
          instance.certificate_number = await nextCertificateNumber(Certificate, 'V', options.transaction);
        }
      },
    },
  }
);

// ---------------------------------------------------------------------------
// MaterialDonation
// ---------------------------------------------------------------------------
export const MATERIAL_STATUS_CHOICES = [
  ['pending', 'Pending'],
  ['received', 'Received'],
  ['processed', 'Processed'],
];

export const MaterialDonation = sequelize.define(
  'MaterialDonation',
  {
    id: pk,
    user_id: { type: INTEGER, allowNull: false },
    item_name: { type: STRING(200), allowNull: false },
    quantity: { type: INTEGER, allowNull: false },
    location: { type: STRING(200), allowNull: false },
    contact_number: { type: STRING(10), allowNull: false, defaultValue: '0000000000' },
    message: { type: TEXT, allowNull: false, defaultValue: '' },
    status: { type: STRING(20), allowNull: false, defaultValue: 'pending' },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'pehchan_materialdonation', indexes: [{ fields: ['status'] }, { fields: ['created_at'] }] }
);
MaterialDonation.prototype.getPickupMessage = function getPickupMessage() {
  if (String(this.location || '').toLowerCase() === 'mumbai') return 'Pehchan team will pick up your material.';
  return 'Please courier your material to our office.';
};

// ---------------------------------------------------------------------------
// MoneyDonation
// ---------------------------------------------------------------------------
export const PAYMENT_METHOD_CHOICES = [['upi', 'UPI']];
export const MONEY_STATUS_CHOICES = [
  ['unverified', 'Unverified'],
  ['verified', 'Verified'],
  ['declined', 'Declined'],
];

export const MoneyDonation = sequelize.define(
  'MoneyDonation',
  {
    id: pk,
    user_id: { type: INTEGER, allowNull: false },
    event_id: { type: BIGINT, allowNull: true },
    amount: { type: DECIMAL(10, 2), allowNull: false },
    payment_method: { type: STRING(20), allowNull: false, defaultValue: 'upi' },
    upi_id: { type: STRING(100), allowNull: false, defaultValue: '' },
    contact_number: { type: STRING(10), allowNull: false, defaultValue: '0000000000' },
    receipt_upload: { type: STRING(100), allowNull: true },
    status: { type: STRING(20), allowNull: false, defaultValue: 'unverified' },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'pehchan_moneydonation', indexes: [{ fields: ['status'] }, { fields: ['created_at'] }] }
);

// ---------------------------------------------------------------------------
// DonorCertificate
// ---------------------------------------------------------------------------
export const DONATION_TYPE_CHOICES = [
  ['material', 'Material Donation'],
  ['money', 'Money Donation'],
];

export const DonorCertificate = sequelize.define(
  'DonorCertificate',
  {
    id: pk,
    user_id: { type: INTEGER, allowNull: false },
    donation_type: { type: STRING(20), allowNull: false },
    material_donation_id: { type: BIGINT, allowNull: true },
    money_donation_id: { type: BIGINT, allowNull: true },
    certificate_number: { type: STRING(50), allowNull: false, unique: true },
    issue_date: { type: DATEONLY, allowNull: false, defaultValue: () => todayISO() },
    issued_by: { type: STRING(200), allowNull: false, defaultValue: 'Pehchan NGO' },
    remarks: { type: TEXT, allowNull: false, defaultValue: '' },
    file: { type: STRING(100), allowNull: true },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: 'pehchan_donorcertificate',
    indexes: [{ fields: ['issue_date'] }],
    hooks: {
      async beforeValidate(instance, options) {
        if (instance.isNewRecord && !instance.certificate_number) {
          instance.certificate_number = await nextCertificateNumber(DonorCertificate, 'D', options.transaction);
        }
      },
      beforeSave: touchUpdatedAt,
    },
  }
);
DonorCertificate.prototype.getDonationDetails = function getDonationDetails() {
  try {
    if (this.donation_type === 'material' && this.material_donation) {
      return `${this.material_donation.item_name} (Qty: ${this.material_donation.quantity})`;
    }
    if (this.donation_type === 'money' && this.money_donation) {
      return `Rs. ${this.money_donation.amount}`;
    }
  } catch {
    return 'Error retrieving details';
  }
  return 'N/A';
};

// ---------------------------------------------------------------------------
// AnonymousDonation
// ---------------------------------------------------------------------------
export const AnonymousDonation = sequelize.define(
  'AnonymousDonation',
  {
    id: pk,
    donor_name: { type: STRING(200), allowNull: true },
    donor_email: { type: STRING(254), allowNull: true },
    donor_phone: { type: STRING(20), allowNull: true },
    amount: { type: DECIMAL(10, 2), allowNull: false },
    transaction_id: { type: STRING(100), allowNull: true },
    receipt: { type: STRING(100), allowNull: true },
    wants_receipt: { type: BOOLEAN, allowNull: false, defaultValue: false },
    message: { type: TEXT, allowNull: true },
    google_form_submitted: { type: BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ip_address: { type: STRING(39), allowNull: true },
  },
  { tableName: 'pehchan_anonymousdonation', indexes: [{ fields: ['created_at'] }] }
);

// ---------------------------------------------------------------------------
// ContactMessage
// ---------------------------------------------------------------------------
export const CONTACT_STATUS_CHOICES = [
  ['new', 'New'],
  ['read', 'Read'],
  ['replied', 'Replied'],
  ['archived', 'Archived'],
];
export const CONTACT_PRIORITY_CHOICES = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['urgent', 'Urgent'],
];

export const ContactMessage = sequelize.define(
  'ContactMessage',
  {
    id: pk,
    name: { type: STRING(200), allowNull: false },
    email: { type: STRING(254), allowNull: false },
    message: { type: TEXT, allowNull: false },
    status: { type: STRING(20), allowNull: false, defaultValue: 'new' },
    priority: { type: STRING(20), allowNull: false, defaultValue: 'medium' },
    admin_notes: { type: TEXT, allowNull: true },
    response: { type: TEXT, allowNull: true },
    responded_by_id: { type: INTEGER, allowNull: true },
    responded_at: { type: DATE, allowNull: true },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ip_address: { type: STRING(39), allowNull: true },
    user_agent: { type: TEXT, allowNull: true },
  },
  {
    tableName: 'pehchan_contactmessage',
    indexes: [{ fields: ['created_at'] }, { fields: ['status'] }, { fields: ['priority'] }, { fields: ['email'] }],
    hooks: { beforeSave: touchUpdatedAt },
  }
);
ContactMessage.prototype.getShortMessage = function getShortMessage(limit = 50) {
  if (this.message && this.message.length > limit) return `${this.message.slice(0, limit)}...`;
  return this.message;
};

// ---------------------------------------------------------------------------
// PasswordResetOTP
// ---------------------------------------------------------------------------
export const PasswordResetOTP = sequelize.define(
  'PasswordResetOTP',
  {
    id: pk,
    user_id: { type: INTEGER, allowNull: false },
    otp: { type: STRING(6), allowNull: false },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    expires_at: { type: DATE, allowNull: false },
  },
  { tableName: 'pehchan_passwordresetotp' }
);
PasswordResetOTP.prototype.isValid = function isValid() {
  return new Date() < new Date(this.expires_at);
};

// ---------------------------------------------------------------------------
// PehchanWallet / WalletTransaction / Expense
// ---------------------------------------------------------------------------
export const PehchanWallet = sequelize.define(
  'PehchanWallet',
  {
    id: pk,
    balance: { type: DECIMAL(12, 2), allowNull: false, defaultValue: '0.00' },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'pehchan_pehchanwallet', hooks: { beforeSave: touchUpdatedAt } }
);

export const TRANSACTION_TYPES = [
  ['donation', 'Donation'],
  ['expense', 'Expense'],
  ['adjustment', 'Adjustment'],
];

export const WalletTransaction = sequelize.define(
  'WalletTransaction',
  {
    id: pk,
    wallet_id: { type: BIGINT, allowNull: false },
    amount: { type: DECIMAL(12, 2), allowNull: false },
    transaction_type: { type: STRING(20), allowNull: false },
    description: { type: TEXT, allowNull: false, defaultValue: '' },
    related_donation_id: { type: BIGINT, allowNull: true },
    related_expense_id: { type: BIGINT, allowNull: true },
    balance_after_transaction: { type: DECIMAL(12, 2), allowNull: false },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'pehchan_wallettransaction' }
);

export const EXPENSE_CATEGORY_CHOICES = [
  ['office', 'Office'],
  ['travel', 'Travel'],
  ['salary', 'Salary'],
  ['marketing', 'Marketing'],
  ['other', 'Other'],
];

export const Expense = sequelize.define(
  'Expense',
  {
    id: pk,
    title: { type: STRING(200), allowNull: false },
    description: { type: TEXT, allowNull: false, defaultValue: '' },
    category: { type: STRING(20), allowNull: false, defaultValue: 'other' },
    amount: { type: DECIMAL(10, 2), allowNull: false },
    date: { type: DATEONLY, allowNull: false },
    receipt: { type: STRING(100), allowNull: true },
    created_by_id: { type: INTEGER, allowNull: true },
    approved_by_id: { type: INTEGER, allowNull: true },
    approved_at: { type: DATE, allowNull: true },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'pehchan_expense', hooks: { beforeSave: touchUpdatedAt } }
);

// ---------------------------------------------------------------------------
// django_admin_log (admin "Recent actions" / object history)
// ---------------------------------------------------------------------------
export const AdminLog = sequelize.define(
  'AdminLog',
  {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    action_time: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
    object_id: { type: TEXT, allowNull: true },
    object_repr: { type: STRING(200), allowNull: false },
    action_flag: { type: SMALLINT.UNSIGNED, allowNull: false },
    change_message: { type: TEXT, allowNull: false, defaultValue: '' },
    content_type: { type: STRING(100), allowNull: true }, // "pehchan.event"
    user_id: { type: INTEGER, allowNull: false },
  },
  { tableName: 'django_admin_log', indexes: [{ fields: ['action_time'] }] }
);

// ---------------------------------------------------------------------------
// app_settings – internal key/value store (e.g. the generated SECRET_KEY)
// ---------------------------------------------------------------------------
export const AppSetting = sequelize.define(
  'AppSetting',
  {
    key: { type: STRING(100), primaryKey: true },
    value: { type: TEXT, allowNull: false },
    created_at: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'app_settings' }
);

// ---------------------------------------------------------------------------
// Associations (related_name kept as alias)
// ---------------------------------------------------------------------------
const fk = (name, onDelete = 'CASCADE', allowNull = false) => ({ foreignKey: { name, allowNull }, onDelete, constraints: true });

Event.belongsTo(User, { as: 'created_by', ...fk('created_by_id', 'SET NULL', true) });
User.hasMany(Event, { as: 'events_created', ...fk('created_by_id', 'SET NULL', true) });

EventVolunteer.belongsTo(User, { as: 'user', ...fk('user_id') });
User.hasMany(EventVolunteer, { as: 'event_volunteers', ...fk('user_id') });
EventVolunteer.belongsTo(Event, { as: 'event', ...fk('event_id') });
Event.hasMany(EventVolunteer, { as: 'volunteers', ...fk('event_id') });

LifetimeVolunteer.belongsTo(User, { as: 'user', ...fk('user_id') });
User.hasOne(LifetimeVolunteer, { as: 'lifetime_volunteer', ...fk('user_id') });
LifetimeVolunteer.belongsTo(User, { as: 'reviewed_by', ...fk('reviewed_by_id', 'SET NULL', true) });

Certificate.belongsTo(Event, { as: 'event', ...fk('event_id') });
Event.hasMany(Certificate, { as: 'certificates', ...fk('event_id') });
Certificate.belongsTo(EventVolunteer, { as: 'volunteer', ...fk('volunteer_id') });
EventVolunteer.hasMany(Certificate, { as: 'certificates', ...fk('volunteer_id') });

MaterialDonation.belongsTo(User, { as: 'user', ...fk('user_id') });
User.hasMany(MaterialDonation, { as: 'material_donations', ...fk('user_id') });

MoneyDonation.belongsTo(User, { as: 'user', ...fk('user_id') });
User.hasMany(MoneyDonation, { as: 'money_donations', ...fk('user_id') });
MoneyDonation.belongsTo(Event, { as: 'event', ...fk('event_id', 'SET NULL', true) });
Event.hasMany(MoneyDonation, { as: 'money_donations', ...fk('event_id', 'SET NULL', true) });

DonorCertificate.belongsTo(User, { as: 'user', ...fk('user_id') });
User.hasMany(DonorCertificate, { as: 'donor_certificates', ...fk('user_id') });
DonorCertificate.belongsTo(MaterialDonation, { as: 'material_donation', ...fk('material_donation_id', 'CASCADE', true) });
MaterialDonation.hasMany(DonorCertificate, { as: 'certificates', ...fk('material_donation_id', 'CASCADE', true) });
DonorCertificate.belongsTo(MoneyDonation, { as: 'money_donation', ...fk('money_donation_id', 'CASCADE', true) });
MoneyDonation.hasMany(DonorCertificate, { as: 'certificates', ...fk('money_donation_id', 'CASCADE', true) });

ContactMessage.belongsTo(User, { as: 'responded_by', ...fk('responded_by_id', 'SET NULL', true) });

PasswordResetOTP.belongsTo(User, { as: 'user', ...fk('user_id') });
User.hasMany(PasswordResetOTP, { as: 'password_reset_otps', ...fk('user_id') });

WalletTransaction.belongsTo(PehchanWallet, { as: 'wallet', ...fk('wallet_id') });
PehchanWallet.hasMany(WalletTransaction, { as: 'transactions', ...fk('wallet_id') });
WalletTransaction.belongsTo(MoneyDonation, { as: 'related_donation', ...fk('related_donation_id', 'SET NULL', true) });
MoneyDonation.hasMany(WalletTransaction, { as: 'wallet_transactions', ...fk('related_donation_id', 'SET NULL', true) });
WalletTransaction.belongsTo(Expense, { as: 'related_expense', ...fk('related_expense_id', 'SET NULL', true) });
Expense.hasMany(WalletTransaction, { as: 'wallet_transactions', ...fk('related_expense_id', 'SET NULL', true) });

Expense.belongsTo(User, { as: 'created_by', ...fk('created_by_id', 'SET NULL', true) });
Expense.belongsTo(User, { as: 'approved_by', ...fk('approved_by_id', 'SET NULL', true) });

AdminLog.belongsTo(User, { as: 'user', ...fk('user_id') });

export { sequelize, Op };
