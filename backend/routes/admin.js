/**
 * /api/admin – Django admin site (see docs/ADMIN_API.md)
 */
import { Router } from 'express';
import { Op } from 'sequelize';
import registry, { APPS, getAdmin, getField, byKey } from '../admin/registry.js';
import { strOf } from '../admin/registry.js';
import {
  changelistData,
  filteredQuery,
  permissions,
  modelMeta,
  buildActions,
  verboseCount,
  capfirst,
  hasPerm,
  listColumns,
} from '../admin/changelist.js';
import { buildForm, saveForm, loadObject, logAction, changeMessage, collectDeletion, performDeletion, ADDITION, CHANGE, DELETION } from '../admin/forms.js';
import { cleanFieldValue } from '../admin/fields.js';
import { authenticate, login, logout, updateSessionAuthHash } from '../middleware/auth.js';
import { AdminLog, User, EventVolunteer, Event, Certificate, MaterialDonation, MoneyDonation, DonorCertificate, PAYMENT_METHOD_CHOICES } from '../models/index.js';
import { checkPassword, makePassword, validatePassword, PASSWORD_HELP_TEXTS } from '../utils/passwords.js';
import { FormErrors, ValidationError, cleanChar, MSG } from '../utils/forms.js';
import { parseMultipart, getFile, saveUpload } from '../utils/uploads.js';
import { sendMail } from '../utils/mailer.js';
import config from '../config.js';
import { ah, success, error, warning } from '../utils/http.js';
import { userFull } from '../utils/serializers.js';
import { todayISO } from '../../shared/dateformat.js';

const router = Router();

const THEME = {
  name: 'Django',
  title: 'Django administration',
  title_color: '#F5DD5D',
  title_visible: true,
  logo_color: '#FFFFFF',
  logo_visible: true,
  css_header_background_color: '#0C4B33',
  css_header_text_color: '#44B78B',
  css_header_link_color: '#FFFFFF',
  css_header_link_hover_color: '#C9F0DD',
  css_module_background_color: '#44B78B',
  css_module_background_selected_color: '#FFFFCC',
  css_module_text_color: '#FFFFFF',
  css_module_link_color: '#FFFFFF',
  css_module_link_selected_color: '#FFFFFF',
  css_module_link_hover_color: '#C9F0DD',
  css_module_rounded_corners: true,
  css_generic_link_color: '#0C3C26',
  css_generic_link_hover_color: '#156641',
  css_generic_link_active_color: '#29B864',
  css_save_button_background_color: '#0C4B33',
  css_save_button_background_hover_color: '#0C3C26',
  css_save_button_text_color: '#FFFFFF',
  css_delete_button_background_color: '#BA2121',
  css_delete_button_background_hover_color: '#A41515',
  css_delete_button_text_color: '#FFFFFF',
  list_filter_dropdown: true,
  list_filter_highlight: true,
  list_filter_sticky: true,
  list_filter_removal_links: true,
  foldable_apps: true,
  recent_actions_visible: true,
  related_modal_active: true,
  related_modal_background_color: '#000000',
  related_modal_background_opacity: '0.3',
  related_modal_rounded_corners: true,
  related_modal_close_button_visible: true,
  form_submit_sticky: true,
  form_pagination_sticky: true,
  env_name: '',
  env_color: '#E74C3C',
  env_visible_in_header: true,
  env_visible_in_favicon: true,
  language_chooser_active: false,
  show_fieldsets_as_tabs: false,
  show_inlines_as_tabs: false,
};

const SITE = { site_header: 'Django administration', site_title: 'Django site admin', index_title: 'Site administration' };

// ---------------------------------------------------------------------------
// Session / login / logout / password change (no staff requirement)
// ---------------------------------------------------------------------------
router.get('/session/', (req, res) => {
  res.json({ ok: true, user: userFull(req.user), ...SITE, theme: THEME });
});

router.post(
  '/login/',
  ah(async (req, res) => {
    const errors = new FormErrors();
    const username = String(req.body?.username ?? '').trim();
    const password = req.body?.password ?? '';
    if (!username) errors.add('username', MSG.required);
    if (!password) errors.add('password', MSG.required);
    if (errors.isValid) {
      const user = await authenticate(username, password);
      if (user && user.is_staff) {
        await login(req, user);
        return res.json({ ok: true, user: userFull(user) });
      }
      errors.add('__all__', 'Please enter the correct username and password for a staff account. Note that both fields may be case-sensitive.');
    }
    return res.status(400).json({ ok: false, errors: errors.errors });
  })
);

