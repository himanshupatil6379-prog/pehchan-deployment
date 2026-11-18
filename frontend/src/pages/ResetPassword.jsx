import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDisplayedMessages } from '../context/MessagesContext.jsx';
import pageCss from './css/reset-password.css?inline';

/**
 * React port of templates/reset_password.html (pehchan.views.reset_password, ResetPasswordForm).
 * GET guard: without a verified OTP the view redirects to /forgot-password/ with
 * "Please verify your OTP first.", so the content is only shown once the guard passed.
 * The template prints `messages` inside the form as well (in addition to base.html).
 */
export default function ResetPassword() {
  const request = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const messages = useDisplayedMessages();
  const [ready, setReady] = useState(false);
  const [values, setValues] = useState({ new_password: '', confirm_password: '' });
  const [bound, setBound] = useState(null);
  const [errors, setErrors] = useState({});
  const submitting = useRef(false);
  const guarded = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Session guard of the view (runs once; a 302 replaces the history entry like the browser does).
  useEffect(() => {
    if (guarded.current) return;
    guarded.current = true;
    request('/auth/reset-password/', { followRedirect: false }).then((res) => {
      if (!mounted.current) return;
      if (res.data && res.data.redirect) navigate(res.data.redirect, { replace: true });
      else setReady(true);
    });
  }, [request, navigate]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const submitted = { ...values };
    const res = await request('/auth/reset-password/', { method: 'POST', data: submitted });
    submitting.current = false;
    if (res.redirected) return;
    // Django re-renders reset_password.html with the bound form (a new page load);
    // the visible password inputs have no value attribute, so they come back empty.
    setBound(submitted);
    setErrors(res.data.errors || {});
    setValues({ new_password: '', confirm_password: '' });
    navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  };

  const nonFieldErrors = errors.__all__ || [];
  const hiddenNew = bound ? bound.new_password : '';
  const hiddenConfirm = bound ? bound.confirm_password : '';

  return (
    <BaseLayout title="Reset Password - Pehchan" extraCss={pageCss}>
      {ready && (
        <div className="auth-page" key={location.key}>
          <div className="auth-container">
            <div className="auth-card">
              <div className="auth-header">
                <div className="auth-icon">
                  <span className="material-icons-round">lock</span>
                </div>
                <h1 className="auth-title">Reset Password</h1>
                <p className="auth-subtitle">Enter your new password below</p>
              </div>

              <form method="post" className="auth-form" onSubmit={onSubmit}>
                {messages.length > 0 &&
                  messages.map((message) => (
                    <div key={message.id} className={`alert alert-${message.level}`}>
                      {message.text}
                    </div>
                  ))}

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
                  <input
                    type="hidden"
                    name="new_password"
                    {...(hiddenNew ? { value: hiddenNew } : {})}
                    id="id_new_password"
                  />
                  <input
                    type="password"
                    name="new_password"
                    className="form-input"
                    placeholder="Enter new password"
                    value={values.new_password}
                    onChange={onChange}
                    required
                  />
                  <span className="material-icons-round">lock</span>
                  {errors.new_password && errors.new_password.length > 0 && (
                    <span className="field-error">{errors.new_password[0]}</span>
                  )}
                </div>

                <div className="form-group">
                  <input
                    type="hidden"
                    name="confirm_password"
                    {...(hiddenConfirm ? { value: hiddenConfirm } : {})}
                    id="id_confirm_password"
                  />
                  <input
                    type="password"
                    name="confirm_password"
                    className="form-input"
                    placeholder="Confirm new password"
                    value={values.confirm_password}
                    onChange={onChange}
                    required
                  />
                  <span className="material-icons-round">lock</span>
                  {errors.confirm_password && errors.confirm_password.length > 0 && (
                    <span className="field-error">{errors.confirm_password[0]}</span>
                  )}
                </div>

                <div className="password-requirements">
                  <h4>Password Requirements:</h4>
                  <ul>
                    <li>At least 8 characters long</li>
                    <li>Not too similar to your personal information</li>
                    <li>Not a commonly used password</li>
                    <li>Not entirely numeric</li>
                  </ul>
                </div>

                <button type="submit" className="btn-reset">
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span className="material-icons-round">check_circle</span>
                    Reset Password
                  </span>
                </button>
              </form>

              <div className="auth-footer">
                <p>
                  Remember your password? <Link to="/login/">Login here</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseLayout>
  );
}
