import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonStyles } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { PATHS } from '@/routes/paths';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <p className="text-6xl font-bold text-primary-text" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-content">{t('errors.notFoundTitle')}</h1>
      <p className="mt-2 max-w-sm text-sm text-content-muted">{t('errors.notFoundText')}</p>
      <Link
        to={isAuthenticated ? PATHS.dashboard : PATHS.login}
        className={buttonStyles({ className: 'mt-6' })}
      >
        {isAuthenticated ? t('errors.goDashboard') : t('errors.goLogin')}
      </Link>
    </main>
  );
}
