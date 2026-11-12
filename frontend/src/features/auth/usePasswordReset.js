import { useMutation } from '@tanstack/react-query';
import { forgotPassword, resetPassword } from '@/api/auth.api';

export const useForgotPassword = () => useMutation({ mutationFn: forgotPassword });
export const useResetPassword = () => useMutation({ mutationFn: resetPassword });
