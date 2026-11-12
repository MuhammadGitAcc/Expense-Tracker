import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LoginForm } from '@/features/auth/LoginForm';
import { PATHS } from '@/routes/paths';

export default function Login() {
  const { t } = useTranslation();

  return (
    <>
      <h1 className="text-xl font-semibold text-content">{t('auth.loginTitle')}</h1>
      <p className="mb-6 mt-1 text-sm text-content-muted">{t('auth.loginSubtitle')}</p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-content-muted">
        {t('auth.noAccount')}{' '}
        <Link to={PATHS.register} className="font-medium text-primary-text hover:underline">
          {t('auth.register')}
        </Link>
      </p>
    </>
  );
}
