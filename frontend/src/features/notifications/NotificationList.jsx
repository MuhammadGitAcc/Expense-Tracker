import { AlertOctagon, AlertTriangle, CalendarDays, Check, Info, Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelativeTime } from '@/utils/formatDate';

// One icon and one colour pair per notification type. Unknown types fall back to "system".
const TYPE_STYLES = {
  budget_warning: { icon: AlertTriangle, className: 'bg-warning-soft text-warning' },
  budget_exceeded: { icon: AlertOctagon, className: 'bg-danger-soft text-danger' },
  recurring_created: { icon: Repeat, className: 'bg-primary-soft text-primary-text' },
  weekly_summary: { icon: CalendarDays, className: 'bg-primary-soft text-primary-text' },
  system: { icon: Info, className: 'bg-surface-muted text-content-muted' },
};

function NotificationItem({ notification, onMarkRead, busy }) {
  const { t, i18n } = useTranslation();
  const style = TYPE_STYLES[notification.type] ?? TYPE_STYLES.system;
  const Icon = style.icon;

  return (
    <Card
      as="li"
      padded={false}
      className={cn(
        'flex items-start gap-3 p-3 sm:p-4',
        !notification.isRead && 'border-primary/40',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          style.className,
        )}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3
            className={cn(
              'break-words text-sm text-content',
              notification.isRead ? 'font-medium' : 'font-semibold',
            )}
          >
            {notification.title}
          </h3>
          {!notification.isRead ? <Badge variant="primary">{t('notifications.new')}</Badge> : null}
        </div>
        <p className="mt-0.5 break-words text-sm text-content-muted">{notification.message}</p>
        <p className="mt-1 text-xs text-content-muted">
          <span>{t(`notifications.types.${notification.type}`, { defaultValue: '' })}</span>
          {TYPE_STYLES[notification.type] ? <span aria-hidden="true"> · </span> : null}
          <time
            dateTime={notification.createdAt}
            title={formatDateTime(notification.createdAt, i18n.language)}
          >
            {formatRelativeTime(notification.createdAt, i18n.language)}
          </time>
        </p>
      </div>

      {!notification.isRead ? (
        <Button
          variant="ghost"
          size="icon"
          loading={busy}
          aria-label={t('notifications.markReadLabel', { title: notification.title })}
          title={t('notifications.markRead')}
          onClick={() => onMarkRead(notification.id)}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </Card>
  );
}

/**
 * <NotificationList notifications={data.notifications} onMarkRead={(id) => ...} busyId={id} />
 * Put it on a page: it renders a <ul>. busyId = the notification whose request is running.
 */
export function NotificationList({ notifications, onMarkRead, busyId }) {
  return (
    <ul className="space-y-3">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
          busy={busyId === notification.id}
        />
      ))}
    </ul>
  );
}

export function NotificationListSkeleton() {
  return (
    <ul aria-hidden="true" className="space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <Card as="li" key={index} padded={false} className="flex items-start gap-3 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-3 w-24" />
          </div>
        </Card>
      ))}
    </ul>
  );
}
