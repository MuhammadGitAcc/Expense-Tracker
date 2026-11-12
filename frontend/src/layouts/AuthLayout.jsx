import { Suspense } from 'react';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { APP_NAME } from '@/utils/constants';

/** Centered card for login, register, verify, forgot and reset. */
export default function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <div className="flex items-center justify-end gap-1 p-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-fg">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-lg font-semibold text-content">{APP_NAME}</p>
            <p className="text-sm text-content-muted">{t('auth.tagline')}</p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
            <Suspense fallback={<LoadingScreen fullScreen={false} />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
