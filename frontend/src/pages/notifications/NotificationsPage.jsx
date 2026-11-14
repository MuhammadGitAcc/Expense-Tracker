import { useMemo, useState } from 'react';
import { BellOff, CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage, isNetworkError } from '@/api/axiosClient';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import {
  NotificationList,
  NotificationListSkeleton,
} from '@/features/notifications/NotificationList';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from '@/features/notifications/useNotifications';
import { toast } from '@/hooks/useToast';
import { DEFAULT_PAGE_SIZE, NOTIFICATION_TYPES } from '@/utils/constants';

const NO_FILTERS = { status: '', type: '' };

function LoadError({ onRetry }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t('errors.somethingWrong')}
      description={t('errors.loadFailed')}
      action={<Button onClick={onRetry}>{t('common.tryAgain')}</Button>}
    />
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const params = useMemo(
    () => ({
      page,
      limit,
      ...(filters.status === 'unread' ? { isRead: 'false' } : {}),
      ...(filters.status === 'read' ? { isRead: 'true' } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    }),
    [page, limit, filters],
  );

  const query = useNotifications(params);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = query.data?.notifications;
  const meta = query.data?.meta;
  const unreadCount = meta?.unreadCount ?? 0;
  const hasFilters = Boolean(filters.status || filters.type);
  const busyId = markRead.isPending ? markRead.variables : null;

  const showError = (error) =>
    toast.error(
      isNetworkError(error) ? t('errors.network') : getErrorMessage(error, t('errors.generic')),
    );

  const changeFilter = (change) => {
    setFilters((current) => ({ ...current, ...change }));
    setPage(1);
  };

  const handleMarkRead = (id) => {
    markRead.mutate(id, {
      onSuccess: () => {
        // The last unread item of a later page leaves the "unread" list: go one page back.
        if (filters.status === 'unread' && notifications?.length === 1 && page > 1) {
          setPage(page - 1);
        }
      },
      onError: showError,
    });
  };

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        setPage(1);
        toast.success(t('notifications.allMarked'));
      },
      onError: showError,
    });
  };

  let content;
  if (query.isPending) {
    content = <NotificationListSkeleton />;
  } else if (query.isError && !query.data) {
    content = <LoadError onRetry={() => query.refetch()} />;
  } else if (notifications.length === 0) {
    content = hasFilters ? (
      <EmptyState
        icon={BellOff}
        title={t('notifications.noResultsTitle')}
        description={t('notifications.noResultsText')}
        action={
          <Button
            variant="outline"
            onClick={() => {
              setFilters(NO_FILTERS);
              setPage(1);
            }}
          >
            {t('notifications.clearFilters')}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={BellOff}
        title={t('notifications.emptyTitle')}
        description={t('notifications.emptyText')}
      />
    );
  } else {
    content = (
      <div
        className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}
        aria-busy={query.isPlaceholderData || undefined}
      >
        <NotificationList
          notifications={notifications}
          onMarkRead={handleMarkRead}
          busyId={busyId}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('notifications.title')}
        description={
          meta ? t('notifications.unreadSummary', { n: unreadCount }) : t('notifications.subtitle')
        }
        actions={
          <Button
            variant="outline"
            iconStart={<CheckCheck className="h-4 w-4" aria-hidden="true" />}
            loading={markAllRead.isPending}
            disabled={unreadCount === 0}
            onClick={handleMarkAll}
          >
            {t('notifications.markAllRead')}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:max-w-xl sm:grid-cols-2">
        <Select
          label={t('notifications.statusLabel')}
          value={filters.status}
          onChange={(event) => changeFilter({ status: event.target.value })}
          options={[
            { value: '', label: t('notifications.status.all') },
            { value: 'unread', label: t('notifications.status.unread') },
            { value: 'read', label: t('notifications.status.read') },
          ]}
        />
        <Select
          label={t('notifications.typeLabel')}
          value={filters.type}
          onChange={(event) => changeFilter({ type: event.target.value })}
          options={[
            { value: '', label: t('notifications.allTypes') },
            ...NOTIFICATION_TYPES.map((type) => ({
              value: type,
              label: t(`notifications.types.${type}`),
            })),
          ]}
        />
      </div>

      {content}

      {meta && meta.total > 0 ? (
        <Pagination
          className="mt-4"
          page={page}
          limit={limit}
          total={meta.total}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}
