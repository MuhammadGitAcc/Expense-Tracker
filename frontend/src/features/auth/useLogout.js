import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '@/api/auth.api';
import { clearCredentials } from '@/features/auth/authSlice';
import { closeMobileMenu } from '@/features/ui/uiSlice';

/** Logs out on the server (clears the cookie), then always clears the local session. */
export function useLogout() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      await logout();
    } catch {
      // Even if the server cannot be reached, this device must forget the session.
    }
    dispatch(closeMobileMenu());
    dispatch(clearCredentials());
    queryClient.clear();
  }, [dispatch, queryClient]);
}
