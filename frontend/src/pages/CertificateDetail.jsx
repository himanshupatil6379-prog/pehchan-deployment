import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import { PageHeader, SkeletonCard } from '../components/dashboard/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import { dateFormat } from '../utils/filters.js';
import Error404 from './Error404.jsx';
import pageCss from './css/dashboard-certificates.css?inline';

/** React port of templates/certificate_detail.html (pehchan.views.certificate_detail). */
export default function CertificateDetail() {
  const request = useApi();
  const { pk } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setNotFound(false);
    request(`/certificates/${pk}/`, { signal: controller.signal })
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

  const event = (certificate && certificate.event) || {};
  const volunteerUser = (certificate && certificate.volunteer && certificate.volunteer.user) || {};

  return (
    <DashboardLayout title="Certificate Details - Pehchan" heading="Certificate Details" css={pageCss}>
      {!certificate ? (
        <div className="cert-detail">
          <SkeletonCard lines={6} label="Loading certificate" />
        </div>
      ) : (
        <div className="cert-detail">
          <PageHeader
            eyebrow="Volunteer Certificate"
            eyebrowIcon="verified"
            title={`Certificate #${certificate.certificate_number}`}
            actions={
              <>
                <Link to="/certificates/" className="md-btn md-btn--outlined">
                  <span className="md-icon" aria-hidden="true">
                    arrow_back
                  </span>
                  Back to My Certificates
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

          <article className="md-card cert-summary" aria-label={`Certificate #${certificate.certificate_number}`}>
            <div className="cert-summary__banner">
              <span className="cert-summary__seal" aria-hidden="true">
                <span className="md-icon">verified</span>
              </span>
              <div className="cert-summary__highlights">
                <div className="cert-summary__highlight">
                  <span className="cert-summary__label">
                    <span className="md-icon" aria-hidden="true">
                      event
                    </span>
                    Event Name
                  </span>
                  <p className="cert-summary__value cert-summary__value--lg">{event.name}</p>
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
                  <dt>Volunteer Name</dt>
                  <dd>{volunteerUser.full_name || volunteerUser.username}</dd>
                </div>
                <div className="dash-dl__row">
                  <dt>Event Date</dt>
                  <dd>{dateFormat(event.event_date, 'F d, Y')}</dd>
                </div>
                <div className="dash-dl__row">
                  <dt>Location</dt>
                  <dd>{event.location}</dd>
                </div>
              </dl>

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
