import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordChecklist } from '@/features/auth/PasswordChecklist';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { useRegister } from '@/features/auth/useRegister';
import { toast } from '@/hooks/useToast';
import { PATHS } from '@/routes/paths';
import { emailSchema, matchPasswords, nameSchema, passwordSchema } from '@/utils/validators';

const schema = matchPasswords(
  z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'validation.required'),
  }),
);

export function RegisterForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const registerUser = useRegister();

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = ({ name, email, password: pass }) => {
    registerUser.mutate(
      { name, email, password: pass },
      {
        onSuccess: (body) => {
          toast.success(t('auth.codeSent'));
          navigate(PATHS.verifyEmail, { state: { email: body.data?.email ?? email } });
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

      <Input
        label={t('auth.name')}
        autoComplete="name"
        startIcon={<User className="h-4 w-4" />}
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        startIcon={<Mail className="h-4 w-4" />}
        error={errors.email?.message}
        {...register('email')}
      />
      <div>
        <PasswordInput
          label={t('auth.password')}
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

      <Button type="submit" fullWidth loading={registerUser.isPending}>
        {t('auth.createAccount')}
      </Button>
    </form>
  );
}