router.post(
  '/logout/',
  ah(async (req, res) => {
    await logout(req);
    res.json({ ok: true, user: null });
  })
);

// Everything below requires an active staff user
router.use((req, res, next) => {
  if (!req.user) return res.status(401).json({ ok: false, login_required: true });
  if (!req.user.is_staff || !req.user.is_active) return res.status(401).json({ ok: false, login_required: true });
  return next();
});

router.get('/password_change/', (req, res) => res.json({ ok: true, title: 'Password change', help_texts: PASSWORD_HELP_TEXTS }));

router.post(
  '/password_change/',
  ah(async (req, res) => {
    const b = req.body || {};
    const errors = new FormErrors();
    if (!b.old_password) errors.add('old_password', MSG.required);
    else if (!(await checkPassword(b.old_password, req.user.password))) {
      errors.add('old_password', 'Your old password was entered incorrectly. Please enter it again.');
    }
    if (!b.new_password1) errors.add('new_password1', MSG.required);
    if (!b.new_password2) errors.add('new_password2', MSG.required);
    if (b.new_password1 && b.new_password2) {
      if (b.new_password1 !== b.new_password2) errors.add('new_password2', 'The two password fields didn’t match.');
      else {
        const pw = validatePassword(b.new_password2, req.user);
        if (pw.length) errors.add('new_password2', pw);
      }
    }
    if (!errors.isValid) return res.status(400).json({ ok: false, errors: errors.errors });
    req.user.password = await makePassword(b.new_password1);
    await req.user.save();
    updateSessionAuthHash(req, req.user);
    res.json({ ok: true, redirect: '/admin/password_change/done/' });
  })
);

// ---------------------------------------------------------------------------
// Index / app index
// ---------------------------------------------------------------------------
async function appList(user, onlyApp = null) {
  const apps = [];
  for (const appLabel of Object.keys(APPS).sort((a, b) => APPS[a].name.localeCompare(APPS[b].name))) {
    if (onlyApp && appLabel !== onlyApp) continue;
    const models = [];
    for (const admin of registry.filter((r) => r.app_label === appLabel)) {
      // eslint-disable-next-line no-await-in-loop
      const perms = await permissions(admin, user);
      if (!perms.has_view && !perms.has_change && !perms.has_add) continue;
      models.push({
        object_name: admin.object_name,
        model: admin.model_name,
        name: capfirst(admin.verbose_name_plural),
        admin_url: `/admin/${admin.app_label}/${admin.model_name}/`,
        add_url: perms.has_add ? `/admin/${admin.app_label}/${admin.model_name}/add/` : null,
        view_only: !perms.has_change,
      });
    }
    models.sort((a, b) => a.name.localeCompare(b.name));
    if (models.length) apps.push({ app_label: appLabel, name: APPS[appLabel].name, app_url: `/admin/${appLabel}/`, models });
  }
  return apps;
}

async function recentActions(user) {
  const logs = await AdminLog.findAll({ where: { user_id: user.id }, order: [['action_time', 'DESC']], limit: 10 });
  return logs.map((l) => {
    const [app, model] = String(l.content_type || '').split('.');
    const admin = getAdmin(app, model);
    return {
      action_flag: l.action_flag,
      object_repr: l.object_repr,
      content_type_name: admin ? admin.verbose_name : model || '',
      url: l.action_flag !== DELETION && admin ? `/admin/${app}/${model}/${l.object_id}/change/` : null,
    };
  });
}

router.get(
  '/',
  ah(async (req, res) => {
    res.json({ ok: true, title: SITE.index_title, app_list: await appList(req.user), recent_actions: await recentActions(req.user) });
  })
);

router.get(
  '/:app/',
  ah(async (req, res, next) => {
    const { app } = req.params;
    if (!APPS[app]) return next();
    const list = await appList(req.user, app);
    if (!list.length) return res.status(404).json({ ok: false, not_found: true });
    res.json({ ok: true, title: `${APPS[app].name} administration`, app_list: list });
  })
);

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------
async function resolve(req, res) {
  const admin = getAdmin(req.params.app, req.params.model);
  if (!admin || !hasPerm(req.user)) {
    res.status(404).json({ ok: false, not_found: true });
    return null;
  }
  const perms = await permissions(admin, req.user);
  return { admin, perms, meta: modelMeta(admin, perms) };
}

