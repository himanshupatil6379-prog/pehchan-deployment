/**
 * ModelAdmin changeform_view / delete_view / history_view port.
 */
import { Op } from 'sequelize';
import sequelize from '../db.js';
import { getField, strOf, byKey } from './registry.js';
import { displayValue, formValue, cleanFieldValue, EMPTY } from './fields.js';
import { FormErrors, ValidationError, cleanChar } from '../utils/forms.js';
import { saveUpload, mediaUrl } from '../utils/uploads.js';
import { makePassword, validatePassword, passwordSummary, PASSWORD_HELP_TEXTS } from '../utils/passwords.js';
import { AdminLog, User, PasswordResetOTP } from '../models/index.js';
import { capfirst } from './changelist.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const ADDITION = 1;
export const CHANGE = 2;
export const DELETION = 3;

export async function logAction(user, admin, obj, flag, message = '') {
  try {
    await AdminLog.create({
      user_id: user.id,
      content_type: `${admin.app_label}.${admin.model_name}`,
      object_id: String(obj.id),
      object_repr: String(admin.str(obj)).slice(0, 200),
      action_flag: flag,
      change_message: message,
    });
  } catch (e) {
    console.error('Admin log failed:', e.message);
  }
}

/** "Changed Status and Attended." */
export function changeMessage(labels) {
  if (!labels.length) return 'No fields changed.';
  const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `Changed ${list}.`;
}

export async function loadObject(admin, id) {
  if (!/^\d+$/.test(String(id))) return null;
  return admin.Model.findByPk(Number(id), { include: admin.include || [] });
}

// ---------------------------------------------------------------------------
// Form layout
// ---------------------------------------------------------------------------
function readonlySet(admin, perms, obj) {
  const set = new Set(admin.readonly_fields || []);
  // view-only: everything is read-only
  if ((obj && !perms.has_change) || (!obj && !perms.has_add)) {
    admin.fields.forEach((f) => set.add(f.name));
    Object.keys(admin.computed_readonly || {}).forEach((k) => set.add(k));
  }
  return set;
}

function defaultFieldNames(admin, ro) {
  const editable = admin.fields.filter((f) => !f.auto && !ro.has(f.name)).map((f) => f.name);
  return [...editable, ...(admin.readonly_fields || [])];
}

export function getFieldsets(admin, perms, obj) {
  const ro = readonlySet(admin, perms, obj);
  if (admin.special === 'user' && !obj) return { fieldsets: admin.add_fieldsets, ro };
  if (admin.fieldsets) return { fieldsets: admin.fieldsets, ro };
  const names = defaultFieldNames(admin, ro);
  return { fieldsets: [[null, { fields: names }]], ro };
}

async function fkChoices(spec, required, currentValue) {
  const rel = byKey.get(spec.related);
  const order = rel.ordering || rel.model_ordering || [['id', 'ASC']];
  const objects = await rel.Model.findAll({ include: rel.include || [], order });
  const choices = objects.map((o) => [String(o.id), strOf(spec.related, o)]);
  const hasInitial = currentValue !== '' && currentValue !== null && currentValue !== undefined;
  if (!(required && hasInitial)) choices.unshift(['', '---------']);
  return choices;
}

function readonlyField(admin, name, obj) {
  const computed = (admin.computed_readonly || {})[name];
  if (computed) {
    const field = { name, label: computed.label, type: 'readonly', readonly: true, help_text: '' };
    if (computed.displayHtml) field.display_html = computed.displayHtml(obj);
    else field.display = computed.display(obj);
    return field;
  }
  const spec = getField(admin, name);
  const field = { name, label: spec.label, type: spec.type, readonly: true, help_text: spec.help_text || '' };
  if (!obj) {
    field.display = EMPTY;
    return field;
  }
  const raw = spec.type === 'fk' ? obj[spec.column] : obj[spec.name];
  if (spec.type === 'bool') {
    field.display_html = `<img src="/static/admin/img/icon-${raw ? 'yes' : 'no'}.svg" alt="${raw ? 'True' : 'False'}">`;
  } else if (spec.type === 'fk' && raw) {
    const rel = obj[spec.as];
    const [app, model] = spec.related.split('.');
    field.display_html = `<a href="/admin/${app}/${model}/${raw}/change/">${esc(rel ? strOf(spec.related, rel) : raw)}</a>`;
  } else if ((spec.type === 'file' || spec.type === 'image') && raw) {
    field.display_html = `<a href="${esc(mediaUrl(raw))}">${esc(raw)}</a>`;
  } else if (spec.type === 'text' && raw) {
    field.display_html = esc(raw).replace(/\r\n|\r|\n/g, '<br>');
  } else {
    field.display = displayValue(spec, obj, strOf);
  }
  return field;
}

