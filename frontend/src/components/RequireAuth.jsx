import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Equivalent of @login_required / LoginRequiredMixin:
 * anonymous users are redirected to /login/?next=<current path>.
 */
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const next = location.pathname + location.search;
    return <Navigate to={`/login/?next=${next}`} replace />;
  }
  return children;
}
