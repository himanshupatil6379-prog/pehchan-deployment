/**
 * Site views from pehchan/views.py (everything except authentication and the admin).
 */
import { Router } from 'express';
import { Op, fn, col, where as sqlWhere } from 'sequelize';
import config from '../config.js';
import sequelize from '../db.js';
import {
  User,
  Event,
  EventVolunteer,
  LifetimeVolunteer,
  Certificate,
  MaterialDonation,
  MoneyDonation,
  DonorCertificate,
  ContactMessage,
  AnonymousDonation,
} from '../models/index.js';
import { loginRequired } from '../middleware/auth.js';
import {
  FormErrors,
  ValidationError,
  cleanChar,
  cleanEmail,
  cleanInt,
  cleanDecimal,
  cleanBool,
  cleanContactNumber,
  validateIndianMobileNumber,
  FAKE_EMAIL_DOMAINS,
  MSG,
} from '../utils/forms.js';
import { parseMultipart, getFile, saveUpload, validateReceiptFile } from '../utils/uploads.js';
import { ah, success, error, warning, notFound, clientIp, intParam } from '../utils/http.js';
import * as S from '../utils/serializers.js';
import { todayISO } from '../../shared/dateformat.js';

const router = Router();

const MONTHS = [
  ['1', 'January'], ['2', 'February'], ['3', 'March'], ['4', 'April'],
  ['5', 'May'], ['6', 'June'], ['7', 'July'], ['8', 'August'],
  ['9', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
];

/** icontains with LIKE wildcards escaped */
const contains = (s) => ({ [Op.like]: `%${String(s).replace(/[\\%_]/g, (c) => `\\${c}`)}%` });

const eventInclude = [{ model: User, as: 'created_by' }];
const fullEventInclude = (as = 'event') => ({ model: Event, as, include: eventInclude });

/** Django Paginator + ListView page handling. Returns null when the page is invalid (404). */
function resolvePage(raw, count, perPage) {
  const numPages = Math.max(1, Math.ceil(count / perPage));
  let page;
  if (raw === undefined || raw === '') page = 1;
  else if (raw === 'last') page = numPages;
  else if (/^\d+$/.test(String(raw))) page = Number(raw);
  else return null;
  if (page < 1 || page > numPages) return null;
  return page;
}

function collectFieldErrors(errors) {
  const messages = [];
  Object.values(errors).forEach((list) => list.forEach((m) => messages.push(error(m))));
  return messages;
}

function runForm(cleaners) {
  const errors = new FormErrors();
  const cleaned = {};
  for (const [field, f] of Object.entries(cleaners)) {
    try {
      cleaned[field] = f();
    } catch (e) {
      if (e instanceof ValidationError) errors.add(field, e.messages);
      else throw e;
    }
  }
  return { cleaned, errors };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
router.get('/config/', (req, res) => {
  res.json({ ok: true, donation_upi_id: config.DONATION_UPI_ID });
});

// ---------------------------------------------------------------------------
// Contact form (home + dashboard)
// ---------------------------------------------------------------------------
router.post(
  '/contact/',
  ah(async (req, res) => {
    const body = req.body || {};
    const fromDashboard = body.source === 'dashboard';
    if (fromDashboard && !req.user) return loginRequired(req, res);
    const { cleaned, errors } = runForm({
      name: () => cleanChar(body.name, { maxLength: 200 }),
      email: () => cleanEmail(body.email, { maxLength: 254 }),
      message: () => cleanChar(body.message),
    });
    if (!errors.isValid) {
      return res.status(400).json({
        ok: false,
        errors: errors.errors,
        messages: [
          error(
            fromDashboard
              ? 'There was an error with your message. Please check the form and try again.'
              : 'Please correct the errors in the form.'
          ),
        ],
      });
    }
    await ContactMessage.create({
      ...cleaned,
      ip_address: clientIp(req, { forwarded: !fromDashboard }),
      user_agent: req.get('user-agent') || (fromDashboard ? null : ''),
    });
    if (fromDashboard) {
      return res.json({
        ok: true,
        messages: [success('Your message has been sent successfully. We will get back to you soon!')],
        redirect: '/dashboard/',
      });
    }
    return res.json({
      ok: true,
      messages: [success('Thank you for your message! We will get back to you soon.')],
      redirect: req.user ? '/dashboard/' : '/',
    });
  })
);

// ---------------------------------------------------------------------------
// Public events
// ---------------------------------------------------------------------------
function upcomingWhere(search) {
  const where = { event_date: { [Op.gte]: todayISO() } };
  if (search) {
    where[Op.or] = [{ name: contains(search) }, { description: contains(search) }, { location: contains(search) }];
  }
  return where;
}

router.get(
  '/events/public/',
  ah(async (req, res) => {
    const search = req.query.search || '';
    const events = await Event.findAll({ where: upcomingWhere(search), include: eventInclude, order: [['event_date', 'ASC'], ['id', 'ASC']] });
    res.json({ ok: true, events: events.map(S.event), search_query: search });
  })
);

async function fundraising(event) {
  let totalRaised = '0';
  let progress = 0;
  if (event.fundraising_goal !== null && event.fundraising_goal !== undefined && Number(event.fundraising_goal) !== 0) {
    const sum = await MoneyDonation.sum('amount', { where: { event_id: event.id, status: 'verified' } });
    if (sum) totalRaised = Number(sum).toFixed(2);
    progress = Math.min(100, Math.trunc((Number(totalRaised) / Number(event.fundraising_goal)) * 100));
  }
  return { total_raised: totalRaised, progress_percentage: progress };
}

router.get(
  '/events/public/:pk/',
  ah(async (req, res) => {
    const pk = intParam(req.params.pk);
    const event = pk && (await Event.findByPk(pk, { include: eventInclude }));
    if (!event) return notFound(res);
    let alreadyJoined = false;
    if (req.user) alreadyJoined = !!(await EventVolunteer.count({ where: { user_id: req.user.id, event_id: event.id } }));
    res.json({
      ok: true,
      event: S.event(event),
      already_joined: alreadyJoined,
      show_volunteer_form: !alreadyJoined,
      ...(await fundraising(event)),
    });
  })
);

// ---------------------------------------------------------------------------
// Anonymous donation (public_donate form_type=anonymous_donation)
// ---------------------------------------------------------------------------
router.post(
  '/donate/anonymous/',
  parseMultipart,
  ah(async (req, res) => {
    const b = req.body || {};
    const receipt = getFile(req, 'receipt');
    const optional = (v, max) => cleanChar(v, { required: false, maxLength: max }) || null;
    const { cleaned, errors } = runForm({
      donor_name: () => optional(b.donor_name, 200),
      donor_email: () => {
        let email = cleanEmail(b.donor_email, { required: false });
        if (email) {
          email = email.trim().toLowerCase();
          const domain = email.includes('@') ? email.split('@').pop() : '';
          if (FAKE_EMAIL_DOMAINS.includes(domain)) throw new ValidationError('Please provide a valid non-disposable email address.');
        }
        return email || null;
      },
      donor_phone: () => {
        const phone = optional(b.donor_phone, 20);
        return phone ? validateIndianMobileNumber(phone) : phone;
      },
      amount: () => cleanDecimal(b.amount, { maxDigits: 10, decimalPlaces: 2 }),
      transaction_id: () => optional(b.transaction_id, 100),
      receipt: () => {
        if (receipt) validateReceiptFile(receipt);
        return receipt;
      },
      wants_receipt: () => cleanBool(b.wants_receipt),
      message: () => cleanChar(b.message, { required: false }) || null,
    });
    if (!errors.isValid) {
      return res.status(400).json({ ok: false, errors: errors.errors, messages: [error('Please fill in the required fields correctly.')] });
    }
    const receiptPath = cleaned.receipt ? await saveUpload(cleaned.receipt, 'anonymous_donation_receipts') : null;
    await AnonymousDonation.create({ ...cleaned, receipt: receiptPath, ip_address: clientIp(req) });
    res.json({
      ok: true,
      messages: [success('Thank you for your anonymous donation! Your contribution has been recorded.')],
      redirect: '/donate-info/',
    });
  })
);

// ---------------------------------------------------------------------------
// Certificate verification (public)
// ---------------------------------------------------------------------------
const SAMPLE_ID = 'PYUI/2026/V/0042';
const SAMPLE_DATA = {
  certificate_number: 'PYUI/2026/V/0042',
  volunteer_name: 'Aniksha Upadhyay',
  event_name: 'Youth Empowerment Drive 2026',
  event_date: 'November 03, 2026',
  location: 'Mumbai',
  issue_date: 'November 03, 2026',
  reg_no: 'E-0015289 (THN)',
};

const certificateInclude = [
  fullEventInclude('event'),
  { model: EventVolunteer, as: 'volunteer', include: [{ model: User, as: 'user' }] },
];
const donorCertificateInclude = [
  { model: User, as: 'user' },
  { model: MaterialDonation, as: 'material_donation', include: [{ model: User, as: 'user' }] },
  { model: MoneyDonation, as: 'money_donation', include: [{ model: User, as: 'user' }, { model: Event, as: 'event' }] },
];

async function lookupCertificate(certId) {
  const lower = certId.toLowerCase();
  const certificate = await Certificate.findOne({
    where: sqlWhere(fn('LOWER', col('Certificate.certificate_number')), lower),
    include: certificateInclude,
  });
  let donor = null;
  if (!certificate) {
    donor = await DonorCertificate.findOne({
      where: sqlWhere(fn('LOWER', col('DonorCertificate.certificate_number')), lower),
      include: donorCertificateInclude,
    });
  }
  return { certificate, donor };
}

async function verifyResponse(certId) {
  const { certificate, donor } = await lookupCertificate(certId);
  if (!certificate && !donor) {
    if (certId === SAMPLE_ID) {
      return { ok: true, searched: true, certificate: null, donor_certificate: null, sample_verified: true, sample_data: SAMPLE_DATA };
    }
    return { ok: true, searched: true, certificate: null, donor_certificate: null, messages: [error('No certificate found with that ID.')] };
  }
  return { ok: true, searched: true, certificate: S.certificate(certificate), donor_certificate: S.donorCertificate(donor) };
}

router.get(
  '/certificates/verify/',
  ah(async (req, res) => {
    const certId = String(req.query.cert_id || '').trim();
    if (!certId) return res.json({ ok: true, searched: false, certificate: null, donor_certificate: null });
    res.json(await verifyResponse(certId));
  })
);

router.post(
  '/certificates/verify/',
  ah(async (req, res) => {
    let certId;
    try {
      certId = cleanChar(req.body?.certificate_id, { maxLength: 100 });
    } catch (e) {
      return res.status(400).json({ ok: false, searched: false, errors: { certificate_id: e.messages } });
    }
    res.json(await verifyResponse(certId.trim()));
  })
);

// ===========================================================================
// Login required from here on
// ===========================================================================

router.get(
  '/dashboard/',
  loginRequired,
  ah(async (req, res) => {
    const user = req.user;
    const upcomingSearch = String(req.query.upcoming_search || '').trim();
    const joinedSearch = String(req.query.joined_search || '').trim();

    const upcoming = await Event.findAll({ where: upcomingWhere(upcomingSearch), include: eventInclude, order: [['event_date', 'ASC'], ['id', 'ASC']] });

    const joinedEventWhere = joinedSearch
      ? { [Op.or]: [{ name: contains(joinedSearch) }, { description: contains(joinedSearch) }, { location: contains(joinedSearch) }] }
      : undefined;
    const joined = await EventVolunteer.findAll({
      where: { user_id: user.id },
      include: [{ ...fullEventInclude('event'), where: joinedEventWhere, required: true }, { model: User, as: 'user' }],
      order: [['joined_at', 'DESC']],
    });

    const certificates = await Certificate.findAll({
      include: [fullEventInclude('event'), { model: EventVolunteer, as: 'volunteer', where: { user_id: user.id }, include: [{ model: User, as: 'user' }] }],
      order: [['issue_date', 'DESC'], ['id', 'DESC']],
    });
    const donorCertificates = await DonorCertificate.findAll({
      where: { user_id: user.id },
      include: donorCertificateInclude,
      order: [['issue_date', 'DESC'], ['created_at', 'DESC']],
    });
    const material = await MaterialDonation.findAll({ where: { user_id: user.id }, include: [{ model: User, as: 'user' }], order: [['created_at', 'DESC']] });
    const money = await MoneyDonation.findAll({
      where: { user_id: user.id },
      include: [{ model: User, as: 'user' }, { model: Event, as: 'event' }],
      order: [['created_at', 'DESC']],
    });
    const lifetime = await LifetimeVolunteer.findOne({ where: { user_id: user.id } });

    let managed = null;
    if (user.is_staff) {
      managed = await Event.findAll({ where: { created_by_id: user.id }, include: eventInclude, order: [['created_at', 'DESC']], limit: 5 });
    }

    res.json({
      ok: true,
      upcoming_events: upcoming.map(S.event),
      joined_events: joined.map(S.eventVolunteer),
      managed_events: managed ? managed.map(S.event) : null,
      certificates: certificates.map(S.certificate),
      donor_certificates: donorCertificates.map(S.donorCertificate),
      material_donations: material.map(S.materialDonation),
      money_donations: money.map(S.moneyDonation),
      is_lifetime_volunteer: !!lifetime && lifetime.status === 'approved',
      lifetime_volunteer: lifetime ? S.lifetimeVolunteer(lifetime) : null,
      upcoming_search: upcomingSearch,
      joined_search: joinedSearch,
    });
  })
);

router.get(
  '/admin-dashboard/',
  loginRequired,
  ah(async (req, res) => {
    if (!req.user.is_staff) {
      return res.status(403).json({ ok: false, messages: [error('Access denied. Admin privileges required.')], redirect: '/dashboard/' });
    }
    const totalUsers = await User.count();
    const activeVolunteers = await EventVolunteer.count({ where: { status: 'approved' } });
    const upcomingCount = await Event.count({ where: { status: 'upcoming' } });
    const totalMoneyRaw = await MoneyDonation.sum('amount');
    let moneyDisplay;
    if (totalMoneyRaw === null || totalMoneyRaw === undefined) moneyDisplay = '₹0';
    else {
      const total = Number(totalMoneyRaw);
      if (total >= 100000) moneyDisplay = `₹${(total / 100000).toFixed(1)}L`;
      else if (total >= 1000) moneyDisplay = `₹${(total / 1000).toFixed(1)}K`;
      else moneyDisplay = `₹${total.toFixed(2)}`;
    }
    const recentUsers = await User.findAll({ order: [['date_joined', 'DESC']], limit: 5 });
    const recentEvents = await Event.findAll({ include: eventInclude, order: [['event_date', 'DESC']], limit: 5 });
    res.json({
      ok: true,
      total_users_count: totalUsers,
      active_volunteers_count: activeVolunteers,
      upcoming_events_count: upcomingCount,
      money_display: moneyDisplay,
      recent_users: recentUsers.map(S.userFull),
      recent_events: await Promise.all(
        recentEvents.map(async (e) => ({ ...S.event(e), volunteers_count: await EventVolunteer.count({ where: { event_id: e.id } }) }))
      ),
    });
  })
);

// EventListView (paginate_by = 3)
router.get(
  '/events/',
  loginRequired,
  ah(async (req, res) => {
    const search = req.query.search || '';
    const where = upcomingWhere(search);
    const count = await Event.count({ where });
    const page = resolvePage(req.query.page, count, 3);
    if (page === null) return notFound(res);
    const events = await Event.findAll({
      where,
      include: eventInclude,
      order: [['event_date', 'ASC'], ['id', 'ASC']],
      limit: 3,
      offset: (page - 1) * 3,
    });
    const pageObj = S.pageObj(page, 3, count);
    res.json({ ok: true, events: events.map(S.event), search_query: search, is_paginated: pageObj.num_pages > 1, page_obj: pageObj });
  })
);

// EventDetailView
router.get(
  '/events/:pk/',
  loginRequired,
  ah(async (req, res) => {
    const pk = intParam(req.params.pk);
    const event = pk && (await Event.findByPk(pk, { include: eventInclude }));
    if (!event) return notFound(res);
    const already = await EventVolunteer.findOne({ where: { user_id: req.user.id, event_id: event.id } });
    res.json({ ok: true, event: S.event(event), already_joined: !!already, show_volunteer_form: !already });
  })
);

// join_event
router.post(
  '/events/:pk/join/',
  loginRequired,
  ah(async (req, res) => {
    const pk = intParam(req.params.pk);
    const event = pk && (await Event.findByPk(pk));
    if (!event) return notFound(res);
    const redirect = `/dashboard/events/${event.id}/`;
    if (await EventVolunteer.count({ where: { user_id: req.user.id, event_id: event.id } })) {
      return res.json({ ok: false, messages: [warning('You have already joined this event!')], redirect });
    }
    let contact;
    try {
      contact = cleanContactNumber(req.body?.contact_number);
    } catch (e) {
      return res.json({ ok: false, errors: { contact_number: e.messages }, messages: e.messages.map(error), redirect });
    }
    await EventVolunteer.create({ user_id: req.user.id, event_id: event.id, contact_number: contact });
    res.json({ ok: true, messages: [success(`Successfully joined ${event.name} as a volunteer!`)], redirect });
  })
);

// LifetimeVolunteerCreateView
router.post(
  '/volunteer/lifetime/',
  loginRequired,
  ah(async (req, res) => {
    const b = req.body || {};
    const { cleaned, errors } = runForm({
      contact_number: () => cleanContactNumber(b.contact_number),
      motivation: () => cleanChar(b.motivation),
    });
    // ModelForm unique validation for the OneToOne user field is not part of the form (user excluded)
    if (!errors.isValid) return res.status(400).json({ ok: false, errors: errors.errors });
    if (await LifetimeVolunteer.count({ where: { user_id: req.user.id } })) {
      return res.json({ ok: false, messages: [warning('You have already applied to become a lifetime volunteer!')], redirect: '/dashboard/' });
    }
    await LifetimeVolunteer.create({ user_id: req.user.id, ...cleaned });
    res.json({
      ok: true,
      messages: [success('Your application to become a lifetime volunteer has been submitted. It is pending approval.')],
      redirect: '/dashboard/',
    });
  })
);

// CertificateListView (paginate_by = 5)
function monthFilter(column, month) {
  return month && /^\d+$/.test(month) ? sqlWhere(fn('MONTH', col(column)), Number(month)) : null;
}

router.get(
  '/certificates/',
  loginRequired,
  ah(async (req, res) => {
    const search = req.query.search || '';
    const month = req.query.month || '';
    const sort = req.query.sort || 'newest';
    const and = [];
    if (search) {
      and.push({ [Op.or]: [{ certificate_number: contains(search) }, { '$event.name$': contains(search) }] });
    }
    const mf = monthFilter('Certificate.issue_date', month);
    if (mf) and.push(mf);
    const where = and.length ? { [Op.and]: and } : undefined;
    const include = [
      fullEventInclude('event'),
      { model: EventVolunteer, as: 'volunteer', where: { user_id: req.user.id }, include: [{ model: User, as: 'user' }] },
    ];
    const count = await Certificate.count({ where, include, distinct: true, col: 'id' });
    const page = resolvePage(req.query.page, count, 5);
    if (page === null) return notFound(res);
    const order = sort === 'oldest' ? [['issue_date', 'ASC'], ['id', 'ASC']] : [['issue_date', 'DESC'], ['id', 'DESC']];
    const rows = await Certificate.findAll({ where, include, order, limit: 5, offset: (page - 1) * 5, subQuery: false });
    const pageObj = S.pageObj(page, 5, count);
    res.json({
      ok: true,
      certificates: rows.map(S.certificate),
      search_query: req.query.search || '',
      current_month: month,
      current_sort: sort,
      months: MONTHS,
      is_paginated: pageObj.num_pages > 1,
      page_obj: pageObj,
    });
  })
);

// DonorCertificateListView (paginate_by = 5)
router.get(
  '/certificates/donor/',
  loginRequired,
  ah(async (req, res) => {
    const search = req.query.search || '';
    const month = req.query.month || '';
    const sort = req.query.sort || 'newest';
    const and = [{ user_id: req.user.id }];
    if (search) {
      and.push({
        [Op.or]: [
          { certificate_number: contains(search) },
          { '$material_donation.item_name$': contains(search) },
          { donation_type: contains(search) },
        ],
      });
    }
    const mf = monthFilter('DonorCertificate.issue_date', month);
    if (mf) and.push(mf);
    const where = { [Op.and]: and };
    const count = await DonorCertificate.count({ where, include: [{ model: MaterialDonation, as: 'material_donation' }], distinct: true, col: 'id' });
    const page = resolvePage(req.query.page, count, 5);
    if (page === null) return notFound(res);
    const order = sort === 'oldest' ? [['issue_date', 'ASC'], ['created_at', 'ASC']] : [['issue_date', 'DESC'], ['created_at', 'DESC']];
    const rows = await DonorCertificate.findAll({ where, include: donorCertificateInclude, order, limit: 5, offset: (page - 1) * 5, subQuery: false });
    const pageObj = S.pageObj(page, 5, count);
    res.json({
      ok: true,
      donor_certificates: rows.map(S.donorCertificate),
      search_query: req.query.search || '',
      current_month: month,
      current_sort: sort,
      months: MONTHS,
      is_paginated: pageObj.num_pages > 1,
      page_obj: pageObj,
    });
  })
);

router.get(
  '/certificates/donor/:pk/',
  loginRequired,
  ah(async (req, res) => {
    const pk = intParam(req.params.pk);
    const cert = pk && (await DonorCertificate.findOne({ where: { id: pk, user_id: req.user.id }, include: donorCertificateInclude }));
    if (!cert) return notFound(res);
    res.json({ ok: true, certificate: S.donorCertificate(cert) });
  })
);

router.get(
  '/certificates/:pk/',
  loginRequired,
  ah(async (req, res) => {
    const pk = intParam(req.params.pk);
    const cert =
      pk &&
      (await Certificate.findOne({
        where: { id: pk },
        include: [fullEventInclude('event'), { model: EventVolunteer, as: 'volunteer', where: { user_id: req.user.id }, include: [{ model: User, as: 'user' }] }],
      }));
    if (!cert) return notFound(res);
    res.json({ ok: true, certificate: S.certificate(cert) });
  })
);

// MaterialDonationCreateView
router.post(
  '/donations/material/',
  loginRequired,
  ah(async (req, res) => {
    const b = req.body || {};
    const { cleaned, errors } = runForm({
      item_name: () => cleanChar(b.item_name, { maxLength: 200 }),
      quantity: () => cleanInt(b.quantity, { minValue: 1 }),
      location: () => cleanChar(b.location, { maxLength: 200 }),
      contact_number: () => cleanContactNumber(b.contact_number),
      message: () => cleanChar(b.message, { required: false }),
    });
    if (!errors.isValid) return res.status(400).json({ ok: false, errors: errors.errors });
    const donation = await MaterialDonation.create({ user_id: req.user.id, ...cleaned });
    res.json({
      ok: true,
      messages: [
        success(
          `🌟 Thanks for your contribution! ❤️ You will receive a confirmation email once your donation is processed. ✨ ${donation.getPickupMessage()}`
        ),
      ],
      redirect: '/dashboard/',
    });
  })
);

// MoneyDonationCreateView
router.get('/donations/money/', loginRequired, (req, res) => {
  res.json({ ok: true, upi_id: config.DONATION_UPI_ID });
});

router.post(
  '/donations/money/',
  loginRequired,
  parseMultipart,
  ah(async (req, res) => {
    const b = req.body || {};
    const receipt = getFile(req, 'receipt_upload');
    const { cleaned, errors } = runForm({
      amount: () => cleanDecimal(b.amount, { maxDigits: 10, decimalPlaces: 2, minValue: '0.01' }),
      contact_number: () => cleanContactNumber(b.contact_number),
      receipt_upload: () => {
        if (!receipt) throw new ValidationError(MSG.required);
        validateReceiptFile(receipt);
        return receipt;
      },
    });
    if (!errors.isValid) return res.status(400).json({ ok: false, errors: errors.errors });
    const receiptPath = await saveUpload(cleaned.receipt_upload, 'receipts');
    await sequelize.transaction(async (t) => {
      await MoneyDonation.create(
        {
          user_id: req.user.id,
          amount: cleaned.amount,
          contact_number: cleaned.contact_number,
          receipt_upload: receiptPath,
          payment_method: 'upi',
          upi_id: config.DONATION_UPI_ID,
        },
        { transaction: t }
      );
    });
    res.json({
      ok: true,
      messages: [success('🌟 Thanks for your contribution! ❤️ You will receive a confirmation email once your donation is processed. ✨')],
      redirect: '/dashboard/',
    });
  })
);

export default router;
export { collectFieldErrors };
