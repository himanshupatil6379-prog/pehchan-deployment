/**
 * Port of Django's `date` / `time` template filters (django.utils.dateformat).
 * Shared by the frontend (templates) and the backend (admin list display, exports).
 *
 * All datetimes are rendered in TIME_ZONE = 'Asia/Kolkata' (UTC+05:30, no DST),
 * whatever the timezone of the browser/server is – exactly like Django with USE_TZ=True.
 *
 *   dateFormat('2026-11-03', 'F d, Y')            -> "November 03, 2026"
 *   dateFormat('2026-11-17T13:33:00Z')            -> "Nov. 17, 2026"            (DATE_FORMAT)
 *   datetimeFormat('2026-11-17T13:33:00Z')        -> "Nov. 17, 2026, 7:03 p.m." (DATETIME_FORMAT)
 */

export const TZ_OFFSET_MINUTES = 330; // Asia/Kolkata
export const DATE_FORMAT = 'N j, Y';
export const DATETIME_FORMAT = 'N j, Y, P';
export const TIME_FORMAT = 'P';
export const SHORT_DATE_FORMAT = 'm/d/Y';
export const SHORT_DATETIME_FORMAT = 'm/d/Y P';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTHS_AP = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Parse a value into wall-clock parts in Asia/Kolkata. Returns null when invalid. */
export function toLocalParts(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return { y, m, d, H: 0, i: 0, s: 0, ms: 0, w: dt.getUTCDay(), isDateOnly: true, ts: dt.getTime() - TZ_OFFSET_MINUTES * 60000 };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    H: shifted.getUTCHours(),
    i: shifted.getUTCMinutes(),
    s: shifted.getUTCSeconds(),
    ms: shifted.getUTCMilliseconds(),
    w: shifted.getUTCDay(),
    isDateOnly: false,
    ts: date.getTime(),
  };
}

function ordinalSuffix(day) {
  if ([11, 12, 13].includes(day % 100)) return 'th';
  const last = day % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
}

function hour12(H) {
  const h = H % 12;
  return h === 0 ? 12 : h;
}

function fTime(p) {
  // 'f': Time, in 12-hour hours and minutes, with minutes left off if they're zero.
  const g = hour12(p.H);
  return p.i === 0 ? String(g) : `${g}:${pad(p.i)}`;
}

function PTime(p) {
  if (p.i === 0 && p.H === 0) return 'midnight';
  if (p.i === 0 && p.H === 12) return 'noon';
  return `${fTime(p)} ${p.H < 12 ? 'a.m.' : 'p.m.'}`;
}

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function dayOfYear(p) {
  const start = Date.UTC(p.y, 0, 1);
  const cur = Date.UTC(p.y, p.m - 1, p.d);
  return Math.floor((cur - start) / 86400000) + 1;
}

const FORMATTERS = {
  a: (p) => (p.H < 12 ? 'a.m.' : 'p.m.'),
  A: (p) => (p.H < 12 ? 'AM' : 'PM'),
  b: (p) => MONTHS_3[p.m - 1],
  c: (p) => `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.H)}:${pad(p.i)}:${pad(p.s)}+05:30`,
  d: (p) => pad(p.d),
  D: (p) => WEEKDAYS_ABBR[p.w],
  e: () => 'Asia/Kolkata',
  E: (p) => MONTHS[p.m - 1],
  f: (p) => fTime(p),
  F: (p) => MONTHS[p.m - 1],
  g: (p) => String(hour12(p.H)),
  G: (p) => String(p.H),
  h: (p) => pad(hour12(p.H)),
  H: (p) => pad(p.H),
  i: (p) => pad(p.i),
  I: () => '0',
  j: (p) => String(p.d),
  l: (p) => WEEKDAYS[p.w],
  L: (p) => (isLeap(p.y) ? 'True' : 'False'),
  m: (p) => pad(p.m),
  M: (p) => MONTHS[p.m - 1].slice(0, 3),
  n: (p) => String(p.m),
  N: (p) => MONTHS_AP[p.m - 1],
  o: (p) => String(p.y),
  O: () => '+0530',
  P: (p) => PTime(p),
  r: (p) => `${WEEKDAYS_ABBR[p.w]}, ${pad(p.d)} ${MONTHS[p.m - 1].slice(0, 3)} ${p.y} ${pad(p.H)}:${pad(p.i)}:${pad(p.s)} +0530`,
  s: (p) => pad(p.s),
  S: (p) => ordinalSuffix(p.d),
  t: (p) => String(new Date(Date.UTC(p.y, p.m, 0)).getUTCDate()),
  T: () => 'IST',
  u: (p) => pad(p.ms * 1000, 6),
  U: (p) => String(Math.floor(p.ts / 1000)),
  w: (p) => String(p.w),
  W: (p) => {
    const target = new Date(Date.UTC(p.y, p.m - 1, p.d));
    const dayNr = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    return String(1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7));
  },
  y: (p) => pad(p.y % 100),
  Y: (p) => String(p.y),
  z: (p) => String(dayOfYear(p)),
  Z: () => '19800',
};

/** Django `|date:"fmt"` filter. Returns '' for empty / invalid values. */
export function dateFormat(value, fmt = DATE_FORMAT) {
  const p = toLocalParts(value);
  if (!p) return '';
  let out = '';
  for (let idx = 0; idx < fmt.length; idx++) {
    const ch = fmt[idx];
    if (ch === '\\') {
      idx += 1;
      if (idx < fmt.length) out += fmt[idx];
      continue;
    }
    const f = FORMATTERS[ch];
    out += f ? f(p) : ch;
  }
  return out;
}

/** `{{ datetime }}` rendered with DATETIME_FORMAT. */
export function datetimeFormat(value, fmt = DATETIME_FORMAT) {
  return dateFormat(value, fmt);
}

/** `{{ value|time }}` */
export function timeFormat(value, fmt = TIME_FORMAT) {
  return dateFormat(value, fmt);
}

/** Today's date (YYYY-MM-DD) in Asia/Kolkata. */
export function todayISO(now = new Date()) {
  const p = toLocalParts(now);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Django `|timesince` (e.g. "2 days, 3 hours"). */
export function timesince(value, now = new Date()) {
  const p = toLocalParts(value);
  if (!p) return '';
  let delta = Math.floor((now.getTime() - p.ts) / 1000);
  if (delta <= 0) return '0 minutes';
  const chunks = [
    [60 * 60 * 24 * 365, 'year', 'years'],
    [60 * 60 * 24 * 30, 'month', 'months'],
    [60 * 60 * 24 * 7, 'week', 'weeks'],
    [60 * 60 * 24, 'day', 'days'],
    [60 * 60, 'hour', 'hours'],
    [60, 'minute', 'minutes'],
  ];
  const parts = [];
  for (const [secs, one, many] of chunks) {
    const count = Math.floor(delta / secs);
    if (count > 0 || parts.length) {
      if (count > 0) parts.push(`${count} ${count === 1 ? one : many}`);
      delta -= count * secs;
      if (parts.length === 2 || (parts.length === 1 && count === 0)) break;
    }
  }
  return parts.length ? parts.slice(0, 2).join(', ') : '0 minutes';
}
