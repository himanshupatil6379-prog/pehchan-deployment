/**
 * Admin actions from pehchan/admin.py.
 * Handler signature: async ({ admin, objects, req }) => ({ messages, redirect, file })
 */
import ExcelJS from 'exceljs';
import { Op } from 'sequelize';
import config from '../config.js';
import { Certificate, DonorCertificate, MoneyDonation, ContactMessage } from '../models/index.js';
import { sendMail } from '../utils/mailer.js';
import { mediaUrl } from '../utils/uploads.js';
import { success, warning, error } from '../utils/http.js';
import { todayISO } from '../../shared/dateformat.js';

// ---------------------------------------------------------------------------
// ExportDataMixin
// ---------------------------------------------------------------------------
const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Python str() of a value read from a Django model instance */
function pyStr(spec, obj, strOf) {
  const v = spec.type === 'fk' ? obj[spec.column] : obj[spec.name];
  if (spec.type === 'fk') {
    const rel = obj[spec.as];
    return { text: rel ? strOf(spec.related, rel) : '' };
  }
  if ((spec.type === 'file' || spec.type === 'image') && v) return { text: mediaUrl(v), url: mediaUrl(v) };
  if (v === null || v === undefined) return { text: '' };
  if (spec.type === 'bool') return { text: v ? 'True' : 'False' };
  if (spec.type === 'datetime') {
    const d = new Date(v);
    const us = d.getUTCMilliseconds() ? `.${pad(d.getUTCMilliseconds() * 1000, 6)}` : '';
    return {
      text: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}${us}+00:00`,
    };
  }
  return { text: String(v) };
}

/** All concrete fields in model order (`_meta.fields`), including the pk */
function exportFields(admin) {
  return [{ name: 'id', type: 'int' }, ...admin.fields.filter((f) => !f.virtual)];
}

const metaLabel = (admin) => `${admin.app_label}.${admin.model_name}`;

function csvEscape(value) {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportAsCsv({ admin, objects, strOf }) {
  const fields = exportFields(admin);
  const lines = [fields.map((f) => csvEscape(f.name)).join(',')];
  for (const obj of objects) {
    lines.push(
      fields
        .map((f) => {
          try {
            return csvEscape(pyStr(f, obj, strOf).text);
          } catch {
            return 'ERROR';
          }
        })
        .join(',')
    );
  }
  return {
    file: {
      filename: `${metaLabel(admin)}.csv`,
      contentType: 'text/csv',
      buffer: Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8'),
    },
  };
}

export async function exportAsExcel({ admin, objects, strOf, req }) {
  const fields = exportFields(admin);
  const wb = new ExcelJS.Workbook();
  const title = metaLabel(admin).split('.').pop();
  const ws = wb.addWorksheet(title.charAt(0).toUpperCase() + title.slice(1).toLowerCase());
  const header = fields.map((f) => {
    const t = f.name.replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  });
  const headerRow = ws.addRow(header);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center' };
  });
  const origin = `${req.protocol}://${req.get('host')}`;
  for (const obj of objects) {
    const row = ws.addRow(fields.map(() => ''));
    fields.forEach((f, i) => {
      const cell = row.getCell(i + 1);
      try {
        const { text, url } = pyStr(f, obj, strOf);
        if (url) {
          cell.value = { text: 'View File', hyperlink: url.startsWith('http') ? url : origin + url };
          cell.font = { color: { argb: 'FF0000FF' }, underline: 'single' };
        } else {
          cell.value = text;
        }
      } catch {
        cell.value = 'ERROR';
      }
    });
  }
  ws.columns.forEach((column) => {
    let max = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value && typeof cell.value === 'object' && cell.value.text ? cell.value.text : cell.value;
      const len = String(v ?? 'None').length;
      if (len > max) max = len;
    });
    column.width = Math.min(max + 2, 50);
  });
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    file: {
      filename: `${metaLabel(admin)}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    },
  };
}

// ---------------------------------------------------------------------------
// EventVolunteerAdmin.issue_certificate
// ---------------------------------------------------------------------------
export async function issueVolunteerCertificates({ objects }) {
  if (objects.length === 1) {
    const v = objects[0];
    if (v.status === 'approved' && v.attended) {
      return { redirect: `/admin/pehchan/eventvolunteer/issue-certificate/${v.id}/` };
    }
    return { messages: [error('Only approved volunteers who attended can be issued certificates.')] };
  }
  let created = 0;
  let skipped = 0;
  let notApproved = 0;
  for (const v of objects) {
    if (v.status !== 'approved' || !v.attended) {
      notApproved += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    if (!(await Certificate.count({ where: { event_id: v.event_id, volunteer_id: v.id } }))) {
      // eslint-disable-next-line no-await-in-loop
      await Certificate.create({ event_id: v.event_id, volunteer_id: v.id, issue_date: todayISO() });
      created += 1;
    } else skipped += 1;
  }
  const messages = [];
  if (created > 0) messages.push(success(`Successfully issued ${created} certificate(s).`));
  if (skipped > 0) messages.push(warning(`Skipped ${skipped} volunteer(s) who already have certificates.`));
  if (notApproved > 0) messages.push(warning(`Skipped ${notApproved} volunteer(s) who are not approved.`));
  return { messages };
}

// ---------------------------------------------------------------------------
// LifetimeVolunteerAdmin.approve_volunteers / reject_volunteers
// ---------------------------------------------------------------------------
async function reviewLifetime(objects, user, status) {
  let updated = 0;
  for (const v of objects) {
    if (v.status !== status) {
      v.status = status;
      if (status === 'approved') {
        v.approved_at = new Date();
        v.rejected_at = null;
      } else {
        v.rejected_at = new Date();
        v.approved_at = null;
      }
      v.reviewed_by_id = user.id;
      // eslint-disable-next-line no-await-in-loop
      await v.save();
      updated += 1;
    }
  }
  return updated;
}

export async function approveLifetime({ objects, req }) {
  const n = await reviewLifetime(objects, req.user, 'approved');
  return { messages: [n > 0 ? success(`Successfully approved ${n} lifetime volunteer(s).`) : warning('No volunteers were updated.')] };
}

export async function rejectLifetime({ objects, req }) {
  const n = await reviewLifetime(objects, req.user, 'rejected');
  return { messages: [n > 0 ? success(`Successfully rejected ${n} lifetime volunteer(s).`) : warning('No volunteers were updated.')] };
}

// ---------------------------------------------------------------------------
// MaterialDonationAdmin.issue_donor_certificate
// ---------------------------------------------------------------------------
export async function issueMaterialCertificates({ objects }) {
  if (objects.length === 1) {
    const d = objects[0];
    if (d.status === 'received') return { redirect: `/admin/pehchan/materialdonation/issue-certificate/${d.id}/` };
    return { messages: [error('Only received donations can be issued certificates.')] };
  }
  let created = 0;
  let skipped = 0;
  let notReceived = 0;
  for (const d of objects) {
    if (d.status !== 'received') {
      notReceived += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    if (!(await DonorCertificate.count({ where: { material_donation_id: d.id } }))) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await DonorCertificate.create({
          user_id: d.user_id,
          donation_type: 'material',
          material_donation_id: d.id,
          issue_date: todayISO(),
          remarks: `Thank you for your generous donation of ${d.quantity} ${d.item_name}(s).`,
        });
        created += 1;
      } catch {
        skipped += 1;
      }
    } else skipped += 1;
  }
  const messages = [];
  if (created > 0) messages.push(success(`Successfully issued ${created} donor certificate(s).`));
  if (skipped > 0) messages.push(warning(`Skipped ${skipped} donation(s) that already have certificates.`));
  if (notReceived > 0) messages.push(warning(`Skipped ${notReceived} donation(s) that are not received.`));
  return { messages };
}

// ---------------------------------------------------------------------------
// MoneyDonationAdmin actions
// ---------------------------------------------------------------------------
export async function issueMoneyCertificates({ objects }) {
  const verified = objects.filter((d) => d.status === 'verified');
  const unverified = objects.length - verified.length;
  const messages = [];
  if (unverified > 0) messages.push(warning(`Skipped ${unverified} donation(s) that are not verified.`));
  if (!verified.length) return { messages };
  if (verified.length === 1) {
    return { messages, redirect: `/admin/pehchan/moneydonation/issue-certificate/${verified[0].id}/` };
  }
  let created = 0;
  let skipped = 0;
  for (const d of verified) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await DonorCertificate.count({ where: { money_donation_id: d.id } }))) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await DonorCertificate.create({
          user_id: d.user_id,
          donation_type: 'money',
          money_donation_id: d.id,
          issue_date: todayISO(),
          remarks: `Thank you for your generous donation of Rs. ${d.amount}.`,
        });
        created += 1;
      } catch {
        skipped += 1;
      }
    } else skipped += 1;
  }
  if (created > 0) messages.push(success(`Successfully issued ${created} donor certificate(s).`));
  if (skipped > 0) messages.push(warning(`Skipped ${skipped} donation(s) that already have certificates.`));
  return { messages };
}

export const setMoneyStatus = (status) => async ({ objects }) => {
  // queryset.update(status=...) – no message in the original
  await MoneyDonation.update({ status }, { where: { id: { [Op.in]: objects.map((o) => o.id) } } });
  return { messages: [] };
};

// ---------------------------------------------------------------------------
// ContactMessageAdmin actions
// ---------------------------------------------------------------------------
const ids = (objects) => objects.map((o) => o.id);

export async function contactMarkRead({ objects }) {
  const [n] = await ContactMessage.update(
    { status: 'read', updated_at: new Date() },
    { where: { id: { [Op.in]: ids(objects) }, status: 'new' } }
  );
  return { messages: [success(`${n} message(s) marked as read.`)] };
}

export async function contactMarkReplied({ objects }) {
  const [n] = await ContactMessage.update(
    { status: 'replied', responded_at: new Date(), updated_at: new Date() },
    { where: { id: { [Op.in]: ids(objects) }, status: { [Op.ne]: 'replied' } } }
  );
  return { messages: [success(`${n} message(s) marked as replied.`)] };
}

export async function contactArchive({ objects }) {
  const [n] = await ContactMessage.update({ status: 'archived', updated_at: new Date() }, { where: { id: { [Op.in]: ids(objects) } } });
  return { messages: [success(`${n} message(s) archived.`)] };
}

export const contactPriority = (priority, label) => async ({ objects }) => {
  const [n] = await ContactMessage.update({ priority, updated_at: new Date() }, { where: { id: { [Op.in]: ids(objects) } } });
  return { messages: [success(`${n} message(s) marked as ${label} priority.`)] };
};

export async function contactSendReply({ objects, req }) {
  let replied = 0;
  let errors = 0;
  const messages = [];
  for (const m of objects) {
    if (!m.response) {
      errors += 1;
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendMail({
        subject: `Re: ${m.name} - Contact Form Message`,
        message: m.response,
        from: config.DEFAULT_FROM_EMAIL,
        to: [m.email],
      });
      m.status = 'replied';
      m.responded_by_id = req.user.id;
      m.responded_at = new Date();
      // eslint-disable-next-line no-await-in-loop
      await m.save();
      replied += 1;
    } catch (e) {
      errors += 1;
      messages.push(error(`Failed to send reply to ${m.email}: ${e.message}`));
    }
  }
  if (replied > 0) messages.push(success(`Successfully sent ${replied} reply(ies).`));
  if (errors > 0) messages.push(error(`Failed to send ${errors} reply(ies).`));
  return { messages };
}
