import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, buttonStyles } from '@/components/ui/Button';
import { PATHS } from '@/routes/paths';

export default function ServerErrorPage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <p className="text-6xl font-bold text-danger" aria-hidden="true">
        500
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-content">{t('errors.serverTitle')}</h1>
      <p className="mt-2 max-w-sm text-sm text-content-muted">{t('errors.serverText')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>{t('errors.reload')}</Button>
        <Link to={PATHS.root} className={buttonStyles({ variant: 'outline' })}>
          {t('errors.goHome')}
        </Link>
      </div>
    </main>
  );
}
