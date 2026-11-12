import { Plus, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { AccountCard } from '@/features/accounts/AccountCard';

/**
 * The total balance, one figure per currency (the API sums them exactly; nothing is converted).
 * totals: { USD: "150.50" } or undefined while loading. Shows nothing when there is no account.
 */
export function AccountTotals({ totals, isLoading }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card className="mb-6" aria-hidden="true">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-8 w-40" />
      </Card>
    );
  }

  const entries = Object.entries(totals ?? {});
  if (entries.length === 0) return null;

  return (
    <Card as="section" aria-labelledby="accounts-total" className="mb-6">
      <h2 id="accounts-total" className="text-sm font-medium text-content-muted">
        {t('accounts.total')}
      </h2>
      <ul className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
        {entries.map(([currency, total]) => (
          <li key={currency} className="text-2xl font-semibold text-content">
            <CurrencyDisplay
              value={total}
              currency={currency}
              tone={Number(total) < 0 ? 'expense' : 'neutral'}
            />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-content-muted">{t('accounts.totalHint')}</p>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <ul aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Card as="li" key={index} className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-8 w-36" />
        </Card>
      ))}
    </ul>
  );
}

/**
 * The accounts as a grid of cards.
 * accounts: array, or undefined while loading. Errors are shown by the page.
 * busyId: id of the account whose archive request is running.
 */
export function AccountList({
  accounts,
  isLoading,
  busyId,
  onAdd,
  onEdit,
  onToggleArchive,
  onDelete,
}) {
  const { t } = useTranslation();

  if (isLoading) return <ListSkeleton />;

  if (!accounts || accounts.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState
          icon={Wallet}
          title={t('accounts.emptyTitle')}
          description={t('accounts.emptyText')}
          action={
            <Button iconStart={<Plus className="h-4 w-4" />} onClick={onAdd}>
              {t('accounts.add')}
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          busy={busyId === account.id}
          onEdit={onEdit}
          onToggleArchive={onToggleArchive}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
