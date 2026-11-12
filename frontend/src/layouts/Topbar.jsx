import { LogOut, Menu, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { assetUrl } from '@/api/axiosClient';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { useLogout } from '@/features/auth/useLogout';
import { openMobileMenu } from '@/features/ui/uiSlice';
import { useAuth } from '@/hooks/useAuth';
import { PATHS } from '@/routes/paths';

export function Topbar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const logout = useLogout();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
      {/* Phone only: opens the slide-over menu */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={t('nav.openMenu')}
        onClick={() => dispatch(openMobileMenu())}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>

      <div className="flex-1" />

      <LanguageSwitcher />
      <ThemeToggle />

      <Dropdown
        label={t('nav.accountMenu')}
        triggerClassName="h-10 w-auto gap-2 px-1"
        items={[
          {
            key: 'settings',
            label: t('nav.settings'),
            icon: <Settings className="h-4 w-4" />,
            onSelect: () => navigate(PATHS.settings),
          },
          { separator: true },
          {
            key: 'logout',
            label: t('auth.logout'),
            icon: <LogOut className="h-4 w-4" />,
            variant: 'danger',
            onSelect: logout,
          },
        ]}
      >
        <Avatar src={assetUrl(user?.avatarUrl)} name={user?.name} size="sm" />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
          {user?.name}
        </span>
      </Dropdown>
    </header>
  );
}