const changelistUrl = (admin, req) => {
  const preserved = req.query._changelist_filters;
  return `/admin/${admin.app_label}/${admin.model_name}/${preserved ? `?${preserved}` : ''}`;
};

// ---------------------------------------------------------------------------
// Custom admin views (issue certificate) – registered before the generic routes
// ---------------------------------------------------------------------------
const fullName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '');

router.get(
  '/pehchan/eventvolunteer/issue-certificate/:id/',
  ah(async (req, res) => {
    const cl = '/admin/pehchan/eventvolunteer/';
    const v = /^\d+$/.test(req.params.id) && (await EventVolunteer.findByPk(req.params.id, { include: [{ model: User, as: 'user' }, { model: Event, as: 'event' }] }));
    if (!v) return res.status(404).json({ ok: false, not_found: true });
    if (await Certificate.count({ where: { event_id: v.event_id, volunteer_id: v.id } })) {
      return res.json({ ok: false, messages: [error('A certificate already exists for this volunteer.')], redirect: cl });
    }
    res.json({
      ok: true,
      title: 'Issue Volunteer Certificate',
      certificate_type: 'Volunteer',
      year: Number(todayISO().slice(0, 4)),
      cancel_url: cl,
      volunteer: {
        user_full_name: fullName(v.user),
        username: v.user.username,
        event_name: v.event.name,
        status_display: v.status === 'approved' ? 'Approved' : 'Pending',
        joined_at: v.joined_at,
      },
    });
  })
);

router.post(
  '/pehchan/eventvolunteer/issue-certificate/:id/',
  parseMultipart,
  ah(async (req, res) => {
    const cl = '/admin/pehchan/eventvolunteer/';
    const v = /^\d+$/.test(req.params.id) && (await EventVolunteer.findByPk(req.params.id, { include: [{ model: User, as: 'user' }] }));
    if (!v) return res.status(404).json({ ok: false, not_found: true });
    if (await Certificate.count({ where: { event_id: v.event_id, volunteer_id: v.id } })) {
      return res.json({ ok: false, messages: [error('A certificate already exists for this volunteer.')], redirect: cl });
    }
    const file = getFile(req, 'certificate_file');
    const filePath = file ? await saveUpload(file, 'certificates') : null;
    const cert = await Certificate.create({ event_id: v.event_id, volunteer_id: v.id, issue_date: todayISO(), file: filePath });
    await logAction(req.user, getAdmin('pehchan', 'certificate'), await Certificate.findByPk(cert.id, { include: getAdmin('pehchan', 'certificate').include }), ADDITION, 'Added.');
    res.json({ ok: true, messages: [success(`Certificate issued successfully for ${v.user.username}.`)], redirect: cl });
  })
);

