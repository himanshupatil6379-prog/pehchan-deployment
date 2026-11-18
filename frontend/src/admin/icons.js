/**
 * Material Icons Round names + status tones used by the M3 admin UI.
 * Pure presentation helpers – no data or behaviour lives here.
 */

export const BRAND_LOGO = '/static/images/logos/roundlogo.png';

const MODEL_ICONS = {
  'auth.user': 'group',
  'auth.group': 'groups',
  'pehchan.anonymousdonation': 'volunteer_activism',
  'pehchan.certificate': 'workspace_premium',
  'pehchan.contactmessage': 'mail',
  'pehchan.donorcertificate': 'card_membership',
  'pehchan.eventvolunteer': 'diversity_3',
  'pehchan.event': 'event',
  'pehchan.expense': 'receipt_long',
  'pehchan.lifetimevolunteer': 'military_tech',
  'pehchan.materialdonation': 'inventory_2',
  'pehchan.moneydonation': 'payments',
  'pehchan.pehchanwallet': 'account_balance_wallet',
  'pehchan.wallettransaction': 'swap_horiz',
};

const APP_ICONS = {
  auth: 'admin_panel_settings',
  pehchan: 'diversity_1',
};

/** Lower-case model name of an app_list model entry. */
export function modelKey(model) {
  return String((model && (model.model || model.object_name)) || '').toLowerCase();
}

export function modelIcon(appLabel, modelName) {
  return MODEL_ICONS[`${appLabel}.${String(modelName || '').toLowerCase()}`] || 'table_rows';
}

export function appIcon(appLabel) {
  return APP_ICONS[appLabel] || 'apps';
}

/** django.contrib.messages level → md-alert tone + icon. */
export function messageTone(level) {
  const l = String(level || 'info').toLowerCase();
  if (l.includes('success')) return { tone: 'success', icon: 'check_circle' };
  if (l.includes('error') || l.includes('danger')) return { tone: 'error', icon: 'error' };
  if (l.includes('warning')) return { tone: 'warning', icon: 'warning' };
  return { tone: 'info', icon: 'info' };
}

/** docs/DESIGN_SYSTEM.md "Status → chip mapping". */
const STATUS_TONES = {
  approved: 'success',
  verified: 'success',
  received: 'success',
  replied: 'success',
  completed: 'success',
  active: 'success',
  issued: 'success',
  credit: 'success',
  pending: 'warning',
  unverified: 'warning',
  new: 'warning',
  upcoming: 'info',
  rejected: 'error',
  declined: 'error',
  inactive: 'error',
  cancelled: 'error',
  canceled: 'error',
  failed: 'error',
  debit: 'error',
  processed: 'primary',
  read: 'primary',
  ongoing: 'primary',
  archived: 'neutral',
  other: 'neutral',
};

/** Chip tone for a status-like text value, or null when it is not a known status. */
export function statusTone(text) {
  const key = String(text == null ? '' : text)
    .trim()
    .toLowerCase();
  return Object.prototype.hasOwnProperty.call(STATUS_TONES, key) ? STATUS_TONES[key] : null;
}

/** Columns whose plain-text values are rendered as status chips. */
export function isStatusColumn(col) {
  if (!col) return false;
  return /(^|_)(status|state|type)$/i.test(String(col.key || '')) || /\bstatus\b/i.test(String(col.label || ''));
}
