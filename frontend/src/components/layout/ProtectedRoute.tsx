import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '../../hooks/useAuthStore';

// Wraps every page that needs a logged-in user. No token -> /login, and we
// remember where the user was going so login can send them back there.
// This is only UX: the real protection is the backend rejecting requests
// without a valid JWT.
export function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
