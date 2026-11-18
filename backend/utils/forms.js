/**
 * Minimal port of django.forms field cleaning, producing the exact Django
 * validation messages. Used by the public views and the admin.
 */

export class FormErrors {
  constructor() {
    this.errors = {};
  }
  add(field, message) {
    const key = field || '__all__';
    if (!this.errors[key]) this.errors[key] = [];
    if (Array.isArray(message)) this.errors[key].push(...message);
    else this.errors[key].push(message);
  }
  has(field) {
    return !!this.errors[field || '__all__'];
  }
  get isValid() {
    return Object.keys(this.errors).length === 0;
  }
  toJSON() {
    return this.errors;
  }
}

export class ValidationError extends Error {
  constructor(messages) {
    super(Array.isArray(messages) ? messages.join(' ') : messages);
    this.messages = Array.isArray(messages) ? messages : [messages];
  }
}

export const MSG = {
  required: 'This field is required.',
  invalidEmail: 'Enter a valid email address.',
  invalidInt: 'Enter a whole number.',
  invalidNumber: 'Enter a number.',
  invalidDate: 'Enter a valid date.',
  invalidTime: 'Enter a valid time.',
  invalidDateTime: 'Enter a valid date/time.',
  invalidChoice: (v) => `Select a valid choice. ${v} is not one of the available choices.`,
  invalidFkChoice: 'Select a valid choice. That choice is not one of the available choices.',
  maxLength: (max, len) => `Ensure this value has at most ${max} character${max === 1 ? '' : 's'} (it has ${len}).`,
  minLength: (min, len) => `Ensure this value has at least ${min} character${min === 1 ? '' : 's'} (it has ${len}).`,
  minValue: (v) => `Ensure this value is greater than or equal to ${v}.`,
  maxValue: (v) => `Ensure this value is less than or equal to ${v}.`,
  maxDigits: (n) => `Ensure that there are no more than ${n} digit${n === 1 ? '' : 's'} in total.`,
  maxDecimalPlaces: (n) => `Ensure that there are no more than ${n} decimal place${n === 1 ? '' : 's'}.`,
  maxWholeDigits: (n) => `Ensure that there are no more than ${n} digit${n === 1 ? '' : 's'} before the decimal point.`,
};

// Django EmailValidator (simplified but equivalent for practical input)
const EMAIL_RE =
  /^(?:[-!#$%&'*+/=?^_`{}|~0-9A-Za-z]+(?:\.[-!#$%&'*+/=?^_`{}|~0-9A-Za-z]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f!#-\[\]-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9-]{2,63}(?<!-)|\[(?:\d{1,3}\.){3}\d{1,3}\])$/;

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || ''));
}

const str = (v) => (v === undefined || v === null ? '' : String(v));

/** forms.CharField */
export function cleanChar(raw, { required = true, maxLength, minLength, strip = true } = {}) {
  let v = str(raw);
  if (strip) v = v.trim();
  if (!v) {
    if (required) throw new ValidationError(MSG.required);
    return '';
  }
  const errs = [];
  if (maxLength && v.length > maxLength) errs.push(MSG.maxLength(maxLength, v.length));
  if (minLength && v.length < minLength) errs.push(MSG.minLength(minLength, v.length));
  if (errs.length) throw new ValidationError(errs);
  return v;
}

/** forms.EmailField */
export function cleanEmail(raw, { required = true, maxLength = 254 } = {}) {
  const v = cleanChar(raw, { required, maxLength: undefined });
  if (!v) return v;
  const errs = [];
  if (!isValidEmail(v)) errs.push(MSG.invalidEmail);
  if (maxLength && v.length > maxLength) errs.push(MSG.maxLength(maxLength, v.length));
  if (errs.length) throw new ValidationError(errs);
  return v;
}

/** forms.IntegerField */
export function cleanInt(raw, { required = true, minValue, maxValue } = {}) {
  const v = str(raw).trim();
  if (!v) {
    if (required) throw new ValidationError(MSG.required);
    return null;
  }
  if (!/^[-+]?\d+(\.0*)?$/.test(v)) throw new ValidationError(MSG.invalidInt);
  const n = parseInt(v, 10);
  if (minValue !== undefined && n < minValue) throw new ValidationError(MSG.minValue(minValue));
  if (maxValue !== undefined && n > maxValue) throw new ValidationError(MSG.maxValue(maxValue));
  return n;
}

/** forms.DecimalField -> returns normalized string with `decimalPlaces` places */
export function cleanDecimal(raw, { required = true, maxDigits = 10, decimalPlaces = 2, minValue } = {}) {
  const v = str(raw).trim();
  if (!v) {
    if (required) throw new ValidationError(MSG.required);
    return null;
  }
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(v)) throw new ValidationError(MSG.invalidNumber);
  const negative = v.startsWith('-');
  const unsigned = v.replace(/^[-+]/, '');
  let [intPart, decPart = ''] = unsigned.split('.');
  intPart = intPart.replace(/^0+(?=\d)/, '') || '0';
  decPart = decPart.replace(/0+$/, '');
  const wholeDigits = intPart === '0' ? 0 : intPart.length;
  const digits = wholeDigits + decPart.length;
  const errs = [];
  if (digits > maxDigits) errs.push(MSG.maxDigits(maxDigits));
  else if (decPart.length > decimalPlaces) errs.push(MSG.maxDecimalPlaces(decimalPlaces));
  else if (wholeDigits > maxDigits - decimalPlaces) errs.push(MSG.maxWholeDigits(maxDigits - decimalPlaces));
  if (errs.length) throw new ValidationError(errs);
  const num = Number(`${negative ? '-' : ''}${intPart}.${decPart || '0'}`);
  if (minValue !== undefined && num < Number(minValue)) throw new ValidationError(MSG.minValue(minValue));
  return `${negative ? '-' : ''}${intPart}.${decPart.padEnd(decimalPlaces, '0')}`;
}

