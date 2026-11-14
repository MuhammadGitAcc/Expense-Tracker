import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PasswordChecklist } from '@/features/auth/PasswordChecklist';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { DeleteAccountModal } from '@/features/settings/DeleteAccountModal';
import { useChangePassword } from '@/features/settings/useSettings';
import { toast } from '@/hooks/useToast';
import { loginPasswordSchema, matchPasswords, passwordSchema } from '@/utils/validators';

const schema = matchPasswords(
  z.object({
    currentPassword: loginPasswordSchema,
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'validation.required'),
  }),
  { password: 'newPassword' },
).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'settings.passwordSame',
  path: ['newPassword'],
});

function ChangePasswordCard() {
  const { t } = useTranslation();
  const change = useChangePassword();

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');

  // On success the hook logs this device out and shows the message, so there is nothing to do here.
  const onSubmit = ({ currentPassword, newPassword: next }) => {
    change.mutate(
      { currentPassword, newPassword: next },
      {
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
    <Card>
      <CardHeader title={t('settings.passwordTitle')} description={t('settings.passwordText')} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errors.root ? (
          <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
            {errors.root.message}
          </p>
        ) : null}
        <PasswordInput
          label={t('settings.currentPassword')}
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <div>
          <PasswordInput
            label={t('auth.newPassword')}
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <PasswordChecklist value={newPassword} />
        </div>
        <PasswordInput
          label={t('auth.confirmPassword')}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" loading={change.isPending}>
          {t('settings.changePassword')}
        </Button>
      </form>
    </Card>
  );
}

export function SecurityTab() {
  const { t } = useTranslation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="max-w-2xl space-y-6">
      <ChangePasswordCard />

      <Card className="border-danger/40">
        <CardHeader title={t('settings.dangerTitle')} description={t('settings.dangerText')} />
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          {t('settings.deleteAccount')}
        </Button>
      </Card>

      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}
