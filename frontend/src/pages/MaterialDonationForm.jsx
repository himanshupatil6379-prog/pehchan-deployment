import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import { PageHeader, useDialogFocus } from '../components/dashboard/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import pageCss from './css/material-donation-form.css?inline';

const INITIAL = { item_name: '', quantity: '', location: '', contact_number: '', message: '' };

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

/** React port of templates/material_donation_form.html (MaterialDonationCreateView). */
export default function MaterialDonationForm() {
  const request = useApi();
  const formRef = useRef(null);
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [showPopup, setShowPopup] = useState(false);

  useDialogFocus(showPopup, dialogRef);

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
      const res = await request('/donations/material/', { method: 'POST', data: values });
      if (res.redirected) return;
      if (!res.ok) {
        // form_invalid(): the page is rendered again with the bound form and its errors.
        setErrors((res.data && res.data.errors) || {});
        setShowPopup(false);
        window.scrollTo(0, 0);
      }
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <DashboardLayout title="Material Donation - Pehchan" heading="Donate Items" css={pageCss}>
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

      <div className="dash-form-page">
        <PageHeader
          eyebrow="Share Your Resources"
          eyebrowIcon="volunteer_activism"
          title="Donate Material"
          subtitle="Thank you for your generosity! Your material donations help us serve the community better. Please fill out the form below with your donation details."
        />

        <section className="md-card mdon-card" aria-labelledby="mdon-form-title">
          <div className="md-card__header">
            <span className="md-card__icon" aria-hidden="true">
              <span className="md-icon">inventory_2</span>
            </span>
            <h2 className="md-card__title" id="mdon-form-title">
              Donation details
            </h2>
          </div>
          <div className="md-card__content mdon-card__content">
            <form method="post" className="form-shell dash-form" ref={formRef} onSubmit={(e) => e.preventDefault()}>
              <div className="dash-form__row">
                <div className={fieldClass('item_name')}>
                  <label className="md-field__label" htmlFor="id_item_name">
                    <span className="md-icon" aria-hidden="true">
                      category
                    </span>
                    Item Name
                  </label>
                  <input
                    type="text"
                    name="item_name"
                    className="md-input"
                    placeholder="Item Name"
                    maxLength="200"
                    required
                    aria-invalid={invalid('item_name')}
                    aria-describedby={describedBy('item_name')}
                    id="id_item_name"
                    value={values.item_name}
                    onChange={onChange}
                  />
                  <FieldError id="id_item_name_error" errors={errors.item_name} />
                </div>

                <div className={fieldClass('quantity')}>
                  <label className="md-field__label" htmlFor="id_quantity">
                    <span className="md-icon" aria-hidden="true">
                      numbers
                    </span>
                    Quantity
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    className="md-input"
                    placeholder="Quantity"
                    min="1"
                    required
                    aria-invalid={invalid('quantity')}
                    aria-describedby={describedBy('quantity')}
                    id="id_quantity"
                    value={values.quantity}
                    onChange={onChange}
                  />
                  <FieldError id="id_quantity_error" errors={errors.quantity} />
                </div>
              </div>

              <div className="dash-form__row">
                <div className={fieldClass('location')}>
                  <label className="md-field__label" htmlFor="id_location">
                    <span className="md-icon" aria-hidden="true">
                      location_on
                    </span>
                    Your Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    className="md-input"
                    placeholder="Your Location"
                    maxLength="200"
                    required
                    aria-invalid={invalid('location')}
                    aria-describedby={describedBy('location')}
                    id="id_location"
                    value={values.location}
                    onChange={onChange}
                  />
                  <FieldError id="id_location_error" errors={errors.location} />
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
                    Enter your 10-digit mobile number for pickup coordination
                  </p>
                </div>
              </div>

              <div className="dash-note dash-note--primary">
                <span className="md-icon" aria-hidden="true">
                  local_shipping
                </span>
                <div className="dash-note__body">
                  <h3 className="dash-note__title">Pickup Information</h3>
                  <ul>
                    <li>
                      If you're in <strong>Mumbai</strong>, the Pehchan team will pick up your material at your convenience.
                    </li>
                    <li>
                      If you're <strong>outside Mumbai</strong>, please courier your material to our office address (we'll
                      provide details after submission).
                    </li>
                  </ul>
                </div>
              </div>

              <div className={fieldClass('message')}>
                <label className="md-field__label" htmlFor="id_message">
                  <span className="md-icon" aria-hidden="true">
                    message
                  </span>
                  Additional Message <span className="dash-optional">(Optional)</span>
                </label>
                <textarea
                  name="message"
                  cols="40"
                  rows="3"
                  className="md-textarea"
                  placeholder="Additional message (optional)"
                  aria-invalid={invalid('message')}
                  aria-describedby={describedBy('message', 'id_message_helptext')}
                  id="id_message"
                  value={values.message}
                  onChange={onChange}
                ></textarea>
                <FieldError id="id_message_error" errors={errors.message} />
                <p className="md-field__helper" id="id_message_helptext">
                  Any special notes or instructions about the donation.
                </p>
              </div>

              <div className="dash-note dash-note--success">
                <span className="md-icon" aria-hidden="true">
                  verified
                </span>
                <div className="dash-note__body">
                  <p>
                    After submission, our team will contact you within 24-48 hours to coordinate the pickup or provide
                    shipping instructions. Thank you for your support!
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

        <div className="dash-back-row">
          <Link to="/dashboard/" className="md-btn md-btn--text">
            <span className="md-icon" aria-hidden="true">
              home
            </span>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
