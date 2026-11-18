import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import { PageHeader, useDialogFocus } from '../components/dashboard/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import { toFormData } from '../api.js';
import pageCss from './css/money-donation-form.css?inline';

/** `{% if form.x.errors %}<span …>{{ form.x.errors.0 }}</span>{% endif %}` */
function FieldError({ id, errors }) {
  if (!errors || !errors.length) return null;
  return (
    <span className="md-field__error" id={id}>
      <span className="md-icon" aria-hidden="true">
        error
      </span>
      {errors[0]}
    </span>
  );
}

/** React port of templates/money_donation_form.html (MoneyDonationCreateView). */
export default function MoneyDonationForm() {
  const request = useApi();
  const formRef = useRef(null);
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const [upiId, setUpiId] = useState('');
  const [values, setValues] = useState({ amount: '', contact_number: '' });
  const [receipt, setReceipt] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [errors, setErrors] = useState({});
  const [showPopup, setShowPopup] = useState(false);

  useDialogFocus(showPopup, dialogRef);

  // get_context_data(): upi_id = settings.DONATION_UPI_ID
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    request('/donations/money/', { signal: controller.signal })
      .then((res) => {
        if (!active || res.redirected) return;
        if (res.ok) setUpiId(res.data.upi_id || '');
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  const invalid = (name) => (errors[name] && errors[name].length ? 'true' : undefined);
  const fieldClass = (name) => `md-field${invalid(name) ? ' md-field--error' : ''}`;
  const describedBy = (name, helper) => [invalid(name) && `id_${name}_error`, helper].filter(Boolean).join(' ') || undefined;

  // "Submit Donation": validate, then show the success popup.
  const onSubmitClick = () => {
    const form = formRef.current;
    if (form.checkValidity()) {
      setShowPopup(true);
    } else {
      form.reportValidity();
    }
  };

  // "OK, I Understand!": document.querySelector('.form-shell').submit()
  const submitForm = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const formData = toFormData({ amount: values.amount, contact_number: values.contact_number, receipt_upload: receipt });
      const res = await request('/donations/money/', { method: 'POST', formData });
      if (res.redirected) return;
      if (!res.ok) {
        // form_invalid(): the page is rendered again with the bound form and its errors.
        // A file input is never re-populated by Django, so the chosen receipt is cleared.
        setErrors((res.data && res.data.errors) || {});
        setReceipt(null);
        setFileKey((k) => k + 1);
        setShowPopup(false);
        window.scrollTo(0, 0);
      }
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <DashboardLayout title="Money Donation - Pehchan" heading="Donate Money" css={pageCss}>
      {showPopup && (
        <div id="success-popup" className="md-dialog-backdrop">
          <div
            ref={dialogRef}
            className="md-dialog dash-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-popup-title"
            aria-describedby="success-popup-text"
            tabIndex={-1}
          >
            <span className="dash-dialog__badge" aria-hidden="true">
              <span className="md-icon">check_circle</span>
            </span>
            <h2 className="md-dialog__title" id="success-popup-title">
              🌟 Success! 🌟
            </h2>
            <div className="md-dialog__content" id="success-popup-text">
              <p>
                <strong>Thanks for your contribution! ❤️</strong>
              </p>
              <p>📧 You will receive a confirmation email once your donation is processed. ✨</p>
            </div>
            <div className="md-dialog__actions">
              <button type="button" className="md-btn md-btn--filled md-btn--lg md-btn--block" onClick={submitForm}>
                OK, I Understand!
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        eyebrow="Support Our Mission"
        eyebrowIcon="currency_rupee"
        title="Donate Money"
        subtitle="Thank you for your financial support! Your donation helps us make a difference in the community and empowers our programs."
      />

      <div className="pay-layout">
        {/* Payment Information */}
        <section className="md-card pay-card" aria-labelledby="pay-title">
          <div className="md-card__header">
            <span className="md-card__icon dash-icon--tertiary" aria-hidden="true">
              <span className="md-icon">account_balance</span>
            </span>
            <h2 className="md-card__title" id="pay-title">
              Payment Information
            </h2>
          </div>
          <div className="md-card__content pay-card__content">
            <dl className="pay-facts">
              <div className="pay-fact">
                <dt>
                  <span className="md-icon" aria-hidden="true">
                    payment
                  </span>
                  Payment Method
                </dt>
                <dd>UPI Transfer</dd>
              </div>
              <div className="pay-fact pay-fact--upi">
                <dt>
                  <span className="md-icon" aria-hidden="true">
                    qr_code
                  </span>
                  UPI ID
                </dt>
                <dd className="pay-upi">{upiId}</dd>
              </div>
            </dl>

            <figure className="pay-qr">
              <div className="pay-qr__frame">
                <img src="/static/images/pehchan_QRcode.jpeg" alt="Pehchan QR Code" loading="lazy" />
              </div>
              <figcaption>
                <strong className="pay-qr__title">Scan to Pay</strong>
                <span className="pay-qr__sub">
                  <span className="md-icon" aria-hidden="true">
                    lock
                  </span>
                  Secure UPI Transfer
                </span>
              </figcaption>
            </figure>

            <div className="dash-note dash-note--info">
              <span className="md-icon" aria-hidden="true">
                info
              </span>
              <div className="dash-note__body">
                <h3 className="dash-note__title">Steps to Complete Your Donation</h3>
                <ol>
                  <li>Transfer your donation amount to the UPI ID above using any UPI app</li>
                  <li>Take a screenshot of the successful payment confirmation</li>
                  <li>Upload the payment receipt screenshot in the form below</li>
                  <li>Fill in the donation amount and submit the form</li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="md-card pay-form-card" aria-labelledby="pay-form-title">
          <div className="md-card__header">
            <span className="md-card__icon" aria-hidden="true">
              <span className="md-icon">payments</span>
            </span>
            <h2 className="md-card__title" id="pay-form-title">
              Donation details
            </h2>
          </div>
          <div className="md-card__content pay-form-card__content">
            <form
              method="post"
              encType="multipart/form-data"
              className="form-shell dash-form"
              ref={formRef}
              onSubmit={(e) => e.preventDefault()}
            >
              <div className={fieldClass('amount')}>
                <label className="md-field__label" htmlFor="id_amount">
                  <span className="md-icon" aria-hidden="true">
                    currency_rupee
                  </span>
                  Donation Amount (₹)
                </label>
                <div className="pay-amount">
                  <span className="pay-amount__prefix" aria-hidden="true">
                    ₹
                  </span>
                  <input
                    type="number"
                    name="amount"
                    className="md-input"
                    placeholder="Amount in ₹"
                    min="1"
                    step="0.01"
                    required
                    aria-invalid={invalid('amount')}
                    aria-describedby={describedBy('amount')}
                    id="id_amount"
                    value={values.amount}
                    onChange={onChange}
                  />
                </div>
                <FieldError id="id_amount_error" errors={errors.amount} />
              </div>

              <div className={fieldClass('contact_number')}>
                <label className="md-field__label" htmlFor="id_contact_number">
                  <span className="md-icon" aria-hidden="true">
                    phone
                  </span>
                  Contact Number{' '}
                  <span className="md-required" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  type="text"
                  name="contact_number"
                  className="md-input"
                  placeholder="Contact Number (10 digits)"
                  pattern="[0-9]{10}"
                  title="Please enter exactly 10 digits"
                  maxLength="10"
                  minLength="10"
                  required
                  inputMode="numeric"
                  aria-invalid={invalid('contact_number')}
                  aria-describedby={describedBy('contact_number', 'id_contact_number_helptext')}
                  id="id_contact_number"
                  value={values.contact_number}
                  onChange={onChange}
                />
                <FieldError id="id_contact_number_error" errors={errors.contact_number} />
                <p className="md-field__helper" id="id_contact_number_helptext">
                  Enter your 10-digit mobile number for confirmation
                </p>
              </div>

              <div className={fieldClass('receipt_upload')}>
                <label className="md-field__label" htmlFor="id_receipt_upload">
                  <span className="md-icon" aria-hidden="true">
                    upload_file
                  </span>
                  Upload Payment Receipt (Required)
                </label>
                <input
                  key={fileKey}
                  type="file"
                  name="receipt_upload"
                  className="md-input pay-file"
                  accept="image/*,.pdf"
                  required
                  aria-invalid={invalid('receipt_upload')}
                  aria-describedby={describedBy('receipt_upload', 'id_receipt_upload_helptext')}
                  id="id_receipt_upload"
                  onChange={(e) => setReceipt(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                />
                <FieldError id="id_receipt_upload_error" errors={errors.receipt_upload} />
                <p className="md-field__helper" id="id_receipt_upload_helptext">
                  Upload a screenshot or photo of your payment receipt (Image or PDF, max 5MB)
                </p>
              </div>

              <div className="dash-note dash-note--success">
                <span className="md-icon" aria-hidden="true">
                  verified
                </span>
                <div className="dash-note__body">
                  <p>
                    All donations are subject to verification. You will receive a confirmation email once your donation is
                    processed. Thank you for your generous support!
                  </p>
                </div>
              </div>

              <div className="dash-form-actions">
                <button type="button" className="md-btn md-btn--filled md-btn--lg" onClick={onSubmitClick}>
                  <span className="md-icon" aria-hidden="true">
                    send
                  </span>
                  Submit Donation
                </button>
                <Link to="/dashboard/" className="md-btn md-btn--outlined md-btn--lg">
                  <span className="md-icon" aria-hidden="true">
                    close
                  </span>
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </section>
      </div>

      <div className="dash-back-row">
        <Link to="/dashboard/" className="md-btn md-btn--text">
          <span className="md-icon" aria-hidden="true">
            home
          </span>
          Back to Dashboard
        </Link>
      </div>
    </DashboardLayout>
  );
}
