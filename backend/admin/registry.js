/**
 * ModelAdmin registrations – port of pehchan/admin.py (+ Django's UserAdmin).
 */
import {
  User,
  Event,
  EventVolunteer,
  LifetimeVolunteer,
  Certificate,
  MaterialDonation,
  MoneyDonation,
  DonorCertificate,
  ContactMessage,
  AnonymousDonation,
  PehchanWallet,
  WalletTransaction,
  Expense,
  EVENT_STATUS_CHOICES,
  EVENT_VOLUNTEER_STATUS_CHOICES,
  LIFETIME_STATUS_CHOICES,
  MATERIAL_STATUS_CHOICES,
  PAYMENT_METHOD_CHOICES,
  MONEY_STATUS_CHOICES,
  DONATION_TYPE_CHOICES,
  CONTACT_STATUS_CHOICES,
  CONTACT_PRIORITY_CHOICES,
  TRANSACTION_TYPES,
  EXPENSE_CATEGORY_CHOICES,
} from '../models/index.js';
import { F } from './fields.js';
import { modelPhoneValidator, validateUsername } from '../utils/forms.js';
import { validateReceiptFile, mediaUrl } from '../utils/uploads.js';
import { todayISO, dateFormat } from '../../shared/dateformat.js';
import * as actions from './actions.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const utcStamp = (d, withTime) => {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  return withTime ? `${date} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}` : date;
};
const choiceLabel = (choices, v) => (choices.find(([k]) => k === v) || [null, v])[1];

const EXPORTS = [
  { name: 'export_as_csv', description: 'Download selected as CSV', handler: actions.exportAsCsv },
  { name: 'export_as_excel', description: 'Download selected as Excel (XLSX)', handler: actions.exportAsExcel },
];

const userInc = (as = 'user') => ({ model: User, as });
const eventInc = { model: Event, as: 'event' };
const volunteerInc = { model: EventVolunteer, as: 'volunteer', include: [userInc()] };

/** Column helpers */
const col = (field, o = {}) => ({ field, ...o });
const custom = (key, label, cell, o = {}) => ({ key, label, cell, ...o });

const ADMIN_PATCH_CSS = '/static/CSS/admin_patch.css';

