import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectIsInitializing, selectUser } from '@/features/auth/authSlice';

/** Who is logged in: { user, isAuthenticated, isInitializing }. */
export function useAuth() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isInitializing = useSelector(selectIsInitializing);
  return { user, isAuthenticated, isInitializing };
}
