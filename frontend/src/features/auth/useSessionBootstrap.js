import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { refreshSession } from '@/api/axiosClient';
import { sessionChecked } from '@/features/auth/authSlice';

/**
 * Runs once when the app starts: "is there still a valid refresh cookie?".
 * Yes: refreshSession() stores the user and a new access token (the person stays logged in
 * after a page reload). No, or no network: the check ends with no user and the visitor sees login.
 * React StrictMode runs effects twice in development; both calls share one request.
 */
export function useSessionBootstrap() {
  const dispatch = useDispatch();

  useEffect(() => {
    refreshSession().catch(() => {
      dispatch(sessionChecked());
    });
  }, [dispatch]);
}
