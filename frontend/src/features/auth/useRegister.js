import { useMutation } from '@tanstack/react-query';
import { register } from '@/api/auth.api';

/** Register: the account exists but must be verified with the emailed code before login. */
export function useRegister() {
  return useMutation({ mutationFn: register });
}
