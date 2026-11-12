import { Menu, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { openMobileMenu } from '@/features/ui/uiSlice';
import { BOTTOM_NAV_ITEMS } from '@/layouts/navItems';
import { PATHS } from '@/routes/paths';

const itemClass = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium';

/** Phone only: the main links, a "More" button and a floating "Add" button. */
export function MobileBottomNav() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        onClick={() => navigate(PATHS.expenses, { state: { openAdd: true } })}
        aria-label={t('nav.addExpense')}
        className="fixed bottom-20 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg transition-colors hover:bg-primary-hover md:hidden"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      <nav
        aria-label={t('nav.main')}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-safe md:hidden"
      >
        {BOTTOM_NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(itemClass, isActive ? 'text-primary-text' : 'text-content-muted')
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="truncate">{t(labelKey)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => dispatch(openMobileMenu())}
          className={cn(itemClass, 'text-content-muted')}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span>{t('nav.more')}</span>
        </button>
      </nav>
    </>
  );
}
