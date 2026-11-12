import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ForgotPasswordForm } from '@/features/auth/ForgotPasswordForm';
import { PATHS } from '@/routes/paths';

export default function ForgotPassword() {
  const { t } = useTranslation();

  return (
    <>
      <h1 className="text-xl font-semibold text-content">{t('auth.forgotTitle')}</h1>
      <p className="mb-6 mt-1 text-sm text-content-muted">{t('auth.forgotSubtitle')}</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link to={PATHS.login} className="font-medium text-primary-text hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </>
  );
}
