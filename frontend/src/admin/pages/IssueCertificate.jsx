import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { useAdminPage, useAdminRequest, useReloadPage } from '../AdminContext.jsx';
import { errorPageFor } from './Errors.jsx';
import { apiPathFor, formatLongDate } from '../utils.js';
import { statusTone } from '../icons.js';

const DEFAULTS = {
  volunteer: { certificate_type: 'Volunteer', title: 'Issue Volunteer Certificate', changelist: '/admin/pehchan/eventvolunteer/' },
  material: {
    certificate_type: 'Material Donation',
    title: 'Issue Material Donation Certificate',
    changelist: '/admin/pehchan/materialdonation/',
  },
  money: { certificate_type: 'Donor (Money)', title: 'Issue Money Donation Certificate', changelist: '/admin/pehchan/moneydonation/' },
};

function Status({ value }) {
  const tone = statusTone(value);
  return tone ? <span className={`md-chip md-chip--${tone}`}>{value}</span> : <>{value}</>;
}

function DetailList({ rows }) {
  return (
    <dl className="adm-dl">
      {rows.map(([label, value]) => (
        <div className="adm-dl__row" key={label}>
          <dt>{label}:</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** templates/admin/issue_certificate.html (extends admin/base_site.html) */
export default function IssueCertificatePage({ kind }) {
  const location = useLocation();
  const page = useAdminPage();
  const request = useAdminRequest();
  const reload = useReloadPage();
  const [busy, setBusy] = useState(false);

  const err = errorPageFor(page);
  if (err) return err;
  const data = page.data || {};
  const def = DEFAULTS[kind] || DEFAULTS.volunteer;
  const certificateType = data.certificate_type || def.certificate_type;
  const title = data.title || def.title;
  const year = data.year || new Date().getFullYear();
  const volunteer = data.volunteer || null;
  const donation = data.donation || null;
  const cancelUrl = data.cancel_url || def.changelist;
  const isMaterial = donation && (donation.kind === 'material' || donation.item_name != null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData();
    const file = form.elements.certificate_file && form.elements.certificate_file.files[0];
    if (file) fd.append('certificate_file', file);
    setBusy(true);
    const res = await request(apiPathFor(location), { method: 'POST', formData: fd });
    if (res.redirected || res.handled) return;
    setBusy(false);
    reload();
  };

  return (
    <AdminLayout
      title={title}
      heading={`Issue ${certificateType} Certificate`}
      overline="Certificates"
      docTitle={`Issue ${certificateType} Certificate`}
      pending={!page.data}
    >
      <div className="container adm-issue">
        {volunteer ? (
          <section className="md-card card adm-issue__details" aria-labelledby="adm-issue-details">
            <div className="md-card__header card-header">
              <span className="md-card__icon" aria-hidden="true">
                <span className="md-icon">diversity_3</span>
              </span>
              <h2 className="md-card__title" id="adm-issue-details">
                Volunteer Details
              </h2>
            </div>
            <div className="md-card__content card-body">
              <DetailList
                rows={[
                  ['User', `${volunteer.user_full_name} (${volunteer.username})`],
                  ['Event', volunteer.event_name],
                  ['Status', <Status key="s" value={volunteer.status_display} />],
                  ['Joined Date', formatLongDate(volunteer.joined_at)],
                ]}
              />
            </div>
          </section>
        ) : null}

        {donation ? (
          <section className="md-card card adm-issue__details" aria-labelledby="adm-issue-details">
            <div className="md-card__header card-header">
              <span className="md-card__icon" aria-hidden="true">
                <span className="md-icon">{isMaterial ? 'inventory_2' : 'payments'}</span>
              </span>
              <h2 className="md-card__title" id="adm-issue-details">
                Donation Details
              </h2>
            </div>
            <div className="md-card__content card-body">
              {isMaterial ? (
                <DetailList
                  rows={[
                    ['Donor', `${donation.user_full_name} (${donation.username})`],
                    ['Item', donation.item_name],
                    ['Quantity', donation.quantity],
                    ['Location', donation.location],
                    ['Status', <Status key="s" value={donation.status_display} />],
                    ['Donation Date', formatLongDate(donation.created_at)],
                  ]}
                />
              ) : (
                <DetailList
                  rows={[
                    ['Donor', `${donation.user_full_name} (${donation.username})`],
                    ['Amount', <span key="a" className="adm-num">₹{donation.amount}</span>],
                    ['Payment Method', donation.payment_method_display],
                    ['Donation Date', formatLongDate(donation.created_at)],
                  ]}
                />
              )}
            </div>
          </section>
        ) : null}

        <section className="md-card card adm-issue__form" aria-labelledby="adm-issue-form">
          <div className="md-card__header card-header">
            <span className="md-card__icon" aria-hidden="true">
              <span className="md-icon">workspace_premium</span>
            </span>
            <h2 className="md-card__title" id="adm-issue-form">
              Certificate Information
            </h2>
          </div>
          <form method="post" encType="multipart/form-data" onSubmit={onSubmit} className="card-body" aria-busy={busy ? 'true' : undefined}>
            <div className="md-card__content adm-stack">
              <div className="form-group adm-field">
                <span className="md-field__label adm-field__label">Certificate Number:</span>
                <p className="form-control-static adm-readonly">
                  <em>Will be auto-generated automatically (e.g., PYUI/{year}/...)</em>
                </p>
              </div>
              <div className="form-group adm-field">
                <label htmlFor="certificate_file" className="md-field__label adm-field__label">
                  Certificate File (Optional):
                </label>
                <input
                  type="file"
                  className="form-control-file md-input"
                  id="certificate_file"
                  name="certificate_file"
                  aria-describedby="certificate_file_help"
                />
                <small className="form-text text-muted md-field__helper" id="certificate_file_help">
                  Upload a certificate file (PDF, JPG, PNG)
                </small>
              </div>
            </div>
            <div className="adm-card-actions">
              <Link to={cancelUrl} className="btn btn-secondary md-btn md-btn--text">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary md-btn md-btn--filled">
                <span className="md-icon" aria-hidden="true">
                  workspace_premium
                </span>
                Issue Certificate
              </button>
            </div>
          </form>
        </section>
      </div>
    </AdminLayout>
  );
}
