import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { useAdmin, useAdminPage, useAdminRequest } from '../AdminContext.jsx';
import { ErrorList } from '../components/Nested.jsx';
import { errorPageFor } from './Errors.jsx';
import { loginUrl } from '../utils.js';

const DEFAULT_HELP = [
  'Your password can’t be too similar to your other personal information.',
  'Your password must contain at least 8 characters.',
  'Your password can’t be a commonly used password.',
  'Your password can’t be entirely numeric.',
];

/** password_validators_help_text_html() */
export function PasswordHelp({ items }) {
  const list = items && items.length ? items : DEFAULT_HELP;
  return (
    <ul className="adm-help-list">
      {list.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

/** "Please correct the error(s) below." alert (+ non-field errors). */
export function ErrorNote({ errors }) {
  const n = errors ? Object.keys(errors).length : 0;
  if (!n) return null;
  return (
    <div className="md-alert md-alert--error adm-errornote" role="alert">
      <span className="md-icon" aria-hidden="true">
        error
      </span>
      <div className="md-alert__body">
        <p className="errornote">{n === 1 ? 'Please correct the error below.' : 'Please correct the errors below.'}</p>
        {errors.__all__ ? <ErrorList errors={errors.__all__} className="errorlist nonfield" /> : null}
      </div>
    </div>
  );
}

/** One password input row (label, input, errors, help) in M3 field style. */
export function PasswordRow({ name, label, autoComplete, autoFocus, errors, help, helpId }) {
  const id = `id_${name}`;
  const errs = errors && errors[name];
  return (
    <div className={`form-row adm-field${errs && errs.length ? ' errors adm-field--error' : ''}`}>
      <label className="required md-field__label adm-field__label" htmlFor={id}>
        {label}
        <span className="md-required" aria-hidden="true">
          *
        </span>
      </label>
      <input
        type="password"
        name={name}
        className="md-input"
        autoComplete={autoComplete}
        autoFocus={autoFocus || undefined}
        required
        aria-describedby={help ? helpId : undefined}
        aria-invalid={errs && errs.length ? 'true' : undefined}
        id={id}
      />
      <ErrorList errors={errs} id={`${id}_error`} />
      {help ? (
        <div className="help md-field__helper adm-field__help" id={helpId}>
          {help}
        </div>
      ) : null}
    </div>
  );
}

/** registration/password_change_form.html */
export function PasswordChangePage() {
  const page = useAdminPage();
  const request = useAdminRequest();
  const [errors, setErrors] = useState(null);

  const err = errorPageFor(page);
  if (err) return err;
  const data = page.data || {};
  const helpTexts = data.help_texts;

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const res = await request('/api/admin/password_change/', {
      method: 'POST',
      data: {
        old_password: form.elements.old_password.value,
        new_password1: form.elements.new_password1.value,
        new_password2: form.elements.new_password2.value,
      },
    });
    if (res.redirected || res.handled) return;
    if (res.ok) return;
    const d = res.data || {};
    setErrors(d.errors || { __all__: ['Please correct the errors below.'] });
    // PasswordInput(render_value=False): Django re-renders the fields empty
    ['old_password', 'new_password1', 'new_password2'].forEach((n) => {
      if (form.elements[n]) form.elements[n].value = '';
    });
  };

  return (
    <AdminLayout title="Password change" userTools="password" breadcrumbs={[['Password change']]} pending={!page.data}>
      <div id="content-main" className="adm-narrow">
        <form method="post" onSubmit={onSubmit} className="adm-form">
          <ErrorNote errors={errors} />
          <fieldset className="md-card adm-fieldset module aligned wide" aria-labelledby="adm-password-heading">
            <div className="adm-fieldset__header">
              <span className="md-card__icon" aria-hidden="true">
                <span className="md-icon">lock_reset</span>
              </span>
              <div>
                <h2 className="adm-fieldset__title" id="adm-password-heading">
                  Change your password
                </h2>
                <p className="md-card__subtitle">
                  Please enter your old password, for security’s sake, and then enter your new password twice so we can verify you typed
                  it in correctly.
                </p>
              </div>
            </div>
            <div className="adm-fieldset__body adm-stack">
              <PasswordRow name="old_password" label="Old password" autoComplete="current-password" autoFocus errors={errors} />
              <PasswordRow
                name="new_password1"
                label="New password"
                autoComplete="new-password"
                errors={errors}
                helpId="id_new_password1_helptext"
                help={<PasswordHelp items={helpTexts} />}
              />
              <PasswordRow
                name="new_password2"
                label="New password confirmation"
                autoComplete="new-password"
                errors={errors}
                helpId="id_new_password2_helptext"
                help="Enter the same password as before, for verification."
              />
            </div>
            <div className="submit-row adm-card-actions">
              <button type="submit" value="Change my password" className="default md-btn md-btn--filled">
                <span className="md-icon" aria-hidden="true">
                  check
                </span>
                Change my password
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </AdminLayout>
  );
}

/** registration/password_change_done.html */
export function PasswordChangeDonePage() {
  const { isStaff } = useAdmin();
  const location = useLocation();
  if (!isStaff) return <Navigate to={loginUrl(location)} replace />;
  return (
    <AdminLayout title="Password change successful" contentTitle={false} userTools="password" breadcrumbs={[['Password change']]}>
      <div className="adm-state">
        <section className="md-card adm-state__card" aria-labelledby="adm-state-title">
          <span className="adm-state__icon adm-state__icon--success" aria-hidden="true">
            <span className="md-icon">verified_user</span>
          </span>
          <h1 className="adm-state__title" id="adm-state-title">
            Password change successful
          </h1>
          <p>Your password was changed.</p>
          <Link to="/admin/" className="md-btn md-btn--tonal adm-state__home">
            <span className="md-icon" aria-hidden="true">
              home
            </span>
            Home
          </Link>
        </section>
      </div>
    </AdminLayout>
  );
}
