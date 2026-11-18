import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BaseLayout from '../components/BaseLayout.jsx';
import { useApi } from '../hooks/useApi.js';
import pageCss from './css/login.css?inline';

/**
 * React port of templates/login.html (pehchan.views.login_view, LoginForm = AuthenticationForm).
 * Success -> "Welcome back, <username>!" + redirect /dashboard/ (handled by useApi).
 * Failure -> the bound form is re-rendered: username kept, password emptied,
 *            `{{ form.non_field_errors }}` shown in .error-message.
 */
export default function Login() {
  const request = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const submitting = useRef(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const res = await request('/auth/login/', { method: 'POST', data: { username, password } });
    submitting.current = false;
    if (res.redirected) return;
    // Django re-renders login.html with the bound form (a new page load):
    // new location key -> scroll to top, old messages dropped, card animation replayed.
    setErrors(res.data.errors || {});
    setPassword('');
    navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  };

  const nonFieldErrors = errors.__all__ || [];

  return (
    <BaseLayout title="Login - Pehchan" extraCss={pageCss}>
      <div className="auth-page" key={location.key}>
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                  <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
                </svg>
              </div>
              <h1 className="auth-title georgia-brand">Welcome Back!</h1>
              <p className="auth-subtitle">Login to access your dashboard and continue making a difference</p>
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
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    name="username"
                    className="form-input"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <svg className="input-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                {errors.username && errors.username.length > 0 && <span className="field-error">{errors.username[0]}</span>}
              </div>

              <div className="form-group">
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input
                    type="password"
                    name="password"
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <svg className="input-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                  </svg>
                </div>
                {errors.password && errors.password.length > 0 && <span className="field-error">{errors.password[0]}</span>}
              </div>

              <button type="submit" className="btn-login">
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{ display: 'inline-block', marginRight: '8px' }}>
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                  </svg>
                  Login to Dashboard
                </span>
              </button>
            </form>

            <div className="auth-footer">
              <p>
                Don't have an account? <Link to="/signup/">Sign up here</Link>
              </p>
              <p style={{ marginTop: '16px' }}>
                <Link to="/forgot-password/">Forgot Password?</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </BaseLayout>
  );
}
