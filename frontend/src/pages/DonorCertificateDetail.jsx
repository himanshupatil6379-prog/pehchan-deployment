import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import { PageHeader, SkeletonCard } from '../components/dashboard/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import { dateFormat } from '../utils/filters.js';
import Error404 from './Error404.jsx';
import pageCss from './css/dashboard-certificates.css?inline';

/** React port of templates/donor_certificate_detail.html (pehchan.views.donor_certificate_detail). */
export default function DonorCertificateDetail() {
  const request = useApi();
  const { pk } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setNotFound(false);
    request(`/certificates/donor/${pk}/`, { signal: controller.signal })
      .then((res) => {
        if (!active || res.redirected) return;
        if (res.status === 404) setNotFound(true);
        else if (res.ok) setCertificate(res.data.certificate);
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pk]);

  if (notFound) return <Error404 />;

  const user = (certificate && certificate.user) || {};

  return (
    <DashboardLayout title="Donor Certificate Details - Pehchan" heading="Donor Certificate Details" css={pageCss}>
      {!certificate ? (
        <div className="cert-detail">
          <SkeletonCard lines={6} label="Loading donor certificate" />
        </div>
      ) : (
        <div className="cert-detail">
          <PageHeader
            eyebrow="Donor Certificate"
            eyebrowIcon="workspace_premium"
            title={`Donor Certificate #${certificate.certificate_number}`}
            actions={
              <>
                <Link to="/certificates/donor/" className="md-btn md-btn--outlined">
                  <span className="md-icon" aria-hidden="true">
                    arrow_back
                  </span>
                  Back to Donor Certificates
                </Link>
                <Link to="/dashboard/" className="md-btn md-btn--text">
                  <span className="md-icon" aria-hidden="true">
                    home
                  </span>
                  Home
                </Link>
              </>
            }
          />

          <article className="md-card cert-summary" aria-label={`Donor Certificate #${certificate.certificate_number}`}>
            <div className="cert-summary__banner">
              <span className="cert-summary__seal" aria-hidden="true">
                <span className="md-icon">workspace_premium</span>
              </span>
              <div className="cert-summary__highlights">
                <div className="cert-summary__highlight">
                  <span className="cert-summary__label">
                    <span className="md-icon" aria-hidden="true">
                      card_giftcard
                    </span>
                    Donation Type
                  </span>
                  <p className="cert-summary__value cert-summary__value--lg">{certificate.donation_type_display}</p>
                </div>
                <div className="cert-summary__highlight">
                  <span className="cert-summary__label">
                    <span className="md-icon" aria-hidden="true">
                      calendar_today
                    </span>
                    Issue Date
                  </span>
                  <p className="cert-summary__value">{dateFormat(certificate.issue_date, 'F d, Y')}</p>
                </div>
              </div>
            </div>

            <div className="md-card__content cert-summary__body">
              <dl className="dash-dl">
                <div className="dash-dl__row">
                  <dt>Certificate Number</dt>
                  <dd>
                    <span className="dash-code">{certificate.certificate_number}</span>
                  </dd>
                </div>
                <div className="dash-dl__row">
                  <dt>Donor Name</dt>
                  <dd>{user.full_name || user.username}</dd>
                </div>
                <div className="dash-dl__row">
                  <dt>Donation Details</dt>
                  <dd className="cert-strong">{certificate.donation_details}</dd>
                </div>
                <div className="dash-dl__row">
                  <dt>Issued By</dt>
                  <dd>{certificate.issued_by}</dd>
                </div>
              </dl>

              {certificate.remarks && (
                <div className="dash-note dash-note--tertiary cert-remarks">
                  <span className="md-icon" aria-hidden="true">
                    message
                  </span>
                  <div className="dash-note__body">
                    <h2 className="dash-note__title">Appreciation Message</h2>
                    <p>{certificate.remarks}</p>
                  </div>
                </div>
              )}

              {certificate.file && (
                <div className="cert-file">
                  <span className="cert-file__icon" aria-hidden="true">
                    <span className="md-icon">description</span>
                  </span>
                  <h2 className="cert-file__title">Certificate File Available</h2>
                  <a href={certificate.file} target="_blank" rel="noopener noreferrer" className="md-btn md-btn--filled md-btn--lg">
                    <span className="md-icon" aria-hidden="true">
                      download
                    </span>
                    Download Original Certificate
                  </a>
                </div>
              )}
            </div>
          </article>
        </div>
      )}
    </DashboardLayout>
  );
}
