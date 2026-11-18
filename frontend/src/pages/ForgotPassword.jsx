import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDisplayedMessages } from '../context/MessagesContext.jsx';
import pageCss from './css/forgot-password.css?inline';

/**
 * React port of templates/forgot_password.html (pehchan.views.forgot_password, ForgotPasswordForm).
 * The template prints `messages` inside the form as well (in addition to base.html).
 *   success / unknown e-mail -> message + redirect /verify-otp/
 *   mail failure             -> error message + redirect /forgot-password/ (fresh, unbound form)
 *   60 s cooldown / invalid  -> bound form re-rendered (+ warning / field errors)
 */
export default function ForgotPassword() {
  const request = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const messages = useDisplayedMessages();
  const [email, setEmail] = useState('');
  const [bound, setBound] = useState(null);
  const [errors, setErrors] = useState({});
  const submitting = useRef(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const submitted = email;
    const res = await request('/auth/forgot-password/', { method: 'POST', data: { email: submitted } });
    submitting.current = false;
    if (res.redirected) {
      // A redirect (possibly back to this very page) always lands on an unbound form.
      setEmail('');
      setBound(null);
      setErrors({});
      return;
    }
    // Django re-renders forgot_password.html with the bound form (a new page load).
    setBound({ email: submitted });
    setErrors(res.data.errors || {});
    navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  };

  const nonFieldErrors = errors.__all__ || [];
  const hiddenEmail = bound ? bound.email : '';

  return (
    <BaseLayout title="Forgot Password - Pehchan" extraCss={pageCss}>
      <div className="auth-page" key={location.key}>
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-icon">
                <span className="material-icons-round">lock_reset</span>
              </div>
              <h1 className="auth-title">Forgot Password?</h1>
              <p className="auth-subtitle">Enter your email address and we'll send you an OTP to reset your password</p>
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
                <input type="hidden" name="email" {...(hiddenEmail ? { value: hiddenEmail } : {})} id="id_email" />
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <span className="material-icons-round">email</span>
                {errors.email && errors.email.length > 0 && <span className="field-error">{errors.email[0]}</span>}
              </div>

              <button type="submit" className="btn-reset">
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span className="material-icons-round">send</span>
                  Send OTP
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
    </BaseLayout>
  );
}
