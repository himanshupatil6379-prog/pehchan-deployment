/** Small helpers shared by the admin pages (ports of Django template filters etc.). */

export const SERVER_UTC_OFFSET = 19800; // Asia/Kolkata, seconds ({% now "Z" %})

export function capfirst(value) {
  const s = value == null ? '' : String(value);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Django's truncatewords filter. */
export function truncatewords(value, n = 18) {
  const s = value == null ? '' : String(value);
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length <= n) return s;
  return `${words.slice(0, n).join(' ')} …`;
}

export function pluralize(count, singular, plural) {
  return Number(count) === 1 ? singular : plural;
}

/** Path + query of the current location (request.get_full_path()). */
export function fullPath(location) {
  return `${location.pathname}${location.search || ''}`;
}

/** API URL for an admin page: "/api" + page path, query forwarded unchanged. */
export function apiPathFor(location) {
  return `/api${location.pathname}${location.search || ''}`;
}

export function loginUrl(location) {
  return `/admin/login/?next=${encodeURIComponent(fullPath(location))}`;
}

/** Only allow local redirect targets (url_has_allowed_host_and_scheme). */
export function safeNext(next, fallback = '/admin/') {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}

/** Resolve a changelist query ("?o=1", "?", "") against the current path. */
export function queryHref(pathname, query) {
  if (query == null) return pathname;
  const q = String(query);
  if (q.startsWith('/') || /^https?:/.test(q)) return q;
  if (q === '' || q === '?') return pathname;
  return `${pathname}${q.startsWith('?') ? q : `?${q}`}`;
}

/** {% add_preserved_filters url %} */
export function withPreservedFilters(url, search) {
  if (!url) return url;
  const params = new URLSearchParams(search || '');
  const preserved = params.get('_changelist_filters');
  if (!preserved) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_changelist_filters=${encodeURIComponent(preserved)}`;
}

/** App verbose name from the cached app_list (falls back to a capitalised label). */
export function appVerboseName(appList, appLabel) {
  const app = (appList || []).find((a) => a.app_label === appLabel);
  if (app) return app.name;
  if (appLabel === 'auth') return 'Authentication and Authorization';
  return capfirst(appLabel);
}

/** Model entry ({ name, admin_url, … }) from the cached app_list. */
export function findModel(appList, appLabel, model) {
  const app = (appList || []).find((a) => a.app_label === appLabel);
  if (!app) return null;
  return (
    app.models.find((m) => (m.model || String(m.object_name || '').toLowerCase()) === model) ||
    app.models.find((m) => m.admin_url === `/admin/${appLabel}/${model}/`) ||
    null
  );
}

export function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

/** DateTimeShortcuts.now(): the current time expressed in the server timezone. */
export function serverNow() {
  const local = new Date();
  const localOffset = local.getTimezoneOffset() * -60;
  local.setTime(local.getTime() + 1000 * (SERVER_UTC_OFFSET - localOffset));
  return local;
}

/** strftime('%Y-%m-%d') */
export function formatDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** strftime('%H:%M:%S') */
export function formatTimeInput(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** String.prototype.strptime('%Y-%m-%d') from core.js (returns a UTC date). */
export function parseDateInput(value) {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(value || '');
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_AP = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Parse an ISO string into a Date whose UTC getters give Asia/Kolkata wall time. */
function toServerWallClock(value) {
  if (value == null || value === '') return null;
  const s = String(value);
  if (!ISO_RE.test(s)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(s);
  const t = new Date(hasZone ? s : `${s.replace(' ', 'T')}+05:30`);
  if (Number.isNaN(t.getTime())) return null;
  return new Date(t.getTime() + SERVER_UTC_OFFSET * 1000);
}

/** Django "P" format: "7:03 p.m.", "7 a.m.", "midnight", "noon". */
function formatP(d) {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (m === 0 && h === 0) return 'midnight';
  if (m === 0 && h === 12) return 'noon';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'a.m.' : 'p.m.';
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${pad(m)} ${ampm}`;
}

/** DATETIME_FORMAT "N j, Y, P" – strings that are not ISO dates are returned unchanged. */
export function formatDateTime(value) {
  const d = toServerWallClock(value);
  if (!d) return value == null ? '' : String(value);
  return `${MONTHS_AP[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${formatP(d)}`;
}

/** |date:"F d, Y" */
export function formatLongDate(value) {
  const d = toServerWallClock(value);
  if (!d) return value == null ? '' : String(value);
  return `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())}, ${d.getUTCFullYear()}`;
}

/** Normalise an API message list for the messages queue. */
export function normalizeMessages(list) {
  return (list || []).map((m) => (typeof m === 'string' ? { level: 'info', text: m } : m));
}

/** Read the name/value of the button that submitted a form (with a fallback for old browsers). */
export function submitterOf(event, form) {
  const native = event.nativeEvent || event;
  let btn = native.submitter || null;
  if (!btn && form) btn = form.querySelector('[type=submit]');
  return btn;
}

/** FormData of a <form> including the clicked submit button. */
export function formDataWithSubmitter(form, submitter) {
  const fd = new FormData(form);
  // browsers send an empty part for <input type=file> without a selection; Django ignores it
  const emptyFiles = [];
  fd.forEach((v, k) => {
    if (typeof File !== 'undefined' && v instanceof File && !v.name && v.size === 0) emptyFiles.push(k);
  });
  emptyFiles.forEach((k) => fd.delete(k));
  if (submitter && submitter.name) fd.append(submitter.name, submitter.value || '');
  return fd;
}
