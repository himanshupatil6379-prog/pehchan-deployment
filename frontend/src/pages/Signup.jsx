import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { useApi } from '../hooks/useApi.js';
import pageCss from './css/signup.css?inline';

const EMPTY = { username: '', email: '', first_name: '', last_name: '', password1: '', password2: '' };

/**
 * `{{ form.<name>.as_hidden }}` – Django renders a HiddenInput carrying the bound value
 * (no value attribute when unbound/empty) and, for fields with help_text (Django >= 5.0),
 * aria-describedby="id_<name>_helptext".
 */
function HiddenField({ name, bound, helpText = false }) {
  const value = bound ? bound[name] : '';
  return (
    <input
      type="hidden"
      name={name}
      {...(value ? { value } : {})}
      aria-describedby={helpText ? `id_${name}_helptext` : undefined}
      id={`id_${name}`}
    />
  );
}

function FieldError({ errors, name }) {
  const list = errors[name];
  if (!list || !list.length) return null;
  return <span className="field-error">{list[0]}</span>;
}

/**
 * React port of templates/signup.html (pehchan.views.signup_view, SignUpForm).
 * Success -> user logged in, "Registration successful! Welcome to Pehchan." + redirect /dashboard/.
 * Failure -> "Please correct the errors below." + bound form re-rendered (passwords emptied).
 */
export default function Signup() {
  const request = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState(EMPTY);
  const [bound, setBound] = useState(null);
  const [errors, setErrors] = useState({});
  const submitting = useRef(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const submitted = { ...values };
    const res = await request('/auth/signup/', { method: 'POST', data: submitted });
    submitting.current = false;
    if (res.redirected) return;
    // Django re-renders signup.html with the bound form (a new page load).
    setBound(submitted);
    setErrors(res.data.errors || {});
    setValues((v) => ({ ...v, password1: '', password2: '' }));
    navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  };

  const nonFieldErrors = errors.__all__ || [];

  return (
    <BaseLayout title="Sign Up - Pehchan" extraCss={pageCss}>
      <div className="auth-page" key={location.key}>
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                  <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <h1 className="auth-title">Create Account</h1>
              <p className="auth-subtitle">Join us and start making a difference in the community</p>
            </div>

            <form method="post" className="auth-form" onSubmit={onSubmit}>
              {nonFieldErrors.length > 0 && (
                <div className="error-message">
                  <ul className="errorlist nonfield">
                    {nonFieldErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="form-group">
                <HiddenField name="username" bound={bound} helpText />
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    name="username"
                    className="form-input"
                    placeholder="Choose a username"
                    value={values.username}
                    onChange={onChange}
                    required
                  />
                  <svg className="input-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <FieldError errors={errors} name="username" />
              </div>

              <div className="form-group">
                <HiddenField name="email" bound={bound} />
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input
                    type="email"
                    name="email"
                    className="form-input"
                    placeholder="Enter your email"
                    value={values.email}
                    onChange={onChange}
                    required
                  />
                  <svg className="input-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                </div>
                <FieldError errors={errors} name="email" />
              </div>

              <div className="form-row">
                <div className="form-group half">
                  <HiddenField name="first_name" bound={bound} />
                  <div className="input-wrapper" style={{ position: 'relative' }}>
                    <input
                      type="text"
                      name="first_name"
                      className="form-input"
                      placeholder="First name"
                      value={values.first_name}
                      onChange={onChange}
                      required
                    />
                    <svg className="input-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                  </div>
                  <FieldError errors={errors} name="first_name" />
                </div>

                <div className="form-group half">
                  <HiddenField name="last_name" bound={bound} />
                  <div className="input-wrapper" style={{ position: 'relative' }}>
                    <input
                      type="text"
                      name="last_name"
                      className="form-input"
                      placeholder="Last name"
                      value={values.last_name}
                      onChange={onChange}
                      required
                    />
                    <svg className="input-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                  </div>
                  <FieldError errors={errors} name="last_name" />
                </div>
              </div>

              <div className="form-group">
                <HiddenField name="password1" bound={bound} helpText />
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input
                    type="password"
                    name="password1"
                    className="form-input"
                    placeholder="Create a password"
                    value={values.password1}
                    onChange={onChange}
                    required
                  />
                  <svg className="input-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                  </svg>
                </div>
                <FieldError errors={errors} name="password1" />
              </div>

              <div className="form-group">
                <HiddenField name="password2" bound={bound} helpText />
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input
                    type="password"
                    name="password2"
                    className="form-input"
                    placeholder="Confirm your password"
                    value={values.password2}
                    onChange={onChange}
                    required
                  />
                  <svg className="input-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z" />
                  </svg>
                </div>
                <FieldError errors={errors} name="password2" />
              </div>

              <div className="password-requirements">
                <strong>Password Requirements:</strong>
                <ul>
                  <li>At least 8 characters long</li>
                  <li>A mix of letters and numbers</li>
                  <li>Not too similar to your username</li>
                </ul>
              </div>

              <button type="submit" className="btn-signup">
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{ display: 'inline-block', marginRight: '8px' }}>
                    <path d="M12 2c.5 0 1 .19 1.41.59l2.66 2.66c.21.21.33.49.33.79V21c0 .55-.45 1-1 1H8c-.55 0-1-.45-1-1V6.04c0-.3.11-.58.33-.79L10.59 2.59C11 2.19 11.5 2 12 2m0 2.17L9.83 6.34V20h4.34V6.34L12 4.17z" />
                  </svg>
                  Create Account
                </span>
              </button>
            </form>

            <div className="auth-footer">
              <p>
                Already have an account? <Link to="/login/">Login here</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </BaseLayout>
  );
}