/** forms.DateField (accepts YYYY-MM-DD and the Django default input formats) */
export function cleanDate(raw, { required = true } = {}) {
  const v = str(raw).trim();
  if (!v) {
    if (required) throw new ValidationError(MSG.required);
    return null;
  }
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) {
    const m2 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/); // m/d/Y, m/d/y
    if (m2) m = [null, m2[3].length === 2 ? `20${m2[3]}` : m2[3], m2[1], m2[2]];
  }
  if (!m) throw new ValidationError(MSG.invalidDate);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) throw new ValidationError(MSG.invalidDate);
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * forms.SplitDateTimeField (admin date + time inputs) interpreted in Asia/Kolkata.
 * Returns a JS Date (UTC instant) or null.
 */
export function cleanDateTime(rawDate, rawTime, { required = true } = {}) {
  const d = str(rawDate).trim();
  const t = str(rawTime).trim();
  if (!d && !t) {
    if (required) throw new ValidationError(MSG.required);
    return null;
  }
  const errs = [];
  let date = null;
  let time = null;
  if (!d) errs.push('Enter a date.');
  else {
    try {
      date = cleanDate(d);
    } catch {
      errs.push(MSG.invalidDate);
    }
  }
  if (!t) errs.push('Enter a time.');
  else {
    const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59 || Number(m[3] || 0) > 59) errs.push(MSG.invalidTime);
    else time = [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
  }
  if (errs.length) throw new ValidationError(errs);
  const [y, mo, day] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, day, time[0], time[1], time[2]) - 330 * 60000);
}

/** forms.BooleanField(required=False) from a checkbox */
export function cleanBool(raw) {
  if (raw === true) return true;
  const v = str(raw).trim().toLowerCase();
  return !(v === '' || v === 'false' || v === '0' || v === 'off' || v === 'no');
}

/** forms.TypedChoiceField */
export function cleanChoice(raw, choices, { required = true } = {}) {
  const v = str(raw).trim();
  if (!v) {
    if (required) throw new ValidationError(MSG.required);
    return '';
  }
  if (!choices.some(([value]) => String(value) === v)) throw new ValidationError(MSG.invalidChoice(v));
  return v;
}

/** Runs a map of cleaners: { field: () => value }. Collects ValidationErrors. */
export function runCleaners(cleaners, errors = new FormErrors()) {
  const cleaned = {};
  for (const [field, fn] of Object.entries(cleaners)) {
    try {
      cleaned[field] = fn();
    } catch (err) {
      if (err instanceof ValidationError) errors.add(field, err.messages);
      else throw err;
    }
  }
  return { cleaned, errors };
}

// ---------------------------------------------------------------------------
// Project specific validators (pehchan/forms.py, pehchan/models.py)
// ---------------------------------------------------------------------------
export const FAKE_EMAIL_DOMAINS = ['tempmail.com', 'mailinator.com', '10minutemail.com', 'throwawaymail.com', 'fake.com', 'test.com'];

/** validate_indian_mobile_number() */
export function validateIndianMobileNumber(number) {
  const n = str(number).trim();
  if (!/^[6-9]\d{9}$/.test(n)) {
    throw new ValidationError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
  }
  if (new Set(n).size === 1) {
    throw new ValidationError('Please enter a valid mobile number, not a repeating digit pattern.');
  }
  const fake = ['1234567890', '9876543210', '9898989898', '9900990099', '9123456789'];
  if (fake.includes(n)) throw new ValidationError('Please enter your actual valid mobile number.');
  return n;
}

/** Contact-number field used by the volunteer/donation ModelForms (CharField max=10,min=10 + validator) */
export function cleanContactNumber(raw) {
  const v = cleanChar(raw, { required: true, maxLength: 10, minLength: 10 });
  return validateIndianMobileNumber(v);
}

/** Model-level RegexValidator for phone fields (admin forms) */
export function modelPhoneValidator(kind = 'indian') {
  return (value) => {
    if (kind === 'indian') {
      if (!/^[6-9]\d{9}$/.test(value)) {
        throw new ValidationError('Contact number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      }
    } else if (!/^\d{10}$/.test(value)) {
      throw new ValidationError('Contact number must be exactly 10 digits.');
    }
    return value;
  };
}

// Django UnicodeUsernameValidator
export function validateUsername(value) {
  if (!/^[\p{L}\p{N}_.@+-]+$/u.test(value)) {
    throw new ValidationError('Enter a valid username. This value may contain only letters, numbers, and @/./+/-/_ characters.');
  }
  return value;
}