function donationIssueRoutes(kind) {
  const isMaterial = kind === 'material';
  const Model = isMaterial ? MaterialDonation : MoneyDonation;
  const cl = `/admin/pehchan/${isMaterial ? 'materialdonation' : 'moneydonation'}/`;
  const fkCol = isMaterial ? 'material_donation_id' : 'money_donation_id';
  const path = `/pehchan/${isMaterial ? 'materialdonation' : 'moneydonation'}/issue-certificate/:id/`;

  router.get(
    path,
    ah(async (req, res) => {
      const d = /^\d+$/.test(req.params.id) && (await Model.findByPk(req.params.id, { include: [{ model: User, as: 'user' }] }));
      if (!d) return res.status(404).json({ ok: false, not_found: true });
      if (await DonorCertificate.count({ where: { [fkCol]: d.id } })) {
        return res.json({ ok: false, messages: [error('A certificate already exists for this donation.')], redirect: cl });
      }
      const donation = isMaterial
        ? {
            kind: 'material',
            user_full_name: fullName(d.user),
            username: d.user.username,
            item_name: d.item_name,
            quantity: d.quantity,
            location: d.location,
            status_display: { pending: 'Pending', received: 'Received', processed: 'Processed' }[d.status] || d.status,
            created_at: d.created_at,
          }
        : {
            kind: 'money',
            user_full_name: fullName(d.user),
            username: d.user.username,
            amount: d.amount,
            payment_method_display: (PAYMENT_METHOD_CHOICES.find(([k]) => k === d.payment_method) || [0, d.payment_method])[1],
            created_at: d.created_at,
          };
      res.json({
        ok: true,
        title: isMaterial ? 'Issue Material Donation Certificate' : 'Issue Money Donation Certificate',
        certificate_type: isMaterial ? 'Material Donation' : 'Donor (Money)',
        year: Number(todayISO().slice(0, 4)),
        cancel_url: cl,
        donation,
      });
    })
  );

  router.post(
    path,
    parseMultipart,
    ah(async (req, res) => {
      const d = /^\d+$/.test(req.params.id) && (await Model.findByPk(req.params.id, { include: [{ model: User, as: 'user' }] }));
      if (!d) return res.status(404).json({ ok: false, not_found: true });
      if (await DonorCertificate.count({ where: { [fkCol]: d.id } })) {
        return res.json({ ok: false, messages: [error('A certificate already exists for this donation.')], redirect: cl });
      }
      try {
        const file = getFile(req, 'certificate_file');
        const filePath = file ? await saveUpload(file, 'donor_certificates') : null;
        const cert = await DonorCertificate.create({
          user_id: d.user_id,
          donation_type: kind,
          [fkCol]: d.id,
          issue_date: todayISO(),
          remarks: isMaterial
            ? `Thank you for your generous donation of ${d.quantity} ${d.item_name}(s).`
            : `Thank you for your generous donation of Rs. ${d.amount}.`,
          file: filePath,
        });
        const dcAdmin = getAdmin('pehchan', 'donorcertificate');
        await logAction(req.user, dcAdmin, await DonorCertificate.findByPk(cert.id, { include: dcAdmin.include }), ADDITION, 'Added.');
        return res.json({ ok: true, messages: [success(`Donor certificate issued successfully for ${d.user.username}.`)], redirect: cl });
      } catch (e) {
        return res.json({ ok: false, messages: [error(`Error issuing certificate: ${e.message}`)] });
      }
    })
  );
}
donationIssueRoutes('material');
donationIssueRoutes('money');

// auth.User – change password page
router.get(
  '/auth/user/:id/password/',
  ah(async (req, res) => {
    if (!hasPerm(req.user)) return res.status(404).json({ ok: false, not_found: true });
    const u = /^\d+$/.test(req.params.id) && (await User.findByPk(req.params.id));
    if (!u) return res.status(404).json({ ok: false, not_found: true });
    res.json({ ok: true, title: `Change password: ${u.username}`, username: u.username, object_id: u.id, help_texts: PASSWORD_HELP_TEXTS });
  })
);

router.post(
  '/auth/user/:id/password/',
  ah(async (req, res) => {
    if (!hasPerm(req.user)) return res.status(404).json({ ok: false, not_found: true });
    const u = /^\d+$/.test(req.params.id) && (await User.findByPk(req.params.id));
    if (!u) return res.status(404).json({ ok: false, not_found: true });
    const b = req.body || {};
    const errors = new FormErrors();
    if (!b.password1) errors.add('password1', MSG.required);
    if (!b.password2) errors.add('password2', MSG.required);
    if (b.password1 && b.password2) {
      if (b.password1 !== b.password2) errors.add('password2', 'The two password fields didn’t match.');
      else {
        const pw = validatePassword(b.password2, u);
        if (pw.length) errors.add('password2', pw);
      }
    }
    if (!errors.isValid) return res.status(400).json({ ok: false, errors: errors.errors });
    u.password = await makePassword(b.password1);
    await u.save();
    if (u.id === req.user.id) updateSessionAuthHash(req, u);
    await logAction(req.user, getAdmin('auth', 'user'), u, CHANGE, 'Changed password.');
    res.json({ ok: true, messages: [success('Password changed successfully.')], redirect: `/admin/auth/user/${u.id}/change/` });
  })
);

// ---------------------------------------------------------------------------
// Change list, actions, list_editable
// ---------------------------------------------------------------------------
router.get(
  '/:app/:model/',
  ah(async (req, res) => {
    const r = await resolve(req, res);
    if (!r) return;
    const data = await changelistData(r.admin, req.query, r.perms);
    res.json({ ...data, model: r.meta });
  })
);

