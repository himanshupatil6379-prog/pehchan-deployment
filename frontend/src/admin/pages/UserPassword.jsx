import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { useAdmin, useAdminPage, useAdminRequest } from '../AdminContext.jsx';
import { ErrorNote, PasswordHelp, PasswordRow } from './PasswordChange.jsx';
import { errorPageFor } from './Errors.jsx';
import { apiPathFor, appVerboseName, capfirst, findModel, truncatewords } from '../utils.js';

/** admin/auth/user/change_password.html */
export default function UserPasswordPage() {
  const { id } = useParams();
  const location = useLocation();
  const page = useAdminPage();
  const request = useAdminRequest();
  const { appList, theme } = useAdmin();
  const [errors, setErrors] = useState(null);

  const err = errorPageFor(page);
  if (err) return err;
  const data = page.data || {};
  const title = data.title || '';
  const username =
    data.username ||
    (data.user && data.user.username) ||
    (typeof data.original === 'string' ? data.original : data.original && data.original.username) ||
    data.object_repr ||
    title.replace(/^Change password:\s*/, '');
  const entry = findModel(appList, 'auth', 'user');
  const plural = (data.model && data.model.verbose_name_plural) || (entry ? entry.name : 'users');
  const errorCount = errors ? Object.keys(errors).length : 0;
  const pw1Help = data.password1_help_text || data.help_texts;
  const pw2Help = data.password2_help_text || 'Enter the same password as before, for verification.';

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const res = await request(apiPathFor(location), {
      method: 'POST',
      data: { password1: form.elements.password1.value, password2: form.elements.password2.value },
    });
    if (res.redirected || res.handled || res.ok) return;
    const d = res.data || {};
    setErrors(d.errors && Object.keys(d.errors).length ? d.errors : { __all__: ['Please correct the errors below.'] });
    form.elements.password1.value = '';
    form.elements.password2.value = '';
    window.scrollTo(0, 0);
  };

  const fullTitle = title || `Change password: ${username}`;
  return (
    <AdminLayout
      title={fullTitle}
      overline={capfirst(plural)}
      docTitle={errorCount ? `Error: ${fullTitle} | ${theme.title || 'Django administration'}` : undefined}
      bodyClass="auth-user change-form"
      breadcrumbs={[
        [appVerboseName(appList, 'auth'), '/admin/auth/'],
        [capfirst(plural), '/admin/auth/user/'],
        [truncatewords(username, 18), `/admin/auth/user/${id}/change/`],
        ['Change password'],
      ]}
      pending={!page.data}
    >
      <div id="content-main" className="adm-narrow">
        <form method="post" id="user_form" className="adm-form" onSubmit={onSubmit}>
          <input type="text" name="username" value={username} className="hidden" readOnly autoComplete="username" />
          <ErrorNote errors={errors} />
          <fieldset className="md-card adm-fieldset module aligned" aria-labelledby="adm-user-password-heading">
            <div className="adm-fieldset__header">
              <span className="md-card__icon" aria-hidden="true">
                <span className="md-icon">key</span>
              </span>
              <div>
                <h2 className="adm-fieldset__title" id="adm-user-password-heading">
                  {username}
                </h2>
                <p className="md-card__subtitle">
                  Enter a new password for the user <strong>{username}</strong>.
                </p>
              </div>
            </div>
            <div className="adm-fieldset__body adm-stack">
              <PasswordRow
                name="password1"
                label="Password"
                autoComplete="new-password"
                autoFocus
                errors={errors}
                helpId="id_password1_helptext"
                help={typeof pw1Help === 'string' ? <span dangerouslySetInnerHTML={{ __html: pw1Help }} /> : <PasswordHelp items={pw1Help} />}
              />
              <PasswordRow
                name="password2"
                label="Password (again)"
                autoComplete="new-password"
                errors={errors}
                helpId="id_password2_helptext"
                help={pw2Help}
              />
            </div>
            <div className="submit-row adm-card-actions">
              <button type="submit" value="Change password" className="default md-btn md-btn--filled">
                <span className="md-icon" aria-hidden="true">
                  check
                </span>
                Change password
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </AdminLayout>
  );
}
