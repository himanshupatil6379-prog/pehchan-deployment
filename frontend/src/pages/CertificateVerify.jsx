import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout, { MessageAlerts } from '../components/dashboard/DashboardLayout.jsx';
import { PageHeader } from '../components/dashboard/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDisplayedMessages } from '../context/MessagesContext.jsx';
import { dateFormat, title } from '../utils/filters.js';
import pageCss from './css/certificate-verify.css?inline';

/** `{% url 'certificate_verify' %}` – the form's action. */
const ACTION_URL = '/dashboard/verify-certificate/';

const EMPTY_RESULT = { certificate: null, donor_certificate: null, sample_verified: false, sample_data: null, invalid: false };

/** QueryDict.get(): last value of a key, or `fallback` when the key is absent. */
function getParam(searchParams, key, fallback) {
  const all = searchParams.getAll(key);
  return all.length ? all[all.length - 1] : fallback;
}

function toResult(d) {
  return {
    certificate: d.certificate || null,
    donor_certificate: d.donor_certificate || null,
    sample_verified: !!d.sample_verified,
    sample_data: d.sample_data || null,
    invalid: !!(d.errors && d.errors.certificate_id),
  };
}

function copyEmail() {
  const email = 'madad@pehchanyui.in';
  navigator.clipboard.writeText(email).then(() => {
    alert('Email address copied to clipboard!');
  });
}

/** One labelled value in a verification result. */
function Credential({ label, children, wide, emphasis }) {
  return (
    <div className={`cv-cred${wide ? ' cv-cred--wide' : ''}`}>
      <dt className="cv-cred__label">{label}</dt>
      <dd className={`cv-cred__value${emphasis ? ` cv-cred__value--${emphasis}` : ''}`}>{children}</dd>
    </div>
  );
}

/** Result card header + "authentic" banner. */
function ResultHeader({ heading, banner, bannerText, id }) {
  return (
    <>
      <div className="cv-result__header">
        <span className="cv-result__seal" aria-hidden="true">
          <span className="md-icon">verified</span>
        </span>
        <h2 className="cv-result__title" id={id}>
          {heading}
        </h2>
      </div>
      <div className="dash-note dash-note--success cv-result__banner">
        <span className="md-icon" aria-hidden="true">
          check_circle
        </span>
        <div className="dash-note__body">
          <h3 className="dash-note__title">{banner}</h3>
          {bannerText && <p>{bannerText}</p>}
        </div>
      </div>
    </>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <h3 className="cv-section-title">
      <span className="md-icon" aria-hidden="true">
        {icon}
      </span>
      {children}
    </h3>
  );
}

/**
 * React port of templates/certificate_verify.html (pehchan.views.certificate_verify).
 * Mounted at /verify-certificate/ and /dashboard/verify-certificate/.
 *  - GET ?cert_id=…  -> GET /api/certificates/verify/?cert_id=…   (QR-code flow)
 *  - form POST       -> POST /api/certificates/verify/, result rendered at the form's action URL
 * Logged-in users get the dashboard shell, anonymous visitors the public M3 shell.
 */
