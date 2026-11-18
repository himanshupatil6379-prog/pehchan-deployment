import { useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { useAdmin, useAdminRequest } from '../AdminContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ErrorList } from '../components/Nested.jsx';
import { BRAND_LOGO } from '../icons.js';
import { safeNext } from '../utils.js';

/** Brand block shown on the centred auth cards. */
export function AuthBrand() {
  const { theme, session } = useAdmin();
  const siteHeader = theme.title || session.site_header || 'Django administration';
  return (
    <div className="adm-auth__brand">
      <img src={BRAND_LOGO} alt="" width="48" height="48" />
      <div className="adm-auth__brand-text">
        <p className="adm-auth__brand-name">Pehchan</p>
        {theme.title_visible !== false ? <p className="adm-auth__brand-site">{siteHeader}</p> : null}
      </div>
    </div>
  );
}

/** admin/login.html */
export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const request = useAdminRequest();
  const { isStaff, user: adminUser, refreshAppList } = useAdmin();
  const auth = useAuth();
  const [errors, setErrors] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef(null);
  const params = new URLSearchParams(location.search);
  const next = params.get('next') || '';
  const target = safeNext(next, '/admin/');

  // AdminSite.login(): "Already logged-in, redirect to admin index"
  if (isStaff && !submitting) return <Navigate to="/admin/" replace />;

  const siteUser = adminUser || (auth && auth.user);
  const authenticatedNonStaff = !!(siteUser && !siteUser.is_staff);

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setSubmitting(true);
    const res = await request('/api/admin/login/', {
      method: 'POST',
      data: { username: form.elements.username.value, password: form.elements.password.value },
      followRedirect: false,
      handle401: false,
    });
    const d = res.data || {};
    if (res.ok && d.user) {
      setErrors(null);
      refreshAppList();
      navigate(target);
      return;
    }
    setSubmitting(false);
    setErrors(d.errors || { __all__: ['Please enter the correct username and password for a staff account. Note that both fields may be case-sensitive.'] });
    if (passwordRef.current) passwordRef.current.value = '';
  };

  const nonField = errors && errors.__all__ ? errors.__all__ : [];
  const fieldErrorCount = errors ? Object.keys(errors).filter((k) => k !== '__all__').length : 0;
  const errorCount = errors ? Object.keys(errors).length : 0;

  return (
    <AdminLayout title="Log in" variant="center" bodyClass="login" userTools={false} contentTitle={false} breadcrumbs={false}>
      <section className="md-card adm-auth" aria-labelledby="adm-login-title">
        <AuthBrand />
        <h1 className="adm-auth__title" id="adm-login-title">
          Log in
        </h1>
        <p className="adm-auth__lead">Sign in with your staff account to manage Pehchan.</p>

        {errors && !nonField.length && fieldErrorCount ? (
          <div className="md-alert md-alert--error" role="alert">
            <span className="md-icon" aria-hidden="true">
              error
            </span>
            <p className="errornote md-alert__body">{errorCount === 1 ? 'Please correct the error below.' : 'Please correct the errors below.'}</p>
          </div>
        ) : null}
        {nonField.map((err, i) => (
          <div className="md-alert md-alert--error" role="alert" key={i}>
            <span className="md-icon" aria-hidden="true">
              error
            </span>
            <p className="errornote md-alert__body">{err}</p>
          </div>
        ))}

        <div id="content-main">
          {authenticatedNonStaff ? (
            <div className="md-alert md-alert--warning adm-auth__notice">
              <span className="md-icon" aria-hidden="true">
                warning
              </span>
              <p className="errornote md-alert__body">
                You are authenticated as {siteUser.username}, but are not authorized to access this page. Would you like to login to a
                different account?
              </p>
            </div>
          ) : null}

          <form action={`${location.pathname}${location.search}`} method="post" id="login-form" className="adm-auth__form" onSubmit={onSubmit}>
            <div className={`form-row md-field${errors && errors.username ? ' md-field--error' : ''}`}>
              <label className="required md-field__label" htmlFor="id_username">
                Username
                <span className="md-required" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                type="text"
                name="username"
                className="md-input"
                autoFocus
                autoCapitalize="none"
                autoComplete="username"
                maxLength={150}
                required
                id="id_username"
                aria-invalid={errors && errors.username ? 'true' : undefined}
              />
              <ErrorList errors={errors && errors.username} />
            </div>
            <div className={`form-row md-field${errors && errors.password ? ' md-field--error' : ''}`}>
              <label className="required md-field__label" htmlFor="id_password">
                Password
                <span className="md-required" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                type="password"
                name="password"
                className="md-input"
                autoComplete="current-password"
                required
                id="id_password"
                ref={passwordRef}
                aria-invalid={errors && errors.password ? 'true' : undefined}
              />
              <ErrorList errors={errors && errors.password} />
              <input type="hidden" name="next" value={next} />
            </div>
            <div className="submit-row adm-auth__submit">
              <button type="submit" className="md-btn md-btn--filled md-btn--lg md-btn--block" value="Log in" aria-busy={submitting ? 'true' : undefined}>
                <span className="md-icon" aria-hidden="true">
                  login
                </span>
                Log in
              </button>
            </div>
          </form>
        </div>
      </section>
    </AdminLayout>
  );
}