async function editableField(admin, spec, obj, submitted) {
  const value = submitted && submitted[spec.name] !== undefined ? submitted[spec.name] : formValue(spec, obj);
  const field = {
    name: spec.name,
    label: spec.label,
    type: spec.type,
    required: !spec.blank,
    readonly: false,
    help_text: spec.help_text || '',
    value,
    max_length: spec.max_length || null,
    native: !!spec.native,
  };
  if (spec.type === 'fk') {
    field.choices = await fkChoices(spec, !spec.blank, obj ? formValue(spec, obj) : '');
    const rel = byKey.get(spec.related);
    const relPerms = rel.perms || {};
    field.related = {
      app_label: rel.app_label,
      model: rel.model_name,
      verbose_name: rel.verbose_name,
      admin_url: `/admin/${rel.app_label}/${rel.model_name}/`,
      can_add: relPerms.add ? await relPerms.add() : true,
      can_change: relPerms.change ? await relPerms.change() : true,
      can_view: true,
      can_delete: relPerms.delete ? await relPerms.delete() : true,
    };
  }
  if (spec.type === 'select') {
    const hasDefault = spec.default !== undefined;
    field.choices = spec.blank || !hasDefault ? [['', '---------'], ...spec.choices] : [...spec.choices];
  }
  if (spec.type === 'decimal') field.decimal_places = spec.decimal_places;
  return field;
}

