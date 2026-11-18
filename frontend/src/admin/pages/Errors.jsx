import { Link, Navigate, useLocation } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { useAdmin } from '../AdminContext.jsx';
import { loginUrl } from '../utils.js';

/** Centred status card used by the error pages. */
function StateCard({ icon, tone = 'neutral', title, children }) {
  return (
    <div className="adm-state">
      <section className="md-card adm-state__card" aria-labelledby="adm-state-title">
        <span className={`adm-state__icon adm-state__icon--${tone}`} aria-hidden="true">
          <span className="md-icon">{icon}</span>
        </span>
        {title}
        {children}
        <Link to="/admin/" className="md-btn md-btn--tonal adm-state__home">
          <span className="md-icon" aria-hidden="true">
            home
          </span>
          Home
        </Link>
      </section>
    </div>
  );
}

/** admin/404.html */
export function NotFoundPage() {
  return (
    <AdminLayout docTitle="Page not found" breadcrumbs={[]} userTools={false}>
      <StateCard
        icon="search_off"
        title={
          <h1 className="adm-state__title" id="adm-state-title">
            Page not found
          </h1>
        }
      >
        <p>We’re sorry, but the requested page could not be found.</p>
      </StateCard>
    </AdminLayout>
  );
}

/** PermissionDenied inside the admin. */
export function ForbiddenPage() {
  return (
    <AdminLayout docTitle="403 Forbidden" breadcrumbs={[]} userTools={false}>
      <StateCard
        icon="lock"
        tone="warning"
        title={
          <h1 className="adm-state__title" id="adm-state-title">
            403 Forbidden
          </h1>
        }
      >
        <p>You do not have permission to access this page.</p>
      </StateCard>
    </AdminLayout>
  );
}

/** Server error (non-JSON / 5xx) while loading an admin page. */
export function ServerErrorPage() {
  return (
    <AdminLayout docTitle="Server error (500)" breadcrumbs={[]} userTools={false}>
      <StateCard
        icon="error"
        tone="error"
        title={
          <h1 className="adm-state__title" id="adm-state-title">
            Server Error <em>(500)</em>
          </h1>
        }
      >
        <p>There’s been an error. It’s been reported to the site administrators via email and should be fixed shortly. Thanks for your patience.</p>
      </StateCard>
    </AdminLayout>
  );
}

/** Return an error page for a failed useAdminPage() load, or null. */
export function errorPageFor(page) {
  if (page.loading && !page.data) return null;
  if (page.status === 404) return <NotFoundPage />;
  if (page.status === 403) return <ForbiddenPage />;
  if (page.status >= 500 || page.status === 0) return page.data && page.data.ok !== false ? null : <ServerErrorPage />;
  return null;
}

/** AdminSite.catch_all_view: login for anonymous users, "Page not found" for staff. */
export function CatchAllPage() {
  const { isStaff } = useAdmin();
  const location = useLocation();
  if (!isStaff) return <Navigate to={loginUrl(location)} replace />;
  return <NotFoundPage />;
}
