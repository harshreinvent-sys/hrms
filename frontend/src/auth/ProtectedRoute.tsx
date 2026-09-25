import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Spinner } from '../components/Spinner';
import { WakingNotice } from '../components/WakingNotice';
import { useServerWaking } from '../components/useServerWaking';
import type { Role } from '../types/api';

/**
 * Gate for a route subtree. With `roles`, users outside the list are sent to
 * the dashboard rather than shown a page they cannot use. The API enforces
 * the same rule independently; this only keeps the UI honest.
 */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();
  const location = useLocation();
  const { waking } = useServerWaking();

  if (user === undefined) {
    // Re-validating a stored session — which, after the server has slept, is
    // the request that wakes it. Say so rather than spin in silence.
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <Spinner label="Checking your session" />
        <div className="w-full max-w-md"><WakingNotice waking={waking} /></div>
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
