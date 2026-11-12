import { ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/utils/formatDate';

function ListSkeleton() {
  return (
    <ul aria-hidden="true" className="divide-y divide-line">
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The transfer history, newest first.
 * transfers / meta: from useAccountTransfers (undefined while loading).
 * accountsById: Map of id -> account, built from the list WITH archived accounts
 * (a transfer keeps pointing at an archived account, and an account with transfers can never be deleted).
 */
export function TransferList({
  transfers,
  meta,
  accountsById,
  isLoading,
  page,
  limit,
  onPageChange,
  onLimitChange,
}) {
  const { t, i18n } = useTranslation();

  if (isLoading) {
    return (
      <Card padded={false}>
        <ListSkeleton />
      </Card>
    );
  }

  if (!transfers || transfers.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState
          icon={ArrowLeftRight}
          title={t('accounts.transfersEmptyTitle')}
          description={t('accounts.transfersEmptyText')}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card padded={false}>
        <ul className="divide-y divide-line">
          {transfers.map((transfer) => {
            const from = accountsById.get(transfer.fromAccountId);
            const to = accountsById.get(transfer.toAccountId);
            return (
              <li key={transfer.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text"
                  aria-hidden="true"
                >
                  <ArrowLeftRight className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">
                    {t('accounts.fromTo', { from: from?.name ?? '—', to: to?.name ?? '—' })}
                  </p>
                  <p className="truncate text-xs text-content-muted">
                    <span className="amount">{formatDate(transfer.date, i18n.language)}</span>
                    {transfer.note ? ` · ${transfer.note}` : ''}
                  </p>
                </div>
                <CurrencyDisplay
                  value={transfer.amount}
                  currency={from?.currency}
                  className="text-sm font-semibold text-content"
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <Pagination
        page={page}
        limit={limit}
        total={meta?.total ?? 0}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    </div>
  );
}
