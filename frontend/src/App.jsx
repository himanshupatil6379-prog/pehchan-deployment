import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import ScrollManager from './components/ScrollManager.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Public pages
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Gallery from './pages/Gallery.jsx';
import PublicEventsList from './pages/PublicEventsList.jsx';
import PublicEventDetail from './pages/PublicEventDetail.jsx';
import Volunteer from './pages/Volunteer.jsx';
import Donate from './pages/Donate.jsx';
import CertificateVerify from './pages/CertificateVerify.jsx';
import SampleCertificatePreview from './pages/SampleCertificatePreview.jsx';

// Authentication
import Signup from './pages/Signup.jsx';
import Login from './pages/Login.jsx';
import Logout from './pages/Logout.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import VerifyOtp from './pages/VerifyOtp.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

// Logged-in area
import Dashboard from './pages/Dashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import EventList from './pages/EventList.jsx';
import EventDetail from './pages/EventDetail.jsx';
import LifetimeVolunteerForm from './pages/LifetimeVolunteerForm.jsx';
import CertificateList from './pages/CertificateList.jsx';
import CertificateDetail from './pages/CertificateDetail.jsx';
import DonorCertificateList from './pages/DonorCertificateList.jsx';
import DonorCertificateDetail from './pages/DonorCertificateDetail.jsx';
import MaterialDonationForm from './pages/MaterialDonationForm.jsx';
import MoneyDonationForm from './pages/MoneyDonationForm.jsx';

// Error pages
import Error404 from './pages/Error404.jsx';
import Error500 from './pages/Error500.jsx';

// Django-admin clone (separate chunk)
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

const auth = (el) => <RequireAuth>{el}</RequireAuth>;

/** Django's APPEND_SLASH: "/about" -> "/about/" */
function AppendSlash() {
  const location = useLocation();
  if (!location.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(location.pathname)) {
    return <Navigate to={`${location.pathname}/${location.search}${location.hash}`} replace />;
  }
  return <Error404 />;
}

/** Show the 500 page after an API server error, until the user navigates away. */
function useServerError() {
  const location = useLocation();
  const [errorKey, setErrorKey] = useState(null);
  useEffect(() => {
    const onError = () => setErrorKey(window.history.state?.key ?? 'current');
    window.addEventListener('pehchan:server-error', onError);
    return () => window.removeEventListener('pehchan:server-error', onError);
  }, []);
  useEffect(() => {
    setErrorKey((k) => (k && k !== location.key && k !== 'current' ? null : k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
  return errorKey !== null && !location.pathname.startsWith('/admin');
}

export default function App() {
  const { loading } = useAuth();
  const serverError = useServerError();
  if (loading) return null;
  if (serverError) return <Error500 />;

  return (
    <>
      <ScrollManager />
      <Routes>
        {/* Home and Public Pages */}
        <Route path="/" element={<Home />} />
        <Route path="/about/" element={<About />} />
        <Route path="/gallery/" element={<Gallery />} />
        <Route path="/events/" element={<PublicEventsList />} />
        <Route path="/events/:pk/" element={<PublicEventDetail />} />
        <Route path="/volunteer-info/" element={<Volunteer />} />
        <Route path="/donate-info/" element={<Donate />} />
        <Route path="/verify-certificate/" element={<CertificateVerify />} />
        <Route path="/sample-certificate/" element={<SampleCertificatePreview />} />

        {/* Authentication */}
        <Route path="/signup/" element={<Signup />} />
        <Route path="/login/" element={<Login />} />
        <Route path="/logout/" element={auth(<Logout />)} />

        {/* Forgot Password */}
        <Route path="/forgot-password/" element={<ForgotPassword />} />
        <Route path="/verify-otp/" element={<VerifyOtp />} />
        <Route path="/reset-password/" element={<ResetPassword />} />

        {/* Dashboard (Login Required) */}
        <Route path="/dashboard/" element={auth(<Dashboard />)} />
        <Route path="/admin-dashboard/" element={auth(<AdminDashboard />)} />
        {/* user_dashboard_ui renders a template that does not exist -> server error page */}
        <Route path="/user-dashboard/" element={auth(<Error500 />)} />

        {/* Events (Login Required) */}
        <Route path="/dashboard/events/" element={auth(<EventList />)} />
        <Route path="/dashboard/events/:pk/" element={auth(<EventDetail />)} />

        {/* Lifetime Volunteer (Login Required) */}
        <Route path="/volunteer/lifetime/" element={auth(<LifetimeVolunteerForm />)} />

        {/* Certificates */}
        <Route path="/certificates/" element={auth(<CertificateList />)} />
        <Route path="/certificates/:pk/" element={auth(<CertificateDetail />)} />
        <Route path="/dashboard/verify-certificate/" element={<CertificateVerify />} />
        <Route path="/certificates/donor/" element={auth(<DonorCertificateList />)} />
        <Route path="/certificates/donor/:pk/" element={auth(<DonorCertificateDetail />)} />

        {/* Donations (Login Required) */}
        <Route path="/donate/material/" element={auth(<MaterialDonationForm />)} />
        <Route path="/donate/money/" element={auth(<MoneyDonationForm />)} />

        {/* Django admin */}
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={null}>
              <AdminApp />
            </Suspense>
          }
        />

        <Route path="*" element={<AppendSlash />} />
      </Routes>
    </>
  );
}