/** JSON description of the add/change form */
export async function buildForm(admin, perms, obj, submitted = null) {
  const { fieldsets, ro } = getFieldsets(admin, perms, obj);
  const out = [];
  for (const [name, opts] of fieldsets) {
    const fields = [];
    for (const fname of opts.fields) {
      if (admin.special === 'user') {
        if (fname === 'password' && obj) {
          const s = passwordSummary(obj.password);
          fields.push({
            name: 'password',
            label: 'Password',
            type: 'password_hash',
            readonly: true,
            display_html: s
              ? `<div><strong>algorithm</strong>: ${esc(s.algorithm)} <strong>iterations</strong>: ${esc(s.iterations)} <strong>salt</strong>: ${esc(
                  s.salt
                )} <strong>hash</strong>: ${esc(s.hash)}</div>`
              : '<div><strong>No password set.</strong></div>',
            help_text_html: `Raw passwords are not stored, so there is no way to see this user’s password, but you can change the password using <a href="../password/">this form</a>.`,
          });
          continue;
        }
        if (fname === 'password1' || fname === 'password2') {
          fields.push({
            name: fname,
            label: fname === 'password1' ? 'Password' : 'Password confirmation',
            type: 'password',
            required: true,
            readonly: false,
            value: '',
            help_text: fname === 'password2' ? 'Enter the same password as before, for verification.' : '',
            help_text_list: fname === 'password1' ? PASSWORD_HELP_TEXTS : null,
          });
          continue;
        }
      }
      if (ro.has(fname) || (admin.computed_readonly || {})[fname]) {
        fields.push(readonlyField(admin, fname, obj));
      } else {
        const spec = getField(admin, fname);
        if (spec) fields.push(await editableField(admin, spec, obj, submitted));
      }
    }
    out.push({ name, classes: opts.classes || [], description: opts.description || null, fields });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation + save
// ---------------------------------------------------------------------------
async function fkExists(key, id) {
  const rel = byKey.get(key);
  return !!(await rel.Model.count({ where: { id } }));
}

/** Echo of the submitted values so the form can be re-rendered with the user's input */
function submittedEcho(admin, body, names) {
  const echo = {};
  for (const n of names) {
    const spec = getField(admin, n);
    if (!spec) continue;
    if (spec.type === 'bool') echo[n] = ['on', 'true', '1', 'True'].includes(String(body[n] ?? ''));
    else if (spec.type === 'datetime') echo[n] = { date: body[`${n}_0`] || '', time: body[`${n}_1`] || '' };
    else if (spec.type === 'file' || spec.type === 'image') continue;
    else echo[n] = body[n] ?? '';
  }
  return echo;
}

/**
 * Validates and saves the add/change form.
 * Returns { ok:true, obj, changed:[labels] } or { ok:false, errors, submitted }.
 */
export async function saveForm(admin, perms, obj, req) {
  const body = req.body || {};
  const files = req.files || [];
  const getFile = (name) => files.find((f) => f.fieldname === name && f.originalname && f.size >= 0) || null;
  const { fieldsets, ro } = getFieldsets(admin, perms, obj);
  const names = fieldsets.flatMap(([, o]) => o.fields).filter((n) => !ro.has(n) && getField(admin, n) && !(admin.computed_readonly || {})[n]);
  const errors = new FormErrors();
  const cleaned = {};
  const fileOps = {};

  // auth.User add form (UserCreationForm)
  if (admin.special === 'user' && !obj) {
    let username = '';
    try {
      username = cleanChar(body.username, { maxLength: 150 });
      for (const v of getField(admin, 'username').validators) v(username);
      const exists = await User.findAll({ where: { username } });
      if (exists.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
        throw new ValidationError('A user with that username already exists.');
      }
    } catch (e) {
      if (e instanceof ValidationError) errors.add('username', e.messages);
      else throw e;
    }
    let p1 = '';
    let p2 = '';
    try {
      p1 = cleanChar(body.password1, { strip: false });
    } catch (e) {
      errors.add('password1', e.messages);
    }
    try {
      p2 = cleanChar(body.password2, { strip: false });
    } catch (e) {
      errors.add('password2', e.messages);
    }
    if (p1 && p2 && p1 !== p2) errors.add('password2', 'The two password fields didn’t match.');
    if (p2 && !errors.has('password2')) {
      const pw = validatePassword(p2, { username });
      if (pw.length) errors.add('password2', pw);
    }
    if (!errors.isValid) return { ok: false, errors: errors.errors, submitted: { username: body.username || '' } };
    const user = await User.create({ username, password: await makePassword(p1), date_joined: new Date() });
    return { ok: true, obj: user, changed: [] };
  }

  for (const n of names) {
    const spec = getField(admin, n);
    try {
      const res = await cleanFieldValue(spec, body, getFile, fkExists);
      if (spec.type === 'file' || spec.type === 'image') {
        if (res.keep && !spec.blank && !(obj && obj[spec.name])) throw new ValidationError('This field is required.');
        fileOps[n] = res;
      } else {
        cleaned[n] = res.value;
      }
    } catch (e) {
      if (e instanceof ValidationError) errors.add(n, e.messages);
      else throw e;
    }
  }

  // unique fields
  for (const spec of admin.fields.filter((f) => f.unique && names.includes(f.name))) {
    const v = cleaned[spec.name];
    if (v === null || v === undefined || v === '' || errors.has(spec.name)) continue;
    const column = spec.type === 'fk' ? spec.column : spec.name;
    const where = { [column]: v };
    if (obj) where.id = { [Op.ne]: obj.id };
    const clashes = await admin.Model.findAll({ where });
    const real = spec.type === 'char' ? clashes.filter((c) => c[column] === v) : clashes;
    if (real.length) errors.add(spec.name, spec.unique_message || `${capfirst(admin.verbose_name)} with this ${spec.label} already exists.`);
  }
  // unique_together
  for (const ut of admin.unique_together || []) {
    if (ut.fields.some((f) => errors.has(f))) continue;
    const where = {};
    let complete = true;
    for (const f of ut.fields) {
      const spec = getField(admin, f);
      const v = names.includes(f) ? cleaned[f] : obj ? obj[spec.column || f] : undefined;
      if (v === null || v === undefined || v === '') complete = false;
      where[spec.type === 'fk' ? spec.column : f] = v;
    }
    if (!complete) continue;
    if (obj) where.id = { [Op.ne]: obj.id };
    if (await admin.Model.count({ where })) errors.add('__all__', ut.message);
  }

  if (!errors.isValid) return { ok: false, errors: errors.errors, submitted: submittedEcho(admin, body, names) };

  const isAdd = !obj;
  const instance = obj || admin.Model.build({});
  if (isAdd) {
    // model defaults for fields not on the form
    for (const spec of admin.fields) {
      if (spec.default !== undefined && !names.includes(spec.name) && !spec.auto) {
        instance[spec.name] = typeof spec.default === 'function' ? spec.default() : spec.default;
      }
    }
  }
  const changedLabels = [];
  const same = (a, b) => {
    if (a instanceof Date || b instanceof Date) return new Date(a || 0).getTime() === new Date(b || 0).getTime() && !!a === !!b;
    return String(a ?? '') === String(b ?? '');
  };
  for (const n of names) {
    const spec = getField(admin, n);
    if (spec.type === 'file' || spec.type === 'image') continue;
    const attr = spec.type === 'fk' ? spec.column : spec.name;
    if (!isAdd && !same(instance[attr], cleaned[n])) changedLabels.push(spec.label);
    instance[attr] = cleaned[n];
  }
  for (const [n, op] of Object.entries(fileOps)) {
    const spec = getField(admin, n);
    if (op.file) {
      instance[n] = await saveUpload(op.file, spec.upload_to);
      if (!isAdd) changedLabels.push(spec.label);
    } else if (op.clear) {
      if (!isAdd && instance[n]) changedLabels.push(spec.label);
      instance[n] = null;
    }
  }
  if (admin.beforeSave) admin.beforeSave(instance, { isAdd, user: req.user });

  try {
    await sequelize.transaction(async (t) => {
      await instance.save({ transaction: t });
    });
  } catch (e) {
    if (e.message === 'Insufficient funds in wallet' || e.message === 'Withdrawal amount must be positive' || e.message === 'Deposit amount must be positive') {
      return { ok: false, errors: { __all__: [e.message] }, submitted: submittedEcho(admin, body, names) };
    }
    if (e.name === 'SequelizeUniqueConstraintError') {
      return { ok: false, errors: { __all__: ['An object with these values already exists.'] }, submitted: submittedEcho(admin, body, names) };
    }
    throw e;
  }
  const fresh = await admin.Model.findByPk(instance.id, { include: admin.include || [] });
  return { ok: true, obj: fresh, changed: changedLabels };
}

// ---------------------------------------------------------------------------
// Deletion (Collector)
// ---------------------------------------------------------------------------
/** Reverse relations: [childKey|null, Model, fkColumn, onDelete, verboseName, verbosePlural] */
const RELATIONS = {
  'auth.user': [
    ['pehchan.eventvolunteer', 'user_id', 'CASCADE'],
    ['pehchan.lifetimevolunteer', 'user_id', 'CASCADE'],
    ['pehchan.materialdonation', 'user_id', 'CASCADE'],
    ['pehchan.moneydonation', 'user_id', 'CASCADE'],
    ['pehchan.donorcertificate', 'user_id', 'CASCADE'],
    ['pehchan.passwordresetotp', 'user_id', 'CASCADE'],
    ['admin.logentry', 'user_id', 'CASCADE'],
    ['pehchan.event', 'created_by_id', 'SET_NULL'],
    ['pehchan.lifetimevolunteer', 'reviewed_by_id', 'SET_NULL'],
    ['pehchan.contactmessage', 'responded_by_id', 'SET_NULL'],
    ['pehchan.expense', 'created_by_id', 'SET_NULL'],
    ['pehchan.expense', 'approved_by_id', 'SET_NULL'],
  ],
  'pehchan.event': [
    ['pehchan.eventvolunteer', 'event_id', 'CASCADE'],
    ['pehchan.certificate', 'event_id', 'CASCADE'],
    ['pehchan.moneydonation', 'event_id', 'SET_NULL'],
  ],
  'pehchan.eventvolunteer': [['pehchan.certificate', 'volunteer_id', 'CASCADE']],
  'pehchan.materialdonation': [['pehchan.donorcertificate', 'material_donation_id', 'CASCADE']],
  'pehchan.moneydonation': [
    ['pehchan.donorcertificate', 'money_donation_id', 'CASCADE'],
    ['pehchan.wallettransaction', 'related_donation_id', 'SET_NULL'],
  ],
  'pehchan.expense': [['pehchan.wallettransaction', 'related_expense_id', 'SET_NULL']],
  'pehchan.pehchanwallet': [['pehchan.wallettransaction', 'wallet_id', 'CASCADE']],
};

const EXTRA_MODELS = {
  'pehchan.passwordresetotp': { Model: PasswordResetOTP, verbose_name: 'password reset otp', verbose_name_plural: 'password reset otps', str: (o) => `PasswordResetOTP object (${o.id})` },
  'admin.logentry': { Model: AdminLog, verbose_name: 'log entry', verbose_name_plural: 'log entries', str: (o) => `${['', 'Added', 'Changed', 'Deleted'][o.action_flag]} “${o.object_repr}”.` },
};

const metaFor = (key) => byKey.get(key) || EXTRA_MODELS[key];

/**
 * Collect everything that will be deleted together with `objects`.
 * Returns { nested, counts:Map(verbosePlural -> n), plan:[{key, ids}], setNull:[{key, column, ids}] }
 */
export async function collectDeletion(key, objects) {
  const seen = new Set();
  const counts = new Map();
  const plan = [];
  const setNull = [];

  async function visit(k, objs) {
    const meta = metaFor(k);
    const nodes = [];
    for (const o of objs) {
      const id = `${k}:${o.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const label = capfirst(meta.verbose_name);
      const reg = byKey.get(k);
      const text = reg ? `${label}: <a href="/admin/${reg.app_label}/${reg.model_name}/${o.id}/change/">${esc(meta.str(o))}</a>` : `${label}: ${esc(meta.str(o))}`;
      counts.set(capfirst(meta.verbose_name_plural), (counts.get(capfirst(meta.verbose_name_plural)) || 0) + 1);
      plan.push({ key: k, id: o.id });
      const children = [];
      for (const [childKey, column, onDelete] of RELATIONS[k] || []) {
        const childMeta = metaFor(childKey);
        if (onDelete === 'SET_NULL') {
          setNull.push({ key: childKey, column, id: o.id });
          continue;
        }
        const childReg = byKey.get(childKey);
        // eslint-disable-next-line no-await-in-loop
        const kids = await childMeta.Model.findAll({ where: { [column]: o.id }, include: childReg ? childReg.include || [] : [] });
        // eslint-disable-next-line no-await-in-loop
        if (kids.length) children.push(...(await visit(childKey, kids)));
      }
      nodes.push({ text, html: true, children });
    }
    return nodes;
  }

  const nested = await visit(key, objects);
  return { nested, model_count: [...counts.entries()], plan, setNull };
}

export async function performDeletion(collected) {
  await sequelize.transaction(async (t) => {
    for (const { key, column, id } of collected.setNull) {
      const meta = metaFor(key);
      // eslint-disable-next-line no-await-in-loop
      await meta.Model.update({ [column]: null }, { where: { [column]: id }, transaction: t });
    }
    // children were pushed after parents -> delete in reverse order
    for (const { key, id } of [...collected.plan].reverse()) {
      const meta = metaFor(key);
      // eslint-disable-next-line no-await-in-loop
      await meta.Model.destroy({ where: { id }, transaction: t });
    }
  });
}
