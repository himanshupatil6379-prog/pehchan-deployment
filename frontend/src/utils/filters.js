/**
 * Ports of the Django template filters used by the original templates.
 * Date filters live in /shared/dateformat.js and are re-exported here.
 */
import { Fragment, createElement } from 'react';

export { dateFormat, datetimeFormat, timeFormat, timesince, todayISO, toLocalParts } from '../../../shared/dateformat.js';

/** |truncatechars:n */
export function truncatechars(value, n) {
  const s = value == null ? '' : String(value);
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)) + '…';
}

/** |truncatewords:n */
export function truncatewords(value, n) {
  const s = value == null ? '' : String(value);
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length <= n) return words.join(' ');
  return words.slice(0, n).join(' ') + ' …';
}

/** |linebreaksbr -> React nodes with <br/> between lines */
export function linebreaksbr(value) {
  const s = value == null ? '' : String(value);
  const lines = s.replace(/\r\n|\r/g, '\n').split('\n');
  return lines.map((line, i) => createElement(Fragment, { key: i }, line, i < lines.length - 1 ? createElement('br') : null));
}

/** |linebreaks -> React <p> paragraphs with <br/> inside */
export function linebreaks(value) {
  const s = value == null ? '' : String(value);
  const paras = s.replace(/\r\n|\r/g, '\n').split(/\n{2,}/);
  return paras.map((p, i) => createElement('p', { key: i }, linebreaksbr(p)));
}

/** |floatformat[:arg] */
export function floatformat(value, arg = -1) {
  const num = Number(value);
  if (value === null || value === undefined || value === '' || Number.isNaN(num)) return '';
  const places = Math.abs(Number(arg));
  const fixed = num.toFixed(places);
  if (Number(arg) < 0 && Number(fixed) === Math.trunc(num) && Number.isInteger(Number(fixed))) {
    return String(Math.round(num));
  }
  return fixed;
}

/** humanize |intcomma (international grouping, like Django: 45000 -> 45,000) */
export function intcomma(value) {
  if (value === null || value === undefined || value === '') return '';
  const [int, dec] = String(value).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
}

/** |pluralize[:"suffix"] */
export function pluralize(count, suffix = 's') {
  const n = Array.isArray(count) ? count.length : Number(count);
  const [singular, plural] = suffix.includes(',') ? suffix.split(',') : ['', suffix];
  return n === 1 ? singular : plural;
}

/** |default:"x" */
export function defaultFilter(value, fallback) {
  return value === null || value === undefined || value === '' || value === false ? fallback : value;
}

/** |title */
export function title(value) {
  const s = value == null ? '' : String(value);
  const t = s.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return t.replace(/([a-z])'([A-Z])/g, (m) => m.toLowerCase()).replace(/\d([A-Z])/g, (m) => m.toLowerCase());
}

/** |capfirst */
export function capfirst(value) {
  const s = value == null ? '' : String(value);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** |slugify */
export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '-');
}

/** Months list used by certificate list filters */
export const MONTHS = [
  ['1', 'January'], ['2', 'February'], ['3', 'March'], ['4', 'April'],
  ['5', 'May'], ['6', 'June'], ['7', 'July'], ['8', 'August'],
  ['9', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
];
