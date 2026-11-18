import { useLayoutEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import md3Css from '../styles/md3.css?inline';
import adminCss from './md3-admin.css?inline';
import { AdminProvider, useAdmin } from './AdminContext.jsx';
import { storedThemeMode } from './AdminLayout.jsx';
import LoginPage from './pages/Login.jsx';
import LoggedOutPage from './pages/LoggedOut.jsx';
import { PasswordChangePage, PasswordChangeDonePage } from './pages/PasswordChange.jsx';
import { IndexPage, AppIndexPage } from './pages/Index.jsx';
import ChangeListPage from './pages/ChangeList.jsx';
import ChangeFormPage from './pages/ChangeForm.jsx';
import DeleteConfirmationPage from './pages/DeleteConfirmation.jsx';
import HistoryPage from './pages/History.jsx';
import UserPasswordPage from './pages/UserPassword.jsx';
import IssueCertificatePage from './pages/IssueCertificate.jsx';
import { CatchAllPage } from './pages/Errors.jsx';

/**
 * Pehchan admin (Django admin port), mounted by App.jsx at "/admin/*".
 * The Material Design 3 stylesheets (shared md3.css + admin layer) are inline
 * <style> tags, so they only exist while an admin page is mounted.
 */
export default function AdminApp() {
  return (
    <AdminProvider>
      <AdminRoot />
    </AdminProvider>
  );
}

function AdminRoot() {
  const location = useLocation();
  const { sessionLoaded } = useAdmin();

  // <html data-theme="…"> drives the md3 dark tokens; set before paint, removed on unmount.
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = storedThemeMode();
    const prevLang = html.getAttribute('lang');
    html.setAttribute('lang', 'en-us');
    html.setAttribute('dir', 'ltr');
    document.body.classList.add('md3-body');
    return () => {
      delete html.dataset.theme;
      if (prevLang) html.setAttribute('lang', prevLang);
      else html.removeAttribute('lang');
      html.removeAttribute('dir');
      document.body.classList.remove('md3-body');
    };
  }, []);

  // Django APPEND_SLASH
  if (!location.pathname.endsWith('/')) {
    return <Navigate to={`${location.pathname}/${location.search}${location.hash}`} replace />;
  }

  return (
    <>
      <PageStyle links={[FONTS.materialIconsRound, FONTS.interJakarta]} css={[md3Css, adminCss]} />
      {sessionLoaded ? (
        <AdminRoutes />
      ) : (
        <div className="adm-boot" role="status" aria-live="polite">
          <span className="md-spinner" aria-hidden="true"></span>
          <span className="md-visually-hidden">Loading…</span>
        </div>
      )}
    </>
  );
}

function ObjectRedirect() {
  const { app, model, id } = useParams();
  return <Navigate to={`/admin/${app}/${model}/${id}/change/`} replace />;
}

function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<IndexPage />} />
      <Route path="login/" element={<LoginPage />} />
      <Route path="logout/" element={<LoggedOutPage />} />
      <Route path="password_change/" element={<PasswordChangePage />} />
      <Route path="password_change/done/" element={<PasswordChangeDonePage />} />
      <Route path="auth/user/:id/password/" element={<UserPasswordPage />} />
      <Route path="pehchan/eventvolunteer/issue-certificate/:id/" element={<IssueCertificatePage kind="volunteer" />} />
      <Route path="pehchan/materialdonation/issue-certificate/:id/" element={<IssueCertificatePage kind="material" />} />
      <Route path="pehchan/moneydonation/issue-certificate/:id/" element={<IssueCertificatePage kind="money" />} />
      <Route path=":app/" element={<AppIndexPage />} />
      <Route path=":app/:model/" element={<ChangeListPage />} />
      <Route path=":app/:model/add/" element={<ChangeFormPage add />} />
      <Route path=":app/:model/:id/change/" element={<ChangeFormPage />} />
      <Route path=":app/:model/:id/delete/" element={<DeleteConfirmationPage />} />
      <Route path=":app/:model/:id/history/" element={<HistoryPage />} />
      <Route path=":app/:model/:id/" element={<ObjectRedirect />} />
      <Route path="*" element={<CatchAllPage />} />
    </Routes>
  );
}
