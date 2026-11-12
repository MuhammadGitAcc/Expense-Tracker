import { useEffect } from 'react';
import { LogOut, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useLogout } from '@/features/auth/useLogout';
import { closeMobileMenu, selectMobileMenuOpen } from '@/features/ui/uiSlice';
import { BrandLink, NavList } from '@/layouts/Sidebar';

/** The phone slide-over menu: all links plus logout. Closes on Escape, on a tap outside and on navigation. */
export function MobileMenu() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const open = useSelector(selectMobileMenuOpen);
  const logout = useLogout();
  const { pathname } = useLocation();

  useEffect(() => {
    dispatch(closeMobileMenu());
  }, [pathname, dispatch]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') dispatch(closeMobileMenu());
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dispatch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div
        className="absolute inset-0 animate-fade-in bg-black/50"
        onClick={() => dispatch(closeMobileMenu())}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.main')}
        className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] animate-fade-in flex-col bg-surface shadow-lg"
      >
        <div className="flex items-center justify-between pe-2">
          <BrandLink />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.close')}
            onClick={() => dispatch(closeMobileMenu())}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <NavList onNavigate={() => dispatch(closeMobileMenu())} />
        <div className="border-t border-line p-3 pb-safe">
          <Button
            variant="outline"
            fullWidth
            iconStart={<LogOut className="h-4 w-4" />}
            onClick={logout}
          >
            {t('auth.logout')}
          </Button>
        </div>
      </aside>
    </div>
  );
}
