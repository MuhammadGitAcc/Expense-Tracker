import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { VerifyEmailForm } from '@/features/auth/VerifyEmailForm';
import { PATHS } from '@/routes/paths';

/** The email arrives in location.state (from register or from a login that was refused). */
export default function VerifyEmail() {
  const { t } = useTranslation();
  const email = useLocation().state?.email;

  // Opened directly (a bookmark, a reload that lost the state): there is no email to verify.
  if (!email) return <Navigate to={PATHS.login} replace />;

  return (
    <>
      <h1 className="text-xl font-semibold text-content">{t('auth.verifyTitle')}</h1>
      <p className="mb-6 mt-1 text-sm text-content-muted">{t('auth.verifySubtitle', { email })}</p>
      <VerifyEmailForm email={email} />
      <p className="mt-6 text-center text-sm">
        <Link to={PATHS.login} className="font-medium text-primary-text hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </>
  );
}
