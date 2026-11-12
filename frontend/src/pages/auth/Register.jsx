import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { PATHS } from '@/routes/paths';

export default function Register() {
  const { t } = useTranslation();

  return (
    <>
      <h1 className="text-xl font-semibold text-content">{t('auth.registerTitle')}</h1>
      <p className="mb-6 mt-1 text-sm text-content-muted">{t('auth.registerSubtitle')}</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-content-muted">
        {t('auth.haveAccount')}{' '}
        <Link to={PATHS.login} className="font-medium text-primary-text hover:underline">
          {t('auth.login')}
        </Link>
      </p>
    </>
  );
}
