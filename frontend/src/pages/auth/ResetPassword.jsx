import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { buttonStyles } from '@/components/ui/Button';
import { ResetPasswordForm } from '@/features/auth/ResetPasswordForm';
import { PATHS } from '@/routes/paths';

/** Opened from the emailed link: /reset-password?token=... */
export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token');

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-semibold text-content">{t('auth.invalidLinkTitle')}</h1>
        <p className="mb-6 mt-1 text-sm text-content-muted">{t('auth.invalidLinkText')}</p>
        <Link to={PATHS.forgotPassword} className={buttonStyles({ fullWidth: true })}>
          {t('auth.requestNewLink')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-content">{t('auth.resetTitle')}</h1>
      <p className="mb-6 mt-1 text-sm text-content-muted">{t('auth.resetSubtitle')}</p>
      <ResetPasswordForm token={token} />
    </>
  );
}
