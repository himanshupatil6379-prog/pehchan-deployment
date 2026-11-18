/** JSON shapes documented in docs/API.md */
import { mediaUrl } from './uploads.js';
import {
  EVENT_VOLUNTEER_STATUS_CHOICES,
  LIFETIME_STATUS_CHOICES,
  MATERIAL_STATUS_CHOICES,
  MONEY_STATUS_CHOICES,
  PAYMENT_METHOD_CHOICES,
  DONATION_TYPE_CHOICES,
} from '../models/index.js';

export const display = (choices, value) => {
  const found = choices.find(([v]) => v === value);
  return found ? found[1] : value;
};

const iso = (d) => (d ? new Date(d).toISOString() : null);

export function userLite(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    first_name: u.first_name,
    last_name: u.last_name,
    full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
    email: u.email,
  };
}

export function userFull(u) {
  if (!u) return null;
  return {
    ...userLite(u),
    is_staff: !!u.is_staff,
    is_superuser: !!u.is_superuser,
    is_active: !!u.is_active,
    date_joined: iso(u.date_joined),
    last_login: iso(u.last_login),
  };
}

export function event(e) {
  if (!e) return null;
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    event_date: e.event_date,
    location: e.location,
    image: mediaUrl(e.image),
    is_active: !!e.is_active,
    fundraising_goal: e.fundraising_goal ?? null,
    status: e.status,
    status_display: e.getStatusDisplay(),
    created_by: userLite(e.created_by),
    created_at: iso(e.created_at),
    updated_at: iso(e.updated_at),
  };
}

export function eventVolunteer(v) {
  if (!v) return null;
  return {
    id: v.id,
    event: v.event ? event(v.event) : null,
    event_id: v.event_id,
    user: userLite(v.user),
    contact_number: v.contact_number,
    joined_at: iso(v.joined_at),
    status: v.status,
    status_display: display(EVENT_VOLUNTEER_STATUS_CHOICES, v.status),
    attended: !!v.attended,
  };
}

export function certificate(c) {
  if (!c) return null;
  const v = c.volunteer;
  return {
    id: c.id,
    certificate_number: c.certificate_number,
    issue_date: c.issue_date,
    file: mediaUrl(c.file),
    event: event(c.event),
    volunteer: v
      ? {
          id: v.id,
          status: v.status,
          status_display: display(EVENT_VOLUNTEER_STATUS_CHOICES, v.status),
          attended: !!v.attended,
          joined_at: iso(v.joined_at),
          contact_number: v.contact_number,
          user: userLite(v.user),
        }
      : null,
  };
}

export function materialDonation(d) {
  if (!d) return null;
  return {
    id: d.id,
    item_name: d.item_name,
    quantity: d.quantity,
    location: d.location,
    contact_number: d.contact_number,
    message: d.message,
    status: d.status,
    status_display: display(MATERIAL_STATUS_CHOICES, d.status),
    created_at: iso(d.created_at),
    pickup_message: d.getPickupMessage(),
    user: userLite(d.user),
  };
}

export function moneyDonation(d) {
  if (!d) return null;
  return {
    id: d.id,
    amount: d.amount,
    payment_method: d.payment_method,
    payment_method_display: display(PAYMENT_METHOD_CHOICES, d.payment_method),
    upi_id: d.upi_id,
    contact_number: d.contact_number,
    receipt_upload: mediaUrl(d.receipt_upload),
    status: d.status,
    status_display: display(MONEY_STATUS_CHOICES, d.status),
    created_at: iso(d.created_at),
    event: d.event ? { id: d.event.id, name: d.event.name } : null,
    user: userLite(d.user),
  };
}

export function donorCertificate(c) {
  if (!c) return null;
  return {
    id: c.id,
    certificate_number: c.certificate_number,
    donation_type: c.donation_type,
    donation_type_display: display(DONATION_TYPE_CHOICES, c.donation_type),
    issue_date: c.issue_date,
    issued_by: c.issued_by,
    remarks: c.remarks,
    file: mediaUrl(c.file),
    created_at: iso(c.created_at),
    updated_at: iso(c.updated_at),
    user: userLite(c.user),
    material_donation: materialDonation(c.material_donation),
    money_donation: moneyDonation(c.money_donation),
    donation_details: c.getDonationDetails(),
  };
}

export function lifetimeVolunteer(l) {
  if (!l) return null;
  return {
    id: l.id,
    contact_number: l.contact_number,
    motivation: l.motivation,
    status: l.status,
    status_display: display(LIFETIME_STATUS_CHOICES, l.status),
    joined_at: iso(l.joined_at),
    approved_at: iso(l.approved_at),
    rejected_at: iso(l.rejected_at),
  };
}

export function pageObj(page, perPage, count) {
  const numPages = Math.max(1, Math.ceil(count / perPage));
  return {
    number: page,
    num_pages: numPages,
    count,
    has_previous: page > 1,
    has_next: page < numPages,
    previous_page_number: page > 1 ? page - 1 : null,
    next_page_number: page < numPages ? page + 1 : null,
    start_index: count === 0 ? 0 : (page - 1) * perPage + 1,
    end_index: Math.min(page * perPage, count),
  };
}
