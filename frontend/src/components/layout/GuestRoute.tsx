import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '../../hooks/useAuthStore';

type LocationState = { from?: string } | null;

// The opposite of ProtectedRoute, for /login and /register: a logged-in user
// is sent into the app. That's also what happens right after a successful
// login, the moment the token is saved.
export function GuestRoute() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (token) {
    const from = (location.state as LocationState)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
}
