import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useUnreadCount } from '@/features/notifications/useNotifications';
import { PATHS } from '@/routes/paths';

/** The bell in the Topbar: a link to /notifications with the number of unread ones. */
export function NotificationBell() {
  const { t } = useTranslation();
  const { data: unreadCount = 0 } = useUnreadCount();

  const label =
    unreadCount > 0 ? t('notifications.bellUnread', { n: unreadCount }) : t('notifications.bell');

  return (
    <Button
      as={Link}
      to={PATHS.notifications}
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={label}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute end-1 top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Button>
  );
}
