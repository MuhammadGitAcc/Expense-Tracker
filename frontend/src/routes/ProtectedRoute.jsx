import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { selectIsAuthenticated, selectIsInitializing } from '@/features/auth/authSlice';
import { PATHS } from '@/routes/paths';

/**
 * Wraps the private pages. While the start-up check runs it shows the loading screen,
 * without a login it sends the visitor to /login and remembers the page they wanted
 * (location.state.from), so login can bring them back.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const initializing = useSelector(selectIsInitializing);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (initializing) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to={PATHS.login} replace state={{ from: location }} />;

  return <Outlet />;
}
