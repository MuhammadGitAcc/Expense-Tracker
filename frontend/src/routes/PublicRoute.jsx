import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { selectIsAuthenticated, selectIsInitializing } from '@/features/auth/authSlice';
import { PATHS } from '@/routes/paths';

/**
 * Wraps login, register and the other pages for visitors. Someone who is already logged in
 * goes to the page they came from (or the dashboard). The loading screen while the start-up
 * check runs prevents a flash of the login form for a person who is logged in.
 */
export function PublicRoute() {
  const location = useLocation();
  const initializing = useSelector(selectIsInitializing);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (initializing) return <LoadingScreen />;

  if (isAuthenticated) {
    const from = location.state?.from;
    const target = from ? `${from.pathname}${from.search ?? ''}` : PATHS.dashboard;
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
