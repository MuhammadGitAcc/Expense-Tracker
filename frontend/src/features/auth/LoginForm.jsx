import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { z } from 'zod';
import { getErrorCode, getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { dismissSessionExpired, selectSessionExpired } from '@/features/auth/authSlice';
import { useLogin } from '@/features/auth/useLogin';
import { toast } from '@/hooks/useToast';
import { PATHS } from '@/routes/paths';
import { emailSchema, loginPasswordSchema } from '@/utils/validators';

const schema = z.object({ email: emailSchema, password: loginPasswordSchema });

export function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const sessionExpired = useSelector(selectSessionExpired);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: location.state?.email ?? '', password: '' },
  });

  // A running session was refused by the server: say why, once.
  useEffect(() => {
    if (!sessionExpired) return;
    toast.info(t('auth.sessionExpired'));
    dispatch(dismissSessionExpired());
  }, [sessionExpired, dispatch, t]);

  const onSubmit = (values) => {
    login.mutate(values, {
      // PublicRoute sends a logged-in person on to the page they wanted (location.state.from).
      onError: (error) => {
        if (getErrorCode(error) === 'EMAIL_NOT_VERIFIED') {
          navigate(PATHS.verifyEmail, { state: { email: getValues('email') } });
          return;
        }
        if (isNetworkError(error)) {
          toast.error(t('errors.network'));
          return;
        }
        setError('root', { message: getErrorMessage(error, t('errors.generic')) });
      },
    });
  };

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
      <PasswordInput
        label={t('auth.password')}
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      <div className="text-end">
        <Link
          to={PATHS.forgotPassword}
          className="text-sm font-medium text-primary-text hover:underline"
        >
          {t('auth.forgotPassword')}
        </Link>
      </div>

      <Button type="submit" fullWidth loading={login.isPending}>
        {t('auth.login')}
      </Button>
    </form>
  );
}
