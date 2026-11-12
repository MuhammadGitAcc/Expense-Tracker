import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { PasswordChecklist } from '@/features/auth/PasswordChecklist';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { useResetPassword } from '@/features/auth/usePasswordReset';
import { toast } from '@/hooks/useToast';
import { PATHS } from '@/routes/paths';
import { matchPasswords, passwordSchema } from '@/utils/validators';

const schema = matchPasswords(
  z.object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'validation.required'),
  }),
);

export function ResetPasswordForm({ token }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reset = useResetPassword();

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = ({ password: next }) => {
    reset.mutate(
      { token, password: next },
      {
        onSuccess: () => {
          toast.success(t('auth.passwordUpdated'));
          navigate(PATHS.login, { replace: true });
        },
        onError: (error) => {
          if (isNetworkError(error)) {
            toast.error(t('errors.network'));
            return;
          }
          setError('root', { message: getErrorMessage(error, t('errors.generic')) });
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {errors.root ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}
      <div>
        <PasswordInput
          label={t('auth.newPassword')}
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordChecklist value={password} />
      </div>
      <PasswordInput
        label={t('auth.confirmPassword')}
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Button type="submit" fullWidth loading={reset.isPending}>
        {t('auth.resetPassword')}
      </Button>
    </form>
  );
}
