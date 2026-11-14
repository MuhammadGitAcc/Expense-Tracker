import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { useDeleteAccount } from '@/features/settings/useSettings';
import { toast } from '@/hooks/useToast';
import { loginPasswordSchema } from '@/utils/validators';

const DELETE_FORM_ID = 'delete-account-form';
const schema = z.object({ password: loginPasswordSchema });

/**
 * Asks for the password, then deletes the account. On success useDeleteAccount logs this device
 * out, so the page (and this modal) disappear on their own.
 */
export function DeleteAccountModal({ open, onClose }) {
  const { t } = useTranslation();
  const remove = useDeleteAccount();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { password: '' } });

  const handleClose = () => {
    if (remove.isPending) return;
    reset();
    remove.reset();
    onClose();
  };

  const onSubmit = ({ password }) => {
    remove.mutate(
      { password },
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
    <Modal
      open={open}
      onClose={handleClose}
      title={t('settings.deleteTitle')}
      description={t('settings.deleteText')}
      size="sm"
      footer={
        <>
          <Button variant="outline" disabled={remove.isPending} onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" type="submit" form={DELETE_FORM_ID} loading={remove.isPending}>
            {t('settings.deleteConfirm')}
          </Button>
        </>
      }
    >
      <form id={DELETE_FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errors.root ? (
          <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
            {errors.root.message}
          </p>
        ) : null}
        <PasswordInput
          label={t('auth.password')}
          autoComplete="current-password"
          data-autofocus
          error={errors.password?.message}
          {...register('password')}
        />
      </form>
    </Modal>
  );
}
