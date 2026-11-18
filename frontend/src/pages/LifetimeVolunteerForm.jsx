import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import { PageHeader, useDialogFocus } from '../components/dashboard/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import contentCss from './css/lifetime-volunteer-form.css?inline';

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

/** React port of templates/lifetime_volunteer_form.html (LifetimeVolunteerCreateView). */
export default function LifetimeVolunteerForm() {
  const request = useApi();
  const formRef = useRef(null);
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState({ contact_number: '', motivation: '' });
  const [errors, setErrors] = useState({});
  const [showPopup, setShowPopup] = useState(false);

  useDialogFocus(showPopup, dialogRef);

  const onChange = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  // Equivalent of document.querySelector('.lifetime-form').submit() – no validation, no submit event.
  const submitForm = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    let res;
    try {
      res = await request('/volunteer/lifetime/', { method: 'POST', data: values });
    } finally {
      submittingRef.current = false;
    }
    if (res.redirected) return;
    // form_invalid: the page is rendered again with the bound form (popup hidden, top of the page).
    setShowPopup(false);
    setErrors((res.data && res.data.errors) || {});
    window.scrollTo(0, 0);
  };

  // "Submit Application" (type=button): show the popup only when the form is valid.
  const onSubmitClick = () => {
    const form = formRef.current;
    if (form.checkValidity()) {
      setShowPopup(true);
    } else {
      form.reportValidity();
    }
  };

  // Implicit submission (Enter in the contact number field) submits the form directly.
  const onSubmit = (e) => {
    e.preventDefault();
    submitForm();
  };

  const describedBy = (...ids) => ids.filter(Boolean).join(' ') || undefined;

  return (
    <DashboardLayout title="Become Lifetime Volunteer - Pehchan" heading="Lifetime Volunteer" css={contentCss}>
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
            <span className="dash-dialog__badge dash-dialog__badge--tertiary" aria-hidden="true">
              <span className="md-icon">stars</span>
            </span>
            <h2 className="md-dialog__title" id="success-popup-title">
              🌟 Thank You! 🌟
            </h2>
            <div className="md-dialog__content" id="success-popup-text">
              <p>
                <strong>Your application has been received! ❤️</strong>
              </p>
              <p>
                🙏 We appreciate your lifelong commitment to Pehchan. Our team will review your application and get back to
                you soon. ✨
              </p>
            </div>
            <div className="md-dialog__actions">
              <button type="button" className="md-btn md-btn--filled md-btn--lg md-btn--block" onClick={() => submitForm()}>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dash-form-page">
        <PageHeader
          eyebrow="Join Our Core Team"
          eyebrowIcon="emoji_events"
          title="Become a Lifetime Volunteer"
          subtitle="Thank you for your interest in becoming a lifetime volunteer with Pehchan! Make a lasting commitment to creating positive change in our community."
        />

        <section className="md-card lv-card" aria-labelledby="lv-form-title">
          <div className="md-card__header">
            <span className="md-card__icon dash-icon--tertiary" aria-hidden="true">
              <span className="md-icon">stars</span>
            </span>
            <h2 className="md-card__title" id="lv-form-title">
              Your application
            </h2>
          </div>
          <div className="md-card__content lv-card__content">
            <div className="dash-note dash-note--tertiary">
              <span className="md-icon" aria-hidden="true">
                info
              </span>
              <div className="dash-note__body">
                <h3 className="dash-note__title">Application Process</h3>
                <p>
                  Your application will be reviewed by our team. You will receive an email notification once a decision
                  has been made. Approved lifetime volunteers gain special privileges and recognition within our
                  organization.
                </p>
              </div>
            </div>

            <form method="post" className="lifetime-form dash-form" ref={formRef} onSubmit={onSubmit}>
              <div className={`md-field${errors.contact_number ? ' md-field--error' : ''}`}>
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
                  maxLength={10}
                  minLength={10}
                  required
                  inputMode="numeric"
                  aria-invalid={errors.contact_number ? 'true' : undefined}
                  aria-describedby={describedBy(errors.contact_number && 'id_contact_number_error', 'id_contact_number_helptext')}
                  id="id_contact_number"
                  value={values.contact_number}
                  onChange={onChange}
                />
                <FieldError id="id_contact_number_error" errors={errors.contact_number} />
                <p className="md-field__helper" id="id_contact_number_helptext">
                  Enter your 10-digit mobile number
                </p>
              </div>

              <div className={`md-field${errors.motivation ? ' md-field--error' : ''}`}>
                <label className="md-field__label" htmlFor="id_motivation">
                  <span className="md-icon" aria-hidden="true">
                    question_answer
                  </span>
                  Why do you want to become a lifetime volunteer?
                </label>
                <textarea
                  name="motivation"
                  cols="40"
                  rows="5"
                  className="md-textarea"
                  placeholder="Tell us why you want to become a lifetime volunteer..."
                  required
                  aria-invalid={errors.motivation ? 'true' : undefined}
                  aria-describedby={describedBy(errors.motivation && 'id_motivation_error', 'id_motivation_helptext')}
                  id="id_motivation"
                  value={values.motivation}
                  onChange={onChange}
                />
                <FieldError id="id_motivation_error" errors={errors.motivation} />
                <p className="md-field__helper" id="id_motivation_helptext">
                  Please share your motivation for wanting to become a lifetime volunteer. This helps us understand your
                  commitment to our cause.
                </p>
              </div>

              <div className="dash-form-actions">
                <button type="button" className="md-btn md-btn--filled md-btn--lg" onClick={onSubmitClick}>
                  <span className="md-icon" aria-hidden="true">
                    send
                  </span>
                  Submit Application
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
    </DashboardLayout>
  );
}
