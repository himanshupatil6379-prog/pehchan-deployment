/**
 * Field specifications for the admin (mirror of the Django model fields) and
 * the generic value <-> form conversions.
 */
import { dateFormat, DATE_FORMAT, DATETIME_FORMAT, toLocalParts } from '../../shared/dateformat.js';
import {
  ValidationError,
  MSG,
  cleanChar,
  cleanEmail,
  cleanInt,
  cleanDecimal,
  cleanDate,
  cleanDateTime,
  cleanBool,
  cleanChoice,
} from '../utils/forms.js';
import { mediaUrl, validateFileField, validateImageFile } from '../utils/uploads.js';

/** Field factory helpers. `blank:true` makes the form field optional. */
export const F = {
  char: (name, label, max_length, o = {}) => ({ name, label, type: 'char', max_length, ...o }),
  email: (name, label, o = {}) => ({ name, label, type: 'email', max_length: 254, ...o }),
  text: (name, label, o = {}) => ({ name, label, type: 'text', ...o }),
  int: (name, label, o = {}) => ({ name, label, type: 'int', ...o }),
  decimal: (name, label, max_digits, decimal_places, o = {}) => ({ name, label, type: 'decimal', max_digits, decimal_places, ...o }),
  date: (name, label, o = {}) => ({ name, label, type: 'date', ...o }),
  datetime: (name, label, o = {}) => ({ name, label, type: 'datetime', ...o }),
  bool: (name, label, o = {}) => ({ name, label, type: 'bool', blank: true, ...o }),
  choice: (name, label, choices, o = {}) => ({ name, label, type: 'select', choices, ...o }),
  fk: (name, label, related, as, o = {}) => ({ name, label, type: 'fk', related, as, column: `${name}_id`, ...o }),
  file: (name, label, upload_to, o = {}) => ({ name, label, type: 'file', upload_to, ...o }),
  image: (name, label, upload_to, o = {}) => ({ name, label, type: 'image', upload_to, ...o }),
  ip: (name, label, o = {}) => ({ name, label, type: 'ip', max_length: 39, ...o }),
};

export const EMPTY = '-';

const iso = (v) => (v instanceof Date ? v.toISOString() : v);

/** Raw attribute value of a field on an instance */
export function rawValue(spec, obj) {
  if (spec.type === 'fk') return obj[spec.column];
  return obj[spec.name];
}

/** display_for_field() – text shown in change lists / read-only fields */
export function displayValue(spec, obj, strOf) {
  const v = rawValue(spec, obj);
  if (spec.choices && spec.type !== 'fk') {
    const found = spec.choices.find(([val]) => String(val) === String(v));
    if (found) return found[1];
    if (v === null || v === undefined || v === '') return EMPTY;
    return String(v);
  }
  if (v === null || v === undefined) return EMPTY;
  switch (spec.type) {
    case 'bool':
      return v ? 'True' : 'False';
    case 'date':
      return dateFormat(v, DATE_FORMAT);
    case 'datetime':
      return dateFormat(v, DATETIME_FORMAT);
    case 'fk': {
      const rel = obj[spec.as];
      return rel ? strOf(spec.related, rel) : String(v);
    }
    case 'file':
    case 'image':
      return v || EMPTY;
    default:
      return String(v);
  }
}

/** Initial/current value sent to the change form */
export function formValue(spec, obj) {
  const v = obj ? rawValue(spec, obj) : spec.default !== undefined ? (typeof spec.default === 'function' ? spec.default() : spec.default) : undefined;
  if (v === undefined || v === null) {
    if (spec.type === 'bool') return false;
    if (spec.type === 'datetime') return { date: '', time: '' };
    if (spec.type === 'file' || spec.type === 'image') return null;
    return '';
  }
  switch (spec.type) {
    case 'bool':
      return !!v;
    case 'datetime': {
      const p = toLocalParts(iso(v));
      if (!p) return { date: '', time: '' };
      const pad = (n) => String(n).padStart(2, '0');
      return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.H)}:${pad(p.i)}:${pad(p.s)}` };
    }
    case 'file':
    case 'image':
      return { name: v, url: mediaUrl(v) };
    case 'fk':
      return String(v);
    default:
      return String(v);
  }
}

/**
 * Clean a submitted value for a field (Django form field + model field validation).
 * `body` is the parsed multipart body, `files` the uploaded files.
 * Returns { value, file?, clear? } – files are saved later by the caller.
 */
export async function cleanFieldValue(spec, body, getFile, fkExists) {
  const required = !spec.blank;
  const raw = body[spec.name];
  let value;
  switch (spec.type) {
    case 'char':
    case 'ip':
      value = cleanChar(raw, { required, maxLength: spec.max_length });
      if (!value && spec.null) value = null;
      break;
    case 'email':
      value = cleanEmail(raw, { required, maxLength: spec.max_length });
      if (!value && spec.null) value = null;
      break;
    case 'text':
      value = cleanChar(raw, { required, strip: true });
      if (!value && spec.null) value = null;
      break;
    case 'int':
      value = cleanInt(raw, { required, minValue: spec.min_value });
      break;
    case 'decimal':
      value = cleanDecimal(raw, { required, maxDigits: spec.max_digits, decimalPlaces: spec.decimal_places, minValue: spec.min_value });
      break;
    case 'date':
      value = cleanDate(raw, { required });
      break;
    case 'datetime':
      value = cleanDateTime(body[`${spec.name}_0`], body[`${spec.name}_1`], { required });
      break;
    case 'bool':
      value = cleanBool(raw);
      break;
    case 'select':
      value = cleanChoice(raw, spec.choices, { required });
      if (!value && spec.null) value = null;
      break;
    case 'fk': {
      const v = raw === undefined || raw === null ? '' : String(raw).trim();
      if (!v) {
        if (required) throw new ValidationError(MSG.required);
        value = null;
      } else {
        if (!/^\d+$/.test(v) || !(await fkExists(spec.related, Number(v)))) throw new ValidationError(MSG.invalidFkChoice);
        value = Number(v);
      }
      break;
    }
    case 'file':
    case 'image': {
      const file = getFile(spec.name);
      const clear = cleanBool(body[`${spec.name}-clear`]);
      if (file) {
        if (spec.type === 'image') validateImageFile(file);
        else validateFileField(file);
        (spec.validators || []).forEach((fn) => fn(file));
        return { file };
      }
      if (clear) {
        if (required) throw new ValidationError(MSG.required);
        return { clear: true };
      }
      return { keep: true };
    }
    default:
      value = raw;
  }
  if (value !== null && value !== '' && value !== undefined && spec.validators && spec.type !== 'file' && spec.type !== 'image') {
    for (const fn of spec.validators) fn(value);
  }
  return { value };
}
