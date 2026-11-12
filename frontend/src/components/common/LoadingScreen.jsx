import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { APP_NAME } from '@/utils/constants';
import { Spinner } from '@/components/ui/Spinner';

/**
 * The fallback while a lazy page loads (Suspense) and while the session is restored at start-up.
 * fullScreen (default): covers the whole window. fullScreen={false}: fills the page content area.
 */
export function LoadingScreen({ fullScreen = true, label, className }) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 bg-canvas',
        fullScreen ? 'min-h-dvh' : 'min-h-[50vh]',
        className,
      )}
    >
      <Spinner size="lg" label={label ?? t('common.loading')} className="text-primary-text" />
      {fullScreen ? (
        <p className="text-sm font-medium text-content-muted" aria-hidden="true">
          {APP_NAME}
        </p>
      ) : null}
    </div>
  );
}