export default function CertificateVerify() {
  const request = useApi();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const messages = useDisplayedMessages();

  const posted = (location.state && location.state.certificateVerify) || null;
  const certIdParam = getParam(searchParams, 'cert_id', '').trim();

  const [value, setValue] = useState(posted ? posted.value : certIdParam);
  const [result, setResult] = useState(posted ? posted.result : EMPTY_RESULT);
  const submittingRef = useRef(false);

  useEffect(() => {
    // Result of a POST submitted from this page (bound form + result).
    if (posted) {
      setValue(posted.value);
      setResult(posted.result);
      return undefined;
    }
    // GET: form = CertificateVerificationForm(initial={'certificate_id': cert_id_param})
    setValue(certIdParam);
    if (!certIdParam) {
      setResult(EMPTY_RESULT);
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    request('/certificates/verify/', { query: { cert_id: certIdParam }, signal: controller.signal })
      .then((res) => {
        if (!active || res.redirected) return;
        setResult(toResult(res.data || {}));
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    const submitted = value;
    try {
      const res = await request('/certificates/verify/', { method: 'POST', data: { certificate_id: submitted } });
      if (res.redirected || res.status === 0) return;
      // The POST response is rendered at the form's action URL.
      navigate(ACTION_URL, { state: { certificateVerify: { value: submitted, result: toResult(res.data || {}) } } });
    } finally {
      submittingRef.current = false;
    }
  };

  const { certificate, donor_certificate: donorCertificate, sample_verified: sampleVerified, sample_data: sampleData } = result;

  const emailNote = (
    <>
      <strong>Note:</strong> For verification of the final certificate, please{' '}
      <a href="mailto:madad@pehchanyui.in" className="cv-link">
        mail us at madad@pehchanyui.in
      </a>{' '}
    </>
  );

  return (
    <DashboardLayout
      title="Verify Certificate - Pehchan"
      heading="Verify Certificate"
      css={pageCss}
      variant={user ? 'app' : 'public'}
      hideMessages
    >
      <div className="cv-page">
        <div className="no-print">
          <PageHeader
            eyebrow="Certificate Verification"
            eyebrowIcon="verified_user"
            title="Verify Certificate"
          />
        </div>

        <section className="md-card verification-card no-print" aria-label="Verify a certificate">
          <div className="md-card__content cv-form-card">
            <div className="dash-note dash-note--info">
              <span className="md-icon" aria-hidden="true">
                info
              </span>
              <div className="dash-note__body">
                <p>
                  Enter a certificate number to verify its authenticity. This search is <strong>case-sensitive</strong>.
                </p>
              </div>
            </div>

            <form method="post" action={ACTION_URL} onSubmit={onSubmit} className="cv-form">
              <div className={`md-field${result.invalid ? ' md-field--error' : ''}`}>
                <label className="md-field__label cv-label" htmlFor="certificate_id">
                  <span className="md-icon" aria-hidden="true">
                    tag
                  </span>
                  Certificate Number
                </label>
                <div className="cv-input">
                  <input
                    type="text"
                    name="certificate_id"
                    className="md-input"
                    id="certificate_id"
                    placeholder="Enter Certificate ID (e.g. VOL-2024-001)"
                    maxLength="100"
                    required
                    autoComplete="off"
                    spellCheck="false"
                    aria-invalid={result.invalid ? 'true' : undefined}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="md-btn md-btn--filled md-btn--lg md-btn--block">
                <span className="md-icon" aria-hidden="true">
                  search
                </span>
                Verify Certificate
              </button>
            </form>

            <MessageAlerts messages={messages} className="cv-alerts" />

            <div className="verification-note">
              <span className="md-icon" aria-hidden="true">
                mail
              </span>
              <p>
                {emailNote}
                or{' '}
                <button type="button" className="copy-link" onClick={copyEmail}>
                  click here to copy the email address
                </button>{' '}
                from the official mail id of your organization.
              </p>
            </div>
          </div>
        </section>

        {sampleVerified && (
          <article className="md-card result-card cv-result" aria-labelledby="cv-sample-title">
            <ResultHeader
              id="cv-sample-title"
              heading="Official Certificate Verified"
              banner={<>Authentic &amp; Validated Certificate</>}
              bannerText={
                <>
                  Issued by <strong>Pehchan YUI Foundation</strong> • Public Trust Reg. No:{' '}
                  <strong>{sampleData && sampleData.reg_no}</strong>
                </>
              }
            />
            <div className="cv-result__body">
              <SectionTitle icon="badge">Certificate Credentials</SectionTitle>
              <dl className="cv-creds">
                <Credential label="Certificate Number" emphasis="code">
                  {sampleData && sampleData.certificate_number}
                </Credential>
                <Credential label="Recipient / Volunteer Name" emphasis="strong">
                  {sampleData && sampleData.volunteer_name}
                </Credential>
                <Credential label="Event / Initiative" wide emphasis="strong">
                  {sampleData && sampleData.event_name}
                </Credential>
                <Credential label="Event Date & Location">
                  {sampleData && sampleData.event_date} ({sampleData && sampleData.location})
                </Credential>
                <Credential label="Date of Issue">{sampleData && sampleData.issue_date}</Credential>
              </dl>

              <div className="cv-actions no-print">
                <Link to="/sample-certificate/" className="md-btn md-btn--filled md-btn--lg">
                  <span className="md-icon" aria-hidden="true">
                    workspace_premium
                  </span>
                  View Full Certificate Design
                </Link>
                <button type="button" onClick={() => window.print()} className="md-btn md-btn--outlined md-btn--lg">
                  <span className="md-icon" aria-hidden="true">
                    print
                  </span>
                  Print Verification Record
                </button>
              </div>
            </div>
          </article>
        )}

        {certificate ? (
          <article className="md-card result-card cv-result" aria-labelledby="cv-cert-title">
            <ResultHeader id="cv-cert-title" heading="Certificate Verified!" banner="Authentic Volunteer Certificate" />
            <div className="cv-result__body">
              <SectionTitle icon="person">Volunteer Details</SectionTitle>
              <dl className="cv-creds">
                <Credential label="Certificate Number" emphasis="code">
                  {certificate.certificate_number}
                </Credential>
                <Credential label="Volunteer Name" emphasis="strong">
                  {certificate.volunteer?.user?.full_name || certificate.volunteer?.user?.username}
                </Credential>
                <Credential label="Event" wide emphasis="strong">
                  {certificate.event?.name}
                </Credential>
                <Credential label="Event Date">{dateFormat(certificate.event?.event_date, 'F d, Y')}</Credential>
                <Credential label="Issue Date">{dateFormat(certificate.issue_date, 'F d, Y')}</Credential>
              </dl>

              <div className="verification-note no-print">
                <span className="md-icon" aria-hidden="true">
                  mail
                </span>
                <p>{emailNote}from the official mail id of your organization.</p>
              </div>

              <div className="cv-actions no-print">
                <button type="button" onClick={() => window.print()} className="md-btn md-btn--outlined md-btn--lg">
                  <span className="md-icon" aria-hidden="true">
                    print
                  </span>
                  Print Verification
                </button>
              </div>
            </div>
          </article>
        ) : donorCertificate ? (
          <article className="md-card result-card cv-result" aria-labelledby="cv-donor-title">
            <ResultHeader id="cv-donor-title" heading="Certificate Verified!" banner="Authentic Donor Certificate" />
            <div className="cv-result__body">
              <SectionTitle icon="volunteer_activism">Donor Details</SectionTitle>
              <dl className="cv-creds">
                <Credential label="Certificate Number" emphasis="code">
                  {donorCertificate.certificate_number}
                </Credential>
                <Credential label="Donor Name" emphasis="strong">
                  {donorCertificate.user?.full_name || donorCertificate.user?.username}
                </Credential>
                <Credential label="Donation Details" wide emphasis="strong">
                  {donorCertificate.donation_type === 'material' ? (
                    <>
                      {donorCertificate.material_donation?.item_name} (Qty: {donorCertificate.material_donation?.quantity})
                    </>
                  ) : donorCertificate.donation_type === 'money' ? (
                    <>Contribution of ₹{donorCertificate.money_donation?.amount}</>
                  ) : null}
                </Credential>
                <Credential label="Type">{title(donorCertificate.donation_type)}</Credential>
                <Credential label="Issue Date">{dateFormat(donorCertificate.issue_date, 'F d, Y')}</Credential>
              </dl>

              <div className="verification-note no-print">
                <span className="md-icon" aria-hidden="true">
                  mail
                </span>
                <p>{emailNote}from the official mail id of your organization.</p>
              </div>

              <div className="cv-actions no-print">
                <button type="button" onClick={() => window.print()} className="md-btn md-btn--outlined md-btn--lg">
                  <span className="md-icon" aria-hidden="true">
                    print
                  </span>
                  Print Verification
                </button>
              </div>
            </div>
          </article>
        ) : null}

        <div className="dash-back-row no-print">
          <Link to="/" className="md-btn md-btn--text">
            <span className="md-icon" aria-hidden="true">
              arrow_back
            </span>
            Back to Home
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
