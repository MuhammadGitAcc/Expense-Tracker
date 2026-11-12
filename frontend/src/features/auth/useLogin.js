import { useMutation } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { login } from '@/api/auth.api';
import { setCredentials } from '@/features/auth/authSlice';
import { applyUserPreferences } from '@/features/auth/applyUserPreferences';
import { useTheme } from '@/hooks/useTheme';

/** Login. On success the user and token go to Redux and the profile language/theme are applied. */
export function useLogin() {
  const dispatch = useDispatch();
  const { setTheme } = useTheme();

  return useMutation({
    mutationFn: login,
    onSuccess: (body) => {
      const { user, accessToken } = body.data;
      dispatch(setCredentials({ user, accessToken }));
      applyUserPreferences(user, setTheme);
    },
  });
}
