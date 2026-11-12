import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { store } from '@/app/store';
import { refreshSession } from '@/api/axiosClient';
import { applyUserPreferences } from '@/features/auth/applyUserPreferences';
import { sessionChecked } from '@/features/auth/authSlice';
import { useTheme } from '@/hooks/useTheme';

/**
 * Runs once when the app starts: "is there still a valid refresh cookie?".
 * Yes: refreshSession() stores the user and a new access token (the person stays logged in
 * after a page reload) and the language/theme of the profile are applied.
 * No, or no network: the check ends with no user and the visitor sees login.
 * React StrictMode runs effects twice in development; both calls share one request.
 */
export function useSessionBootstrap() {
  const dispatch = useDispatch();
  const { setTheme } = useTheme();

  useEffect(() => {
    refreshSession()
      .then(() => applyUserPreferences(store.getState().auth.user, setTheme))
      .catch(() => {
        dispatch(sessionChecked());
      });
  }, [dispatch, setTheme]);
}
