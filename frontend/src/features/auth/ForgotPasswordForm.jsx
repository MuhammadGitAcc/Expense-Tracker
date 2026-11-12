import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, MailCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useForgotPassword } from '@/features/auth/usePasswordReset';
import { toast } from '@/hooks/useToast';
import { emailSchema } from '@/utils/validators';

const schema = z.object({ email: emailSchema });

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = ({ email }) => {
    forgot.mutate(
      { email },
      {
        onSuccess: () => setSentTo(email),
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

  // The server gives the same answer for every email, so this text never says if an account exists.
  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
          <MailCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-sm text-content-muted">{t('auth.resetLinkSent', { email: sentTo })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {errors.root ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}
      <Input
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        startIcon={<Mail className="h-4 w-4" />}
        error={errors.email?.message}
        {...register('email')}
      />
      <Button type="submit" fullWidth loading={forgot.isPending}>
        {t('auth.sendResetLink')}
      </Button>
    </form>
  );
}
