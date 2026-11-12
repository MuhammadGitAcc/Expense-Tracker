import { ChevronsLeft, ChevronsRight, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { APP_NAME } from '@/utils/constants';
import { selectSidebarCollapsed, toggleSidebar } from '@/features/ui/uiSlice';
import { NAV_ITEMS } from '@/layouts/navItems';

/** The list of links. Used by the desktop/tablet sidebar and by the phone slide-over menu. */
export function NavList({ collapsed = false, onNavigate }) {
  const { t } = useTranslation();

  return (
    <nav aria-label={t('nav.main')} className="flex-1 space-y-1 overflow-y-auto p-3">
      {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          title={collapsed ? t(labelKey) : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              collapsed && 'justify-center',
              isActive
                ? 'bg-primary-soft text-primary-text'
                : 'text-content-muted hover:bg-surface-muted hover:text-content',
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={cn('truncate', collapsed && 'sr-only')}>{t(labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function BrandLink({ collapsed = false }) {
  return (
    <div className={cn('flex h-16 items-center gap-2 px-4', collapsed && 'justify-center px-0')}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg">
        <Wallet className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className={cn('truncate font-semibold text-content', collapsed && 'sr-only')}>
        {APP_NAME}
      </span>
    </div>
  );
}

/**
 * Tablet (md): always icon-only. Desktop (lg): full width, collapsible with the button.
 * Hidden on phones (they use the bottom bar and the slide-over menu).
 */
export function Sidebar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const collapsed = useSelector(selectSidebarCollapsed);
  const Chevron = collapsed ? ChevronsRight : ChevronsLeft;

  return (
    <>
      {/* Tablet: icon-only */}
      <aside className="hidden w-16 shrink-0 flex-col border-e border-line bg-surface md:flex lg:hidden">
        <BrandLink collapsed />
        <NavList collapsed />
      </aside>

      {/* Desktop: collapsible */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-e border-line bg-surface transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <BrandLink collapsed={collapsed} />
        <NavList collapsed={collapsed} />
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            aria-expanded={!collapsed}
            className="flex h-10 w-full items-center justify-center rounded-lg text-content-muted hover:bg-surface-muted hover:text-content"
          >
            <Chevron className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}