router.post(
  '/:app/:model/action/',
  ah(async (req, res) => {
    const r = await resolve(req, res);
    if (!r) return;
    const { admin, perms } = r;
    const b = req.body || {};
    const actionsList = buildActions(admin, perms);
    const action = actionsList.find((a) => a.name === b.action);
    if (!action) return res.json({ ok: false, messages: [warning('No action selected.')] });

    const selected = Array.isArray(b.selected) ? b.selected.filter((x) => /^\d+$/.test(String(x))).map(Number) : [];
    let objects;
    if (b.select_across) {
      const { where } = await filteredQuery(admin, req.query);
      objects = await admin.Model.findAll({ where, include: admin.include || [], subQuery: false, order: [['id', 'ASC']] });
    } else {
      if (!selected.length) {
        return res.json({ ok: false, messages: [warning('Items must be selected in order to perform actions on them. No items have been changed.')] });
      }
      objects = await admin.Model.findAll({ where: { id: { [Op.in]: selected } }, include: admin.include || [], order: [['id', 'ASC']] });
    }
    if (!objects.length) {
      return res.json({ ok: false, messages: [warning('Items must be selected in order to perform actions on them. No items have been changed.')] });
    }

    if (action.name === 'delete_selected') {
      const collected = await collectDeletion(`${admin.app_label}.${admin.model_name}`, objects);
      if (b.post !== 'yes') {
        return res.json({
          ok: true,
          confirm: {
            title: 'Are you sure?',
            objects_name: verboseCount(admin, objects.length),
            deleted_objects: collected.nested,
            model_count: collected.model_count,
            perms_lacking: [],
            protected: [],
            selected: objects.map((o) => o.id),
          },
        });
      }
      for (const o of objects) await logAction(req.user, admin, o, DELETION, '');
      await performDeletion(collected);
      return res.json({ ok: true, messages: [success(`Successfully deleted ${objects.length} ${verboseCount(admin, objects.length)}.`)] });
    }

    const result = (await action.handler({ admin, objects, req, strOf })) || {};
    if (result.file) {
      res.setHeader('Content-Type', result.file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.file.filename}`);
      return res.send(result.file.buffer);
    }
    return res.json({ ok: true, messages: result.messages || [], redirect: result.redirect });
  })
);

router.post(
  '/:app/:model/list-edit/',
  ah(async (req, res) => {
    const r = await resolve(req, res);
    if (!r) return;
    const { admin, perms } = r;
    if (!perms.has_change || !(admin.list_editable || []).length) return res.status(403).json({ ok: false, permission_denied: true });
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const rowErrors = {};
    const pending = [];
    for (const row of rows) {
      const obj = await loadObject(admin, row.id);
      if (!obj) continue;
      const changed = [];
      const values = {};
      for (const fname of admin.list_editable) {
        const spec = getField(admin, fname);
        const body = { [fname]: row.values?.[fname] === true ? 'on' : row.values?.[fname] === false ? '' : row.values?.[fname] };
        try {
          const { value } = await cleanFieldValue(spec, body, () => null, async () => true);
          values[fname] = value;
          if (String(obj[fname]) !== String(value) && !(spec.type === 'bool' && !!obj[fname] === !!value)) changed.push(spec.label);
        } catch (e) {
          if (e instanceof ValidationError) {
            rowErrors[row.id] = rowErrors[row.id] || {};
            rowErrors[row.id][fname] = e.messages;
          } else throw e;
        }
      }
      pending.push({ obj, values, changed });
    }
    if (Object.keys(rowErrors).length) {
      return res.status(400).json({ ok: false, row_errors: rowErrors, messages: [error('Please correct the errors below.')] });
    }
    let count = 0;
    for (const { obj, values, changed } of pending) {
      if (!changed.length) continue;
      Object.assign(obj, values);
      await obj.save();
      await logAction(req.user, admin, obj, CHANGE, changeMessage(changed));
      count += 1;
    }
    const messages = [];
    if (count) {
      messages.push(success(`${count} ${verboseCount(admin, count)} ${count === 1 ? 'was' : 'were'} changed successfully.`));
    }
    res.json({ ok: true, messages });
  })
);

// ---------------------------------------------------------------------------
// Add / change / view
// ---------------------------------------------------------------------------
function formPayload(r, obj, fieldsets, extra = {}) {
  const { admin, perms, meta } = r;
  const isAdd = !obj;
  const viewOnly = obj ? !perms.has_change : !perms.has_add;
  const base = `/admin/${admin.app_label}/${admin.model_name}/`;
  return {
    ok: true,
    title: isAdd ? `Add ${admin.verbose_name}` : `${viewOnly ? 'View' : 'Change'} ${admin.verbose_name}`,
    object_id: obj ? obj.id : null,
    object_repr: obj ? admin.str(obj) : null,
    model: meta,
    view_only: viewOnly,
    has_delete: !!(obj && perms.has_delete),
    delete_url: obj ? `${base}${obj.id}/delete/` : null,
    history_url: obj ? `${base}${obj.id}/history/` : null,
    changelist_url: base,
    save_buttons: viewOnly
      ? { save: false, save_and_add_another: false, save_and_continue: false }
      : { save: true, save_and_add_another: perms.has_add, save_and_continue: true },
    fieldsets,
    extra,
  };
}

function formExtra(admin, obj) {
  const extra = {};
  if (admin.special === 'contactmessage') extra.quick_reply = { name: obj ? obj.name : '', email: obj ? obj.email : '' };
  if (admin.special === 'user' && !obj) extra.add_user_note = 'First, enter a username and password. Then, you’ll be able to edit more user options.';
  return extra;
}

router.get(
  '/:app/:model/add/',
  ah(async (req, res) => {
    const r = await resolve(req, res);
    if (!r) return;
    if (!r.perms.has_add) return res.status(403).json({ ok: false, permission_denied: true });
    res.json(formPayload(r, null, await buildForm(r.admin, r.perms, null), formExtra(r.admin, null)));
  })
);

async function handleSave(req, res, r, obj) {
  const { admin, perms } = r;
  const isAdd = !obj;
  if ((isAdd && !perms.has_add) || (!isAdd && !perms.has_change)) return res.status(403).json({ ok: false, permission_denied: true });
  const result = await saveForm(admin, perms, obj, req);
  if (!result.ok) {
    return res.status(400).json({
      ...formPayload(r, obj, await buildForm(admin, perms, obj, result.submitted), formExtra(admin, obj)),
      ok: false,
      errors: result.errors,
    });
  }
  let saved = result.obj;
  const messages = [];
  const b = req.body || {};

  // ContactMessageAdmin.response_add / response_change
  if (admin.special === 'contactmessage') {
    const reply = b.reply_message;
    if (reply) {
      saved.response = reply;
      try {
        await sendMail({ subject: `Re: ${saved.name} - Contact Form Message`, message: reply, from: config.DEFAULT_FROM_EMAIL, to: [saved.email] });
        messages.push(success(`Reply sent successfully to ${saved.email}.`));
      } catch (e) {
        messages.push(error(`Failed to send reply to ${saved.email}: ${e.message}`));
      }
    }
    if (saved.response) {
      if (!saved.responded_by_id) saved.responded_by_id = req.user.id;
      if (!saved.responded_at) saved.responded_at = new Date();
      if (saved.status === 'new' || saved.status === 'read') saved.status = 'replied';
      await saved.save();
      saved = await admin.Model.findByPk(saved.id, { include: admin.include || [] });
    }
  }

  await logAction(req.user, admin, saved, isAdd ? ADDITION : CHANGE, isAdd ? 'Added.' : changeMessage(result.changed));

  const name = admin.verbose_name;
  const repr = admin.str(saved);
  const base = `/admin/${admin.app_label}/${admin.model_name}/`;
  const preserved = req.query._changelist_filters ? `?_changelist_filters=${encodeURIComponent(req.query._changelist_filters)}` : '';
  let continueEditing = '_continue' in b;
  // UserAdmin.response_add: always continue editing after adding a user
  if (admin.special === 'user' && isAdd && !('_addanother' in b)) continueEditing = true;
  let redirect;
  const verb = isAdd ? 'added' : 'changed';
  if (continueEditing) {
    messages.push(success(`The ${name} “${repr}” was ${verb} successfully. You may edit it again below.`));
    redirect = `${base}${saved.id}/change/${preserved}`;
  } else if ('_addanother' in b) {
    messages.push(success(`The ${name} “${repr}” was ${verb} successfully. You may add another ${name} below.`));
    redirect = `${base}add/${preserved}`;
  } else {
    messages.push(success(`The ${name} “${repr}” was ${verb} successfully.`));
    redirect = changelistUrl(admin, req);
  }
  return res.json({ ok: true, messages, redirect, object_id: saved.id });
}

router.post(
  '/:app/:model/add/',
  parseMultipart,
  ah(async (req, res) => {
    const r = await resolve(req, res);
    if (!r) return;
    await handleSave(req, res, r, null);
  })
);

router.get(
  '/:app/:model/:id/change/',
  ah(async (req, res) => {
    const r = await resolve(req, res);
    if (!r) return;
    const obj = await loadObject(r.admin, req.params.id);
    if (!obj) {
      return res.json({
        ok: false,
        messages: [warning(`${capfirst(r.admin.verbose_name)} with ID “${req.params.id}” doesn’t exist. Perhaps it was deleted?`)],
        redirect: '/admin/',
      });
    }
    res.json(formPayload(r, obj, await buildForm(r.admin, r.perms, obj), formExtra(r.admin, obj)));
  })
);

router.post(
  '/:app/:model/:id/change/',
  parseMultipart,
  ah(async (req, res) => {
    const r = await resolve(req, res);
    if (!r) return;
    const obj = await loadObject(r.admin, req.params.id);
    if (!obj) return res.status(404).json({ ok: false, not_found: true });
    await handleSave(req, res, r, obj);
  })
);

// ---------------------------------------------------------------------------
// Delete / history
// ---------------------------------------------------------------------------
router.get(
  '/:app/:model/:id/delete/',
  ah(async (req, res) => {
    const r = await resolve(req, res);
    if (!r) return;
    const obj = await loadObject(r.admin, req.params.id);
    if (!obj) {
      return res.json({
        ok: false,
        messages: [warning(`${capfirst(r.admin.verbose_name)} with ID “${req.params.id}” doesn’t exist. Perhaps it was deleted?`)],
        redirect: '/admin/',
      });
    }
    if (!r.perms.has_delete) return res.status(403).json({ ok: false, permission_denied: true });
    const collected = await collectDeletion(`${r.admin.app_label}.${r.admin.model_name}`, [obj]);
    res.json({
      ok: true,
      title: 'Are you sure?',
      object_id: obj.id,
      object_repr: r.admin.str(obj),
      model: r.meta,
      deleted_objects: collected.nested,
      model_count: collected.model_count,
      perms_lacking: [],
      protected: [],
    });
  })
);

router.post(
  '/:app/:model/:id/delete/',
  ah(async (req, res) => {
    const r = await resolve(req, res);
    if (!r) return;
    const obj = await loadObject(r.admin, req.params.id);
    if (!obj) return res.status(404).json({ ok: false, not_found: true });
    if (!r.perms.has_delete) return res.status(403).json({ ok: false, permission_denied: true });
    const repr = r.admin.str(obj);
    const collected = await collectDeletion(`${r.admin.app_label}.${r.admin.model_name}`, [obj]);
    await logAction(req.user, r.admin, obj, DELETION, '');
    await performDeletion(collected);
    res.json({
      ok: true,
      messages: [success(`The ${r.admin.verbose_name} “${repr}” was deleted successfully.`)],
      redirect: changelistUrl(r.admin, req),
    });
  })
);

router.get(
  '/:app/:model/:id/history/',
  ah(async (req, res) => {
    const r = await resolve(req, res);
    if (!r) return;
    const obj = await loadObject(r.admin, req.params.id);
    if (!obj) {
      return res.json({
        ok: false,
        messages: [warning(`${capfirst(r.admin.verbose_name)} with ID “${req.params.id}” doesn’t exist. Perhaps it was deleted?`)],
        redirect: '/admin/',
      });
    }
    const logs = await AdminLog.findAll({
      where: { content_type: `${r.admin.app_label}.${r.admin.model_name}`, object_id: String(obj.id) },
      include: [{ model: User, as: 'user' }],
      order: [['action_time', 'ASC']],
    });
    res.json({
      ok: true,
      title: `Change history: ${r.admin.str(obj)}`,
      object_id: obj.id,
      object_repr: r.admin.str(obj),
      model: r.meta,
      actions: logs.map((l) => ({
        action_time: l.action_time,
        user: l.user ? l.user.username : '',
        user_full_name: l.user ? `${l.user.first_name} ${l.user.last_name}`.trim() : '',
        change_message: l.change_message || (l.action_flag === ADDITION ? 'Added.' : l.action_flag === DELETION ? 'Deleted.' : 'Changed.'),
      })),
    });
  })
);

router.use((req, res) => res.status(404).json({ ok: false, not_found: true }));

export default router;
export { listColumns, byKey };
