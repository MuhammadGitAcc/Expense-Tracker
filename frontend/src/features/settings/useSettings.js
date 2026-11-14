import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { changePassword, deleteAccount, updateMe, uploadAvatar } from '@/api/users.api';
import { invalidateMoneyData } from '@/app/invalidate';
import { clearCredentials, updateUser } from '@/features/auth/authSlice';
import { toast } from '@/hooks/useToast';

/**
 * Saves profile fields (name, currency, language, theme). mutate({ ...changedFields }).
 * The new user goes to Redux. A currency change refreshes every screen that shows money,
 * because the dashboard, the reports and the budgets use the profile currency.
 */
export function useUpdateProfile() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMe,
    onSuccess: (body, variables) => {
      dispatch(updateUser(body.data.user));
      if (variables.currency) invalidateMoneyData(queryClient);
    },
  });
}

/** mutate(file). The new avatarUrl comes back inside the user. */
export function useUploadAvatar() {
  const dispatch = useDispatch();

  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (body) => dispatch(updateUser(body.data.user)),
  });
}

// The server has already ended every session of this user (and cleared the cookie), so this
// device forgets the session too. ProtectedRoute then sends the person to the login page.
// The toast is shown here and not in mutate(): the page is gone by the time mutate's callbacks
// would run.
function useSignOutLocally(messageKey) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return () => {
    toast.info(t(messageKey));
    dispatch(clearCredentials());
    queryClient.clear();
  };
}

/** mutate({ currentPassword, newPassword }). Success logs this device out. */
export function useChangePassword() {
  const signOut = useSignOutLocally('settings.passwordChanged');
  return useMutation({ mutationFn: changePassword, onSuccess: signOut });
}

/** mutate({ password }). Success logs this device out: the account no longer exists. */
export function useDeleteAccount() {
  const signOut = useSignOutLocally('settings.accountDeleted');
  return useMutation({ mutationFn: deleteAccount, onSuccess: signOut });
}
