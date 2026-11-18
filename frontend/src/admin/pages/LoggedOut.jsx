import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { useAdmin, useAdminRequest } from '../AdminContext.jsx';
import { AuthBrand } from './Login.jsx';

/**
 * registration/logged_out.html. The header's "Log out" button POSTs
 * /api/admin/logout/ and then navigates here; opening the URL directly
 * performs the logout first.
 */
export default function LoggedOutPage() {
  const location = useLocation();
  const { user, setAdminUser } = useAdmin();
  const request = useAdminRequest();
  const alreadyDone = !!(location.state && location.state.loggedOut);
  const [done, setDone] = useState(alreadyDone || !user);

  useEffect(() => {
    if (done) return undefined;
    let active = true;
    request('/api/admin/logout/', { method: 'POST', followRedirect: false, handle401: false, pushMessages: false }).then(() => {
      setAdminUser(null);
      if (active) setDone(true);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminLayout title="Logged out" variant="center" breadcrumbs={[]} contentTitle={false} pending={!done}>
      <section className="md-card adm-auth adm-auth--state" aria-labelledby="adm-logged-out-title">
        <AuthBrand />
        <span className="adm-state__icon adm-state__icon--success" aria-hidden="true">
          <span className="md-icon">logout</span>
        </span>
        <h1 className="adm-auth__title" id="adm-logged-out-title">
          Logged out
        </h1>
        <p className="adm-auth__lead">Thanks for spending some quality time with the web site today.</p>
        <Link to="/admin/" className="md-btn md-btn--filled md-btn--lg md-btn--block">
          <span className="md-icon" aria-hidden="true">
            login
          </span>
          Log in again
        </Link>
      </section>
    </AdminLayout>
  );
}
