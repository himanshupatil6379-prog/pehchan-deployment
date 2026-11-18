import { useState } from 'react';
import PageStyle from './PageStyle.jsx';
import { useApi } from '../hooks/useApi.js';
import contactCss from '../styles/contact-form.css?inline';

/**
 * React port of templates/includes/_contact_form.html.
 * `source` decides which view's messages/redirect are used:
 *   'home'      -> pehchan.views.home      (redirects to "/")
 *   'dashboard' -> pehchan.views.dashboard (redirects to "/dashboard/")
 */
export default function ContactForm({ source = 'home' }) {
  const request = useApi();
  const [values, setValues] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const res = await request('/contact/', { method: 'POST', data: { ...values, source } });
    setSubmitting(false);
    if (res.ok) {
      setValues({ name: '', email: '', message: '' });
      setErrors({});
    } else {
      setErrors(res.data.errors || {});
    }
  };

  return (
    <>
      <div className="contact-form-container">
        <form method="POST" onSubmit={onSubmit} noValidate={false}>
          <div className="form-group">
            <input type="text" name="name" placeholder="Your Name" required value={values.name} onChange={onChange} className="form-control" />
            {errors.name && <div className="error-text">{errors.name[0]}</div>}
          </div>

          <div className="form-group">
            <input type="email" name="email" placeholder="Your Email" required value={values.email} onChange={onChange} className="form-control" />
            {errors.email && <div className="error-text">{errors.email[0]}</div>}
          </div>

          <div className="form-group">
            <textarea name="message" placeholder="Your Message" rows="5" required className="form-control" value={values.message} onChange={onChange}></textarea>
            {errors.message && <div className="error-text">{errors.message[0]}</div>}
          </div>

          <button
            type="submit"
            className="btn-submit pill-button pill-button--primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            <span style={{ fontWeight: 700, letterSpacing: '0.5px' }}>Send Message</span>
          </button>
        </form>
      </div>
      <PageStyle css={contactCss} />
    </>
  );
}
