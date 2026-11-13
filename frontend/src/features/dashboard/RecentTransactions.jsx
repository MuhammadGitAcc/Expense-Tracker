import { Plus, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { PATHS } from '@/routes/paths';
import { formatDate } from '@/utils/formatDate';

/** The card while the first load runs. */
export function RecentTransactionsSkeleton() {
  return (
    <Card aria-hidden="true" className="space-y-4">
      <Skeleton className="h-5 w-48" />
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </Card>
  );
}

/**
 * The latest income and expenses (the API sends 5, newest first), in ONE currency.
 * transactions: [{ id, type, amount, date, note, source, category, account }].
 */
export function RecentTransactions({ transactions, currency }) {
  const { t, i18n } = useTranslation();

  if (transactions.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState
          icon={Receipt}
          title={t('dashboard.recentEmptyTitle')}
          description={t('dashboard.recentEmptyText', { currency })}
          action={
            <Link to={PATHS.expenses} state={{ openAdd: true }} className={buttonStyles()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('dashboard.addExpense')}
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t('dashboard.recentTitle')}
        description={t('dashboard.recentHint', { currency })}
      />
      <ul className="divide-y divide-line">
        {transactions.map((item) => {
          const isExpense = item.type === 'expense';
          const title = item.note || item.source || item.category.name;
          // The category is the title when there is no note or source, so it is not repeated.
          const details = [
            title === item.category.name ? null : item.category.name,
            formatDate(item.date, i18n.language),
            item.account.name,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <li key={`${item.type}-${item.id}`} className="flex items-center gap-3 py-3">
              <CategoryIcon icon={item.category.icon} color={item.category.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content">{title}</p>
                <p className="truncate text-xs text-content-muted">{details}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold">
                <CurrencyDisplay
                  value={item.amount}
                  currency={currency}
                  tone={isExpense ? 'expense' : 'income'}
                  showSign
                />
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={PATHS.expenses} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
          {t('dashboard.viewExpenses')}
        </Link>
        <Link to={PATHS.income} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
          {t('dashboard.viewIncome')}
        </Link>
      </div>
    </Card>
  );
}
