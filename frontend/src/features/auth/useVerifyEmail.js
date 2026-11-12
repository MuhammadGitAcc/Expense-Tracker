import { useMutation } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { resendVerification, verifyEmail } from '@/api/auth.api';
import { setCredentials } from '@/features/auth/authSlice';
import { applyUserPreferences } from '@/features/auth/applyUserPreferences';
import { useTheme } from '@/hooks/useTheme';

/** Verifying the code also logs the person in (the API answers with user + accessToken). */
export function useVerifyEmail() {
  const dispatch = useDispatch();
  const { setTheme } = useTheme();

  return useMutation({
    mutationFn: verifyEmail,
    onSuccess: (body) => {
      const { user, accessToken } = body.data;
      dispatch(setCredentials({ user, accessToken }));
      applyUserPreferences(user, setTheme);
    },
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: resendVerification });
}
