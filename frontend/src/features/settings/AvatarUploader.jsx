import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assetUrl, getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { FileUpload } from '@/components/ui/FileUpload';
import { useUploadAvatar } from '@/features/settings/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/useToast';
import { ACCEPTED_IMAGE_TYPES } from '@/utils/constants';

/** The profile photo: shows the current one, uploads a new one after "Upload photo". */
export function AvatarUploader() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const upload = useUploadAvatar();
  const [file, setFile] = useState(null);
  const [serverError, setServerError] = useState(null);

  const handleChange = (next) => {
    setServerError(null);
    setFile(next);
  };

  const handleUpload = () => {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: () => {
        setFile(null);
        toast.success(t('settings.avatarUpdated'));
      },
      onError: (error) => {
        if (isNetworkError(error)) toast.error(t('errors.network'));
        else setServerError(getErrorMessage(error, t('errors.generic')));
      },
    });
  };

  return (
    <Card>
      <CardHeader title={t('settings.avatarTitle')} description={t('settings.avatarText')} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar src={assetUrl(user?.avatarUrl)} name={user?.name} size="xl" />
        <div className="w-full min-w-0 flex-1 space-y-3">
          <FileUpload
            label={t('settings.avatarChoose')}
            accept={ACCEPTED_IMAGE_TYPES}
            value={file}
            onChange={handleChange}
            error={serverError}
            disabled={upload.isPending}
          />
          <Button disabled={!file} loading={upload.isPending} onClick={handleUpload}>
            {t('settings.avatarUpload')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