// ---------------------------------------------------------------------------
const registry = [
  // ======================= auth.User (django UserAdmin) =======================
  {
    app_label: 'auth',
    model_name: 'user',
    object_name: 'User',
    Model: User,
    verbose_name: 'user',
    verbose_name_plural: 'users',
    str: (o) => o.username,
    fields: [
      F.char('password', 'Password', 128),
      F.datetime('last_login', 'Last login', { blank: true, null: true }),
      F.bool('is_superuser', 'Superuser status', {
        help_text: 'Designates that this user has all permissions without explicitly assigning them.',
      }),
      F.char('username', 'Username', 150, {
        help_text: 'Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.',
        unique: true,
        unique_message: 'A user with that username already exists.',
        validators: [validateUsername],
      }),
      F.char('first_name', 'First name', 150, { blank: true }),
      F.char('last_name', 'Last name', 150, { blank: true }),
      F.email('email', 'Email address', { blank: true }),
      F.bool('is_staff', 'Staff status', { help_text: 'Designates whether the user can log into this admin site.' }),
      F.bool('is_active', 'Active', {
        default: true,
        help_text: 'Designates whether this user should be treated as active. Unselect this instead of deleting accounts.',
      }),
      F.datetime('date_joined', 'Date joined', { default: () => new Date() }),
    ],
    list_display: [col('username'), col('email'), col('first_name'), col('last_name'), col('is_staff')],
    list_filter: [
      { field: 'is_staff', title: 'staff status' },
      { field: 'is_superuser', title: 'superuser status' },
      { field: 'is_active', title: 'active' },
    ],
    search_fields: ['username', 'first_name', 'last_name', 'email'],
    ordering: [['username', 'ASC']],
    fieldsets: [
      [null, { fields: ['username', 'password'] }],
      ['Personal info', { fields: ['first_name', 'last_name', 'email'] }],
      ['Permissions', { fields: ['is_active', 'is_staff', 'is_superuser'] }],
      ['Important dates', { fields: ['last_login', 'date_joined'] }],
    ],
    add_fieldsets: [[null, { classes: ['wide'], fields: ['username', 'password1', 'password2'] }]],
    readonly_fields: [],
    special: 'user',
    actions: [],
  },

  // ================================ Event ================================
  {
    app_label: 'pehchan',
    model_name: 'event',
    object_name: 'Event',
    Model: Event,
    verbose_name: 'event',
    verbose_name_plural: 'events',
    str: (o) => `${o.name} - ${o.event_date}`,
    include: [userInc('created_by')],
    fields: [
      F.char('name', 'Name', 200),
      F.text('description', 'Description'),
      F.date('event_date', 'Event date'),
      F.char('location', 'Location', 200),
      F.image('image', 'Image', 'event_images', { blank: true, null: true }),
      F.bool('is_active', 'Is active', { default: true }),
      F.decimal('fundraising_goal', 'Fundraising goal', 10, 2, { blank: true, null: true, help_text: 'Target amount to raise for this event' }),
      F.choice('status', 'Status', EVENT_STATUS_CHOICES, { default: 'upcoming' }),
      F.fk('created_by', 'Created by', 'auth.user', 'created_by', { blank: true, null: true }),
      F.datetime('created_at', 'Created at', { auto: true }),
      F.datetime('updated_at', 'Updated at', { auto: true }),
    ],
    list_display: [
      col('name'),
      col('event_date'),
      custom('get_status_display', 'Get status display', (o) => ({ type: 'text', text: o.getStatusDisplay() })),
      col('status'),
      col('created_by'),
    ],
    readonly_fields: ['created_by'],
    ordering: null, // Meta.ordering
    model_ordering: [['event_date', 'DESC']],
    actions: [...EXPORTS],
    media_css: [ADMIN_PATCH_CSS],
    native_datetime: true,
    beforeSave: (obj, { isAdd, user }) => {
      if (isAdd) obj.created_by_id = user.id;
    },
  },

  // ============================ EventVolunteer ============================
  {
    app_label: 'pehchan',
    model_name: 'eventvolunteer',
    object_name: 'EventVolunteer',
    Model: EventVolunteer,
    verbose_name: 'event volunteer',
    verbose_name_plural: 'event volunteers',
    str: (o) => `${o.user ? o.user.username : ''} - ${o.event ? o.event.name : ''}`,
    include: [userInc(), eventInc],
    fields: [
      F.fk('user', 'User', 'auth.user', 'user'),
      F.fk('event', 'Event', 'pehchan.event', 'event'),
      F.char('contact_number', 'Contact number', 10, { default: '0000000000', validators: [modelPhoneValidator('indian')] }),
      F.datetime('joined_at', 'Joined at', { auto: true }),
      F.choice('status', 'Status', EVENT_VOLUNTEER_STATUS_CHOICES, { default: 'pending' }),
      F.bool('attended', 'Attended', { help_text: 'Did the volunteer actually attend the event?' }),
    ],
    unique_together: [{ fields: ['user', 'event'], message: 'Event volunteer with this User and Event already exists.' }],
    list_display: [
      col('user'),
      col('event'),
      col('contact_number'),
      col('joined_at'),
      col('status'),
      col('attended'),
      custom('issue_certificate_button', 'Certificate Actions', (o) =>
        o.status === 'approved' && o.attended
          ? { type: 'link', text: 'Issue Certificate', href: `/admin/pehchan/eventvolunteer/issue-certificate/${o.id}/`, className: 'button', target: '_blank' }
          : { type: 'text', text: 'Not Eligible' }
      ),
    ],
    list_editable: ['status', 'attended'],
    list_filter: [
      { field: 'status' },
      { field: 'attended' },
      { field: 'joined_at', kind: 'date' },
      { field: 'event' },
    ],
    search_fields: ['user__username', 'user__email', 'event__name', 'contact_number'],
    date_hierarchy: 'joined_at',
    ordering: [['joined_at', 'DESC']],
    actions: [{ name: 'issue_certificate', description: 'Issue Certificate', handler: actions.issueVolunteerCertificates }, ...EXPORTS],
  },

  // =========================== LifetimeVolunteer ===========================
  {
    app_label: 'pehchan',
    model_name: 'lifetimevolunteer',
    object_name: 'LifetimeVolunteer',
    Model: LifetimeVolunteer,
    verbose_name: 'lifetime volunteer',
    verbose_name_plural: 'lifetime volunteers',
    str: (o) => `${o.user ? o.user.username : ''} - Lifetime Volunteer (${choiceLabel(LIFETIME_STATUS_CHOICES, o.status)})`,
    include: [userInc(), userInc('reviewed_by')],
    fields: [
      F.fk('user', 'User', 'auth.user', 'user', { unique: true, unique_message: 'Lifetime volunteer with this User already exists.' }),
      F.char('contact_number', 'Contact number', 10, { default: '0000000000', validators: [modelPhoneValidator('indian')] }),
      F.datetime('joined_at', 'Joined at', { auto: true }),
      F.text('motivation', 'Motivation'),
      F.choice('status', 'Status', LIFETIME_STATUS_CHOICES, { default: 'pending' }),
      F.datetime('approved_at', 'Approved at', { blank: true, null: true }),
      F.datetime('rejected_at', 'Rejected at', { blank: true, null: true }),
      F.fk('reviewed_by', 'Reviewed by', 'auth.user', 'reviewed_by', { blank: true, null: true }),
    ],
    list_display: [col('user'), col('contact_number'), col('joined_at'), col('status'), col('approved_at'), col('rejected_at')],
    list_filter: [{ field: 'status' }, { field: 'joined_at', kind: 'date' }],
    search_fields: ['user__username', 'user__email', 'contact_number', 'motivation'],
    date_hierarchy: 'joined_at',
    ordering: [['joined_at', 'DESC']],
    readonly_fields: ['joined_at', 'approved_at', 'rejected_at', 'reviewed_by'],
    actions: [
      { name: 'approve_volunteers', description: 'Approve selected lifetime volunteers', handler: actions.approveLifetime },
      { name: 'reject_volunteers', description: 'Reject selected lifetime volunteers', handler: actions.rejectLifetime },
      ...EXPORTS,
    ],
  },

  // ============================== Certificate ==============================
  {
    app_label: 'pehchan',
    model_name: 'certificate',
    object_name: 'Certificate',
    Model: Certificate,
    verbose_name: 'certificate',
    verbose_name_plural: 'certificates',
    str: (o) =>
      `Certificate ${o.certificate_number || `#${o.id}`} - ${o.volunteer && o.volunteer.user ? o.volunteer.user.username : ''} - ${o.event ? o.event.name : ''}`,
    include: [eventInc, volunteerInc],
    fields: [
      F.fk('event', 'Event', 'pehchan.event', 'event'),
      F.fk('volunteer', 'Volunteer', 'pehchan.eventvolunteer', 'volunteer'),
      F.char('certificate_number', 'Certificate number', 50, {
        blank: true,
        null: true,
        unique: true,
        unique_message: 'Certificate with this Certificate number already exists.',
      }),
      F.date('issue_date', 'Issue date', { default: () => todayISO() }),
      F.file('file', 'File', 'certificates', { blank: true, null: true }),
    ],
    unique_together: [{ fields: ['event', 'volunteer'], message: 'Certificate with this Event and Volunteer already exists.' }],
    list_display: [col('certificate_number'), col('volunteer'), col('event'), col('issue_date')],
    list_filter: [{ field: 'issue_date', kind: 'date' }, { field: 'event' }],
    search_fields: ['certificate_number', 'volunteer__user__username', 'event__name'],
    date_hierarchy: 'issue_date',
    ordering: [['issue_date', 'DESC']],
    actions: [...EXPORTS],
  },

  // =========================== MaterialDonation ===========================
  {
    app_label: 'pehchan',
    model_name: 'materialdonation',
    object_name: 'MaterialDonation',
    Model: MaterialDonation,
    verbose_name: 'material donation',
    verbose_name_plural: 'material donations',
    str: (o) => `${o.user ? o.user.username : ''} - ${o.item_name}`,
    include: [userInc()],
    fields: [
      F.fk('user', 'User', 'auth.user', 'user'),
      F.char('item_name', 'Item name', 200),
      F.int('quantity', 'Quantity'),
      F.char('location', 'Location', 200),
      F.char('contact_number', 'Contact number', 10, { default: '0000000000', validators: [modelPhoneValidator('digits')] }),
      F.text('message', 'Message', { blank: true }),
      F.choice('status', 'Status', MATERIAL_STATUS_CHOICES, { default: 'pending' }),
      F.datetime('created_at', 'Created at', { auto: true }),
    ],
    list_display: [
      col('user'),
      col('item_name'),
      col('quantity'),
      col('location'),
      col('contact_number'),
      col('status'),
      col('created_at'),
      custom('issue_certificate_button', 'Certificate Actions', (o) =>
        o.status === 'received'
          ? { type: 'link', text: 'Issue Certificate', href: `/admin/pehchan/materialdonation/issue-certificate/${o.id}/`, className: 'button', target: '_blank' }
          : { type: 'text', text: 'Not Received' }
      ),
    ],
    list_filter: [{ field: 'status' }, { field: 'location', kind: 'values' }, { field: 'created_at', kind: 'date' }],
    search_fields: ['user__username', 'item_name', 'location', 'contact_number'],
    date_hierarchy: 'created_at',
    ordering: [['created_at', 'DESC']],
    readonly_fields: ['created_at'],
    actions: [{ name: 'issue_donor_certificate', description: 'Issue Donor Certificate', handler: actions.issueMaterialCertificates }, ...EXPORTS],
  },

  // ============================= MoneyDonation =============================
  {
    app_label: 'pehchan',
    model_name: 'moneydonation',
    object_name: 'MoneyDonation',
    Model: MoneyDonation,
    verbose_name: 'money donation',
    verbose_name_plural: 'money donations',
    str: (o) => `${o.user ? o.user.username : ''} - Rs. ${o.amount}`,
    include: [userInc(), eventInc],
    fields: [
      F.fk('user', 'User', 'auth.user', 'user'),
      F.fk('event', 'Event', 'pehchan.event', 'event', { blank: true, null: true, help_text: 'Optional: Link this donation to a specific event' }),
      F.decimal('amount', 'Amount', 10, 2),
      F.choice('payment_method', 'Payment method', PAYMENT_METHOD_CHOICES, { default: 'upi' }),
      F.char('upi_id', 'Upi id', 100, { blank: true }),
      F.char('contact_number', 'Contact number', 10, { default: '0000000000', validators: [modelPhoneValidator('indian')] }),
      F.file('receipt_upload', 'Receipt upload', 'receipts', { blank: true, null: true, validators: [validateReceiptFile] }),
      F.choice('status', 'Status', MONEY_STATUS_CHOICES, { default: 'unverified' }),
      F.datetime('created_at', 'Created at', { auto: true }),
    ],
    list_display: [
      col('user'),
      col('amount'),
      col('contact_number'),
      col('status'),
      col('payment_method'),
      col('created_at'),
      custom('issue_certificate_button', 'Certificate Actions', (o) =>
        o.status === 'verified'
          ? { type: 'link', text: 'Issue Certificate', href: `/admin/pehchan/moneydonation/issue-certificate/${o.id}/`, className: 'button', target: '_blank' }
          : { type: 'html', html: '<span style="color: #999;">Requires Verification</span>' }
      ),
    ],
    list_filter: [{ field: 'status' }, { field: 'payment_method' }, { field: 'created_at', kind: 'date' }],
    search_fields: ['user__username', 'user__email', 'upi_id', 'contact_number'],
    date_hierarchy: 'created_at',
    ordering: [['created_at', 'DESC']],
    readonly_fields: ['created_at'],
    actions: [
      { name: 'issue_donor_certificate', description: 'Issue Donor Certificate', handler: actions.issueMoneyCertificates },
      { name: 'verify_donations', description: 'Mark selected donations as Verified', handler: actions.setMoneyStatus('verified') },
      { name: 'decline_donations', description: 'Mark selected donations as Declined', handler: actions.setMoneyStatus('declined') },
      ...EXPORTS,
    ],
  },

  // =========================== DonorCertificate ===========================
  {
    app_label: 'pehchan',
    model_name: 'donorcertificate',
    object_name: 'DonorCertificate',
    Model: DonorCertificate,
    verbose_name: 'Donor Certificate',
    verbose_name_plural: 'Donor Certificates',
    str: (o) => `Certificate ${o.certificate_number} - ${o.user ? o.user.username : ''}`,
    include: [userInc(), { model: MaterialDonation, as: 'material_donation', include: [userInc()] }, { model: MoneyDonation, as: 'money_donation', include: [userInc()] }],
    fields: [
      F.fk('user', 'User', 'auth.user', 'user'),
      F.choice('donation_type', 'Donation type', DONATION_TYPE_CHOICES),
      F.fk('material_donation', 'Material donation', 'pehchan.materialdonation', 'material_donation', { blank: true, null: true }),
      F.fk('money_donation', 'Money donation', 'pehchan.moneydonation', 'money_donation', { blank: true, null: true }),
      F.char('certificate_number', 'Certificate number', 50, { auto: true }),
      F.date('issue_date', 'Issue date', { default: () => todayISO() }),
      F.char('issued_by', 'Issued by', 200, { default: 'Pehchan NGO' }),
      F.text('remarks', 'Remarks', { blank: true, help_text: 'Additional remarks or appreciation message' }),
      F.file('file', 'File', 'donor_certificates', { blank: true, null: true }),
      F.datetime('created_at', 'Created at', { auto: true }),
      F.datetime('updated_at', 'Updated at', { auto: true }),
    ],
    list_display: [
      col('certificate_number'),
      col('user'),
      col('donation_type'),
      custom('get_donation_info', 'Donation Details', (o) => ({ type: 'text', text: o.getDonationDetails() })),
      col('issue_date'),
      col('issued_by'),
      custom('file_link', 'Certificate File', (o) =>
        o.file ? { type: 'html', html: `<a href="${esc(mediaUrl(o.file))}" target="_blank">View Certificate</a>` } : { type: 'text', text: 'No File' }
      ),
      col('created_at'),
    ],
    list_filter: [{ field: 'donation_type' }, { field: 'issue_date', kind: 'date' }, { field: 'created_at', kind: 'date' }],
    search_fields: ['certificate_number', 'user__username', 'user__email', 'user__first_name', 'user__last_name'],
    date_hierarchy: 'issue_date',
    ordering: [['issue_date', 'DESC'], ['created_at', 'DESC']],
    readonly_fields: ['certificate_number', 'created_at', 'updated_at', 'get_donation_preview', 'file_link'],
    computed_readonly: {
      get_donation_preview: {
        label: 'Donation Preview',
        display: (o) => {
          if (!o) return 'No donation selected';
          try {
            if (o.donation_type === 'material' && o.material_donation) {
              const d = o.material_donation;
              return `Item: ${d.item_name} | Quantity: ${d.quantity} | Location: ${d.location} | Date: ${utcStamp(d.created_at)}`;
            }
            if (o.donation_type === 'money' && o.money_donation) {
              const d = o.money_donation;
              return `Amount: Rs. ${d.amount} | Payment Method: ${choiceLabel(PAYMENT_METHOD_CHOICES, d.payment_method)} | Date: ${utcStamp(d.created_at)}`;
            }
          } catch {
            return 'Error retrieving donation preview';
          }
          return 'No donation selected';
        },
      },
      file_link: {
        label: 'Certificate File',
        displayHtml: (o) => (o && o.file ? `<a href="${esc(mediaUrl(o.file))}" target="_blank">View Certificate</a>` : 'No File'),
      },
    },
    fieldsets: [
      ['Donor Information', { fields: ['user', 'donation_type'] }],
      ['Donation Details', { fields: ['material_donation', 'money_donation', 'get_donation_preview'] }],
      ['Certificate Information', { fields: ['certificate_number', 'issue_date', 'issued_by', 'remarks', 'file'] }],
      ['Timestamps', { fields: ['created_at', 'updated_at'], classes: ['collapse'] }],
    ],
    actions: [...EXPORTS],
  },

  // ============================ ContactMessage ============================
  {
    app_label: 'pehchan',
    model_name: 'contactmessage',
    object_name: 'ContactMessage',
    Model: ContactMessage,
    verbose_name: 'Contact Message',
    verbose_name_plural: 'Contact Messages',
    str: (o) => `${o.name} - ${utcStamp(o.created_at, true)}`,
    include: [userInc('responded_by')],
    fields: [
      F.char('name', 'Name', 200),
      F.email('email', 'Email'),
      F.text('message', 'Message'),
      F.choice('status', 'Status', CONTACT_STATUS_CHOICES, { default: 'new' }),
      F.choice('priority', 'Priority', CONTACT_PRIORITY_CHOICES, { default: 'medium' }),
      F.text('admin_notes', 'Admin notes', { blank: true, null: true }),
      F.text('response', 'Response', { blank: true, null: true }),
      F.fk('responded_by', 'Responded by', 'auth.user', 'responded_by', { blank: true, null: true }),
      F.datetime('responded_at', 'Responded at', { blank: true, null: true }),
      F.datetime('created_at', 'Created at', { auto: true }),
      F.datetime('updated_at', 'Updated at', { auto: true }),
      F.ip('ip_address', 'Ip address', { blank: true, null: true }),
      F.text('user_agent', 'User agent', { blank: true, null: true }),
    ],
    list_display: [
      custom(
        'colored_status',
        'Status',
        (o) => {
          const colors = { new: '#ff5722', read: '#2196f3', replied: '#4caf50', archived: '#9e9e9e' };
          const bg = { new: '#ffebee', read: '#e3f2fd', replied: '#e8f5e9', archived: '#fafafa' };
          const c = colors[o.status] || '#000';
          const b = bg[o.status] || '#f5f5f5';
          return {
            type: 'html',
            html: `<span style="color: ${c}; background-color: ${b}; padding: 3px 8px; border-radius: 3px; font-weight: bold; border: 1px solid ${c};">${esc(
              choiceLabel(CONTACT_STATUS_CHOICES, o.status)
            )}</span>`,
          };
        },
        { order_field: 'status' }
      ),
      col('name'),
      col('email'),
      custom('short_message_display', 'Message Preview', (o) => ({ type: 'text', text: o.getShortMessage(60) })),
      custom(
        'priority_badge',
        'Priority',
        (o) => {
          const colors = { low: '#4caf50', medium: '#ff9800', high: '#ff5722', urgent: '#e91e63' };
          const bg = { low: '#e8f5e9', medium: '#fff3e0', high: '#ffebee', urgent: '#fce4ec' };
          const c = colors[o.priority] || '#000';
          const b = bg[o.priority] || '#f5f5f5';
          return {
            type: 'html',
            html: `<span style="background-color: ${b}; color: ${c}; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; border: 1px solid ${c};">${esc(
              String(choiceLabel(CONTACT_PRIORITY_CHOICES, o.priority)).toUpperCase()
            )}</span>`,
          };
        },
        { order_field: 'priority' }
      ),
      col('created_at'),
      col('responded_by'),
      custom('action_buttons', 'Quick Status', (o) => {
        if (o.status === 'new')
          return { type: 'html', html: '<span style="color: #ff5722; font-weight: bold; background: #ffebee; padding: 3px 8px; border-radius: 3px;">⚠ NEW</span>' };
        if (o.status === 'replied')
          return { type: 'html', html: '<span style="color: #4caf50; font-weight: bold; background: #e8f5e9; padding: 3px 8px; border-radius: 3px;">✓ Replied</span>' };
        return { type: 'html', html: '<span style="color: #9e9e9e; background: #fafafa; padding: 3px 8px; border-radius: 3px;">-</span>' };
      }),
    ],
    list_filter: [
      { field: 'status' },
      { field: 'priority' },
      { field: 'created_at', kind: 'date' },
      { field: 'responded_at', kind: 'date' },
      { field: 'responded_by' },
      { field: 'created_at', kind: 'date' },
    ],
    search_fields: ['name', 'email', 'message', 'admin_notes', 'response'],
    date_hierarchy: 'created_at',
    ordering: [['created_at', 'DESC']],
    readonly_fields: ['created_at', 'updated_at', 'ip_address', 'user_agent', 'responded_at'],
    fieldsets: [
      ['Contact Information', { fields: ['name', 'email'] }],
      ['Message Details', { fields: ['message', 'priority', 'status'] }],
      ['Response', { fields: ['response', 'responded_by', 'responded_at'], classes: ['collapse'] }],
      ['Admin Notes', { fields: ['admin_notes'], classes: ['collapse'], description: 'Internal notes - not visible to the sender' }],
      ['Metadata', { fields: ['ip_address', 'user_agent', 'created_at', 'updated_at'], classes: ['collapse'] }],
    ],
    special: 'contactmessage',
    actions: [
      { name: 'mark_as_read', description: '📖 Mark as Read', handler: actions.contactMarkRead },
      { name: 'mark_as_replied', description: '✉️ Mark as Replied', handler: actions.contactMarkReplied },
      { name: 'mark_as_archived', description: '📦 Archive Messages', handler: actions.contactArchive },
      { name: 'set_priority_high', description: '🔴 Set Priority: HIGH', handler: actions.contactPriority('high', 'HIGH') },
      { name: 'set_priority_medium', description: '🟠 Set Priority: MEDIUM', handler: actions.contactPriority('medium', 'MEDIUM') },
      { name: 'set_priority_low', description: '🟢 Set Priority: LOW', handler: actions.contactPriority('low', 'LOW') },
      { name: 'send_reply', description: '📤 Send Reply via Email', handler: actions.contactSendReply },
      ...EXPORTS,
    ],
  },

  // ============================= PehchanWallet =============================
  {
    app_label: 'pehchan',
    model_name: 'pehchanwallet',
    object_name: 'PehchanWallet',
    Model: PehchanWallet,
    verbose_name: 'Pehchan Wallet',
    verbose_name_plural: 'Pehchan Wallet',
    str: (o) => `Pehchan Wallet - Balance: Rs. ${o.balance}`,
    fields: [
      F.decimal('balance', 'Balance', 12, 2, { default: '0.00' }),
      F.datetime('created_at', 'Created at', { auto: true }),
      F.datetime('updated_at', 'Updated at', { auto: true }),
    ],
    list_display: [col('balance'), col('created_at'), col('updated_at')],
    readonly_fields: ['created_at', 'updated_at'],
    actions: [...EXPORTS],
    media_css: [ADMIN_PATCH_CSS],
    native_datetime: true,
    perms: {
      add: async () => (await PehchanWallet.count()) === 0,
      delete: async () => false,
    },
  },

  // =========================== WalletTransaction ===========================
  {
    app_label: 'pehchan',
    model_name: 'wallettransaction',
    object_name: 'WalletTransaction',
    Model: WalletTransaction,
    verbose_name: 'wallet transaction',
    verbose_name_plural: 'wallet transactions',
    str: (o) => `WalletTransaction object (${o.id})`,
    include: [
      { model: PehchanWallet, as: 'wallet' },
      { model: MoneyDonation, as: 'related_donation', include: [userInc()] },
      { model: Expense, as: 'related_expense' },
    ],
    fields: [
      F.fk('wallet', 'Wallet', 'pehchan.pehchanwallet', 'wallet'),
      F.decimal('amount', 'Amount', 12, 2),
      F.choice('transaction_type', 'Transaction type', TRANSACTION_TYPES),
      F.text('description', 'Description', { blank: true }),
      F.fk('related_donation', 'Related donation', 'pehchan.moneydonation', 'related_donation', { blank: true, null: true }),
      F.fk('related_expense', 'Related expense', 'pehchan.expense', 'related_expense', { blank: true, null: true }),
      F.decimal('balance_after_transaction', 'Balance after transaction', 12, 2),
      F.datetime('created_at', 'Created at', { auto: true }),
    ],
    list_display: [col('transaction_type'), col('amount'), col('description'), col('balance_after_transaction'), col('created_at')],
    list_filter: [{ field: 'transaction_type' }, { field: 'created_at', kind: 'date' }],
    search_fields: ['description'],
    readonly_fields: ['wallet', 'amount', 'transaction_type', 'description', 'related_donation', 'related_expense', 'balance_after_transaction', 'created_at'],
    date_hierarchy: 'created_at',
    model_ordering: [['created_at', 'DESC']],
    actions: [...EXPORTS],
    perms: { add: async () => false, change: async () => false },
  },

  // ================================ Expense ================================
  {
    app_label: 'pehchan',
    model_name: 'expense',
    object_name: 'Expense',
    Model: Expense,
    verbose_name: 'expense',
    verbose_name_plural: 'expenses',
    str: (o) => `${o.title} - ₹${o.amount}`,
    include: [userInc('created_by'), userInc('approved_by')],
    fields: [
      F.char('title', 'Title', 200),
      F.text('description', 'Description', { blank: true }),
      F.choice('category', 'Category', EXPENSE_CATEGORY_CHOICES, { default: 'other' }),
      F.decimal('amount', 'Amount', 10, 2),
      F.date('date', 'Date'),
      F.file('receipt', 'Receipt', 'expenses', { blank: true, null: true }),
      F.fk('created_by', 'Created by', 'auth.user', 'created_by', { null: true }),
      F.fk('approved_by', 'Approved by', 'auth.user', 'approved_by', { blank: true, null: true }),
      F.datetime('approved_at', 'Approved at', { blank: true, null: true, native: true }),
      F.datetime('created_at', 'Created at', { auto: true }),
      F.datetime('updated_at', 'Updated at', { auto: true }),
    ],
    list_display: [col('title'), col('category'), col('amount'), col('date'), col('approved_by'), col('created_at')],
    list_filter: [{ field: 'category' }, { field: 'date', kind: 'date' }, { field: 'approved_by' }],
    search_fields: ['title', 'description'],
    readonly_fields: ['created_at', 'updated_at'],
    model_ordering: [['date', 'DESC'], ['created_at', 'DESC']],
    actions: [...EXPORTS],
    media_css: [ADMIN_PATCH_CSS],
    fieldsets: [
      ['Expense Details', { fields: ['title', 'description', 'category', 'amount', 'date'] }],
      ['Documentation', { fields: ['receipt'] }],
      ['Approval', { fields: ['approved_by', 'approved_at'] }],
      ['Metadata', { fields: ['created_by', 'created_at', 'updated_at'], classes: ['collapse'] }],
    ],
  },

  // =========================== AnonymousDonation ===========================
  {
    app_label: 'pehchan',
    model_name: 'anonymousdonation',
    object_name: 'AnonymousDonation',
    Model: AnonymousDonation,
    verbose_name: 'Anonymous Donation',
    verbose_name_plural: 'Anonymous Donations',
    str: (o) => `${o.donor_name ? o.donor_name : 'Anonymous'} - Rs. ${o.amount} - ${utcStamp(o.created_at)}`,
    fields: [
      F.char('donor_name', 'Donor name', 200, { blank: true, null: true }),
      F.email('donor_email', 'Donor email', { blank: true, null: true }),
      F.char('donor_phone', 'Donor phone', 20, { blank: true, null: true }),
      F.decimal('amount', 'Amount', 10, 2),
      F.char('transaction_id', 'Transaction id', 100, { blank: true, null: true }),
      F.file('receipt', 'Receipt', 'anonymous_donation_receipts', { blank: true, null: true, validators: [validateReceiptFile] }),
      F.bool('wants_receipt', 'Wants receipt'),
      F.text('message', 'Message', { blank: true, null: true }),
      F.bool('google_form_submitted', 'Google form submitted'),
      F.datetime('created_at', 'Created at', { auto: true }),
      F.ip('ip_address', 'Ip address', { blank: true, null: true }),
    ],
    list_display: [
      custom('get_donor_name', 'Donor Name', (o) => ({ type: 'text', text: o.donor_name ? o.donor_name : 'Anonymous' }), { order_field: 'donor_name' }),
      col('amount'),
      col('transaction_id'),
      custom('has_receipt', 'Receipt Uploaded', (o) => ({ type: 'text', text: o.receipt ? 'Yes' : 'No' }), { order_field: 'receipt' }),
      col('wants_receipt'),
      col('google_form_submitted'),
      col('created_at'),
    ],
    list_filter: [
      { field: 'wants_receipt' },
      { field: 'google_form_submitted' },
      { field: 'created_at', kind: 'date' },
      { field: 'created_at', kind: 'date' },
    ],
    search_fields: ['donor_name', 'donor_email', 'donor_phone', 'transaction_id', 'message'],
    readonly_fields: ['created_at', 'ip_address'],
    actions: [...EXPORTS],
    media_css: [ADMIN_PATCH_CSS],
    fieldsets: [
      ['Donor Information (Optional)', { fields: ['donor_name', 'donor_email', 'donor_phone'] }],
      ['Donation Details', { fields: ['amount', 'transaction_id', 'message'] }],
      ['Receipt & Form', { fields: ['receipt', 'wants_receipt', 'google_form_submitted'] }],
      ['Metadata', { fields: ['ip_address', 'created_at'], classes: ['collapse'] }],
    ],
    date_hierarchy: 'created_at',
    ordering: [['created_at', 'DESC']],
  },
];

// ---------------------------------------------------------------------------
export const APPS = {
  auth: { app_label: 'auth', name: 'Authentication and Authorization' },
  pehchan: { app_label: 'pehchan', name: 'Pehchan' },
};

export const byKey = new Map(registry.map((r) => [`${r.app_label}.${r.model_name}`, r]));

export function getAdmin(app, model) {
  return byKey.get(`${app}.${model}`) || null;
}

export function getField(admin, name) {
  return admin.fields.find((f) => f.name === name) || null;
}

/** __str__ of an instance of the model registered under `key` */
export function strOf(key, obj) {
  const admin = byKey.get(key);
  if (!obj) return '';
  return admin ? admin.str(obj) : String(obj.id);
}

export { esc, dateFormat };
export default registry;
