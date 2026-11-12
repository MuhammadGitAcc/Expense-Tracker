import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useResendVerification, useVerifyEmail } from '@/features/auth/useVerifyEmail';
import { toast } from '@/hooks/useToast';
import { verificationCodeSchema } from '@/utils/validators';

const RESEND_COOLDOWN_SECONDS = 60;
const schema = z.object({ code: verificationCodeSchema });

/** The 6-digit code + a resend button with a short cooldown. A good code logs the person in. */
export function VerifyEmailForm({ email }) {
  const { t } = useTranslation();
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { code: '' } });

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = ({ code }) => {
    verify.mutate(
      { email, code },
      {
        // On success the user is in Redux and PublicRoute moves them to the dashboard.
        onSuccess: () => toast.success(t('auth.verified')),
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

  const onResend = () => {
    resend.mutate(
      { email },
      {
        onSuccess: () => {
          toast.success(t('auth.codeSent'));
          setCooldown(RESEND_COOLDOWN_SECONDS);
        },
        onError: (error) => toast.error(getErrorMessage(error, t('errors.generic'))),
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

      <Input
        label={t('auth.code')}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        dir="ltr"
        inputClassName="text-center text-xl tracking-[0.5em]"
        error={errors.code?.message}
        {...register('code')}
      />

      <Button type="submit" fullWidth loading={verify.isPending}>
        {t('auth.verify')}
      </Button>

      <Button
        variant="ghost"
        fullWidth
        onClick={onResend}
        loading={resend.isPending}
        disabled={cooldown > 0}
      >
        {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resend')}
      </Button>
    </form>
  );
}
