import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AvatarUploader } from '@/features/settings/AvatarUploader';
import { useUpdateProfile } from '@/features/settings/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/useToast';
import { nameSchema } from '@/utils/validators';

const schema = z.object({ name: nameSchema });

export function ProfileTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const update = useUpdateProfile();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { name: user?.name ?? '' } });

  const onSubmit = ({ name }) => {
    // Nothing really changed (for example only a space was added): send nothing.
    if (name === user?.name) {
      reset({ name });
      return;
    }
    update.mutate(
      { name },
      {
        onSuccess: (body) => {
          reset({ name: body.data.user.name });
          toast.success(t('settings.profileSaved'));
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
    <div className="max-w-2xl space-y-6">
      <AvatarUploader />

      <Card>
        <CardHeader title={t('settings.detailsTitle')} />
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {errors.root ? (
            <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
              {errors.root.message}
            </p>
          ) : null}
          <Input
            label={t('auth.name')}
            autoComplete="name"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label={t('auth.email')}
            type="email"
            value={user?.email ?? ''}
            readOnly
            disabled
            hint={t('settings.emailHint')}
          />
          <Button type="submit" loading={update.isPending} disabled={!isDirty}>
            {t('common.save')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
