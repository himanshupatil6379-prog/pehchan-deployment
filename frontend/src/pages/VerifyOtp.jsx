import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDisplayedMessages } from '../context/MessagesContext.jsx';
import pageCss from './css/verify-otp.css?inline';

/**
 * React port of templates/verify_otp.html (pehchan.views.verify_otp, OTPVerificationForm).
 * GET guard: without a started reset flow (or after 5 failed attempts) the view redirects to
 * /forgot-password/ with an error message, so the content is only shown once the guard passed.
 * The template prints `messages` inside the form as well (in addition to base.html).
 */
export default function VerifyOtp() {
  const request = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const messages = useDisplayedMessages();
  const [ready, setReady] = useState(false);
  const [otp, setOtp] = useState('');
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
    request('/auth/verify-otp/', { followRedirect: false }).then((res) => {
      if (!mounted.current) return;
      if (res.data && res.data.redirect) navigate(res.data.redirect, { replace: true });
      else setReady(true);
    });
  }, [request, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const submitted = otp;
    const res = await request('/auth/verify-otp/', { method: 'POST', data: { otp: submitted } });
    submitting.current = false;
    if (res.redirected) return;
    // Django re-renders verify_otp.html with the bound form (a new page load).
    setBound({ otp: submitted });
    setErrors(res.data.errors || {});
    navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  };

  const nonFieldErrors = errors.__all__ || [];
  const hiddenOtp = bound ? bound.otp : '';

  return (
    <BaseLayout title="Verify OTP - Pehchan" extraCss={pageCss}>
      {ready && (
        <div className="auth-page" key={location.key}>
          <div className="auth-container">
            <div className="auth-card">
              <div className="auth-header">
                <div className="auth-icon">
                  <span className="material-icons-round">vpn_key</span>
                </div>
                <h1 className="auth-title">Verify OTP</h1>
                <p className="auth-subtitle">Enter the 6-digit OTP sent to your email address</p>
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
                  <input type="hidden" name="otp" {...(hiddenOtp ? { value: hiddenOtp } : {})} id="id_otp" />
                  <input
                    type="text"
                    name="otp"
                    className="form-input"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength="6"
                    required
                  />
                  <span className="material-icons-round">lock</span>
                  {errors.otp && errors.otp.length > 0 && <span className="field-error">{errors.otp[0]}</span>}
                </div>

                <button type="submit" className="btn-verify">
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span className="material-icons-round">check_circle</span>
                    Verify OTP
                  </span>
                </button>
              </form>

              <div className="resend-link">
                <p>
                  Didn't receive the OTP? <Link to="/forgot-password/">Resend OTP</Link>
                </p>
              </div>

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
