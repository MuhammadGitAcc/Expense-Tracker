import { useMemo } from 'react';
import { PiggyBank, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BudgetProgress } from '@/features/budgets/BudgetProgress';
import { useBudgets } from '@/features/budgets/useBudgets';
import { PATHS } from '@/routes/paths';
import { categoryName } from '@/utils/categoryName';
import { formatMonthYear } from '@/utils/formatDate';

const SHOWN = 4; // the budgets closest to their limit

/**
 * The budgets of the CURRENT month, the ones closest to their limit first. Budgets have no
 * currency of their own and nothing is converted, so the amounts are in the profile currency
 * (currency prop), whatever currency the rest of the dashboard shows.
 */
export function BudgetOverview({ currency }) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const query = useBudgets({ month, year });
  const budgets = query.data?.budgets;

  const top = useMemo(
    () => [...(budgets ?? [])].sort((a, b) => b.percentUsed - a.percentUsed).slice(0, SHOWN),
    [budgets],
  );

  const title = t('dashboard.budgetTitle');

  if (query.isError) {
    return (
      <Card>
        <CardHeader title={title} />
        <EmptyState
          className="py-8"
          title={t('errors.somethingWrong')}
          description={t('errors.loadFailed')}
          action={<Button onClick={() => query.refetch()}>{t('common.tryAgain')}</Button>}
        />
      </Card>
    );
  }

  if (query.isLoading || !budgets) {
    return (
      <Card aria-hidden="true" className="space-y-4">
        <Skeleton className="h-5 w-44" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </Card>
    );
  }

  if (budgets.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState
          icon={PiggyBank}
          title={t('dashboard.budgetEmptyTitle')}
          description={t('dashboard.budgetEmptyText')}
          action={
            <Link to={PATHS.budgets} className={buttonStyles()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('dashboard.budgetSet')}
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={title}
        description={t('dashboard.budgetHint', {
          month: formatMonthYear(year, month, i18n.language),
          currency,
        })}
      />
      <ul className="space-y-4">
        {top.map((budget) => {
          const name = budget.category
            ? categoryName(t, budget.category.name)
            : t('budgets.overall');
          return (
            <li key={budget.id}>
              <p className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                <span className="font-medium text-content">{name}</span>
                <span className="text-content-muted">
                  <CurrencyDisplay
                    value={budget.spent}
                    currency={currency}
                    tone={budget.status === 'exceeded' ? 'expense' : 'neutral'}
                  />{' '}
                  {t('budgets.ofLimit')}{' '}
                  <CurrencyDisplay value={budget.amount} currency={currency} />
                </span>
              </p>
              <BudgetProgress
                percentUsed={budget.percentUsed}
                status={budget.status}
                label={t('budgets.progressFor', { name })}
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <Link to={PATHS.budgets} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
          {t('dashboard.budgetViewAll')}
        </Link>
      </div>
    </Card>
  );
}
