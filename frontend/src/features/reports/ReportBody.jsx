import { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ChartSkeleton } from '@/features/dashboard/ChartCard';
import { AccountBreakdown } from '@/features/reports/AccountBreakdown';
import { CategoryBreakdown } from '@/features/reports/CategoryBreakdown';
import { ReportTotals } from '@/features/reports/ReportTotals';

// Recharts is big: the chart loads from its own file (the dashboard uses the same one).
const SpendingChart = lazy(() =>
  import('@/features/dashboard/SpendingChart').then((module) => ({
    default: module.SpendingChart,
  })),
);

function ReportSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <ul className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card as="li" key={index} className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </ul>
      <ChartSkeleton />
    </div>
  );
}

/**
 * Everything one report shows: totals, the chart, the categories and the accounts.
 * query: the result of useMonthlyReport or useYearlyReport.
 * seriesKey: the field with the chart points ('daily' or 'monthly'), granularity: 'day' | 'month'.
 */
export function ReportBody({ query, seriesKey, granularity }) {
  const { t } = useTranslation();
  const report = query.data;

  // The report already holds the points, in the same shape the chart reads from the trends.
  const trends = useMemo(
    () =>
      report ? { currency: report.currency, granularity, series: report[seriesKey] } : undefined,
    [report, seriesKey, granularity],
  );

  if (query.isError) {
    return (
      <EmptyState
        title={t('errors.somethingWrong')}
        description={t('errors.loadFailed')}
        action={<Button onClick={() => query.refetch()}>{t('common.tryAgain')}</Button>}
      />
    );
  }
  if (query.isLoading || !report) return <ReportSkeleton />;

  const chartQuery = { isError: false, isLoading: false, data: trends, refetch: query.refetch };

  return (
    <div className="space-y-6">
      <ReportTotals report={report} />

      <Suspense fallback={<ChartSkeleton />}>
        <SpendingChart query={chartQuery} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBreakdown
          title={t('reports.expensesByCategory')}
          items={report.expenseByCategory}
          currency={report.currency}
          tone="expense"
          emptyText={t('reports.noExpenses')}
        />
        <CategoryBreakdown
          title={t('reports.incomeByCategory')}
          items={report.incomeByCategory}
          currency={report.currency}
          tone="income"
          emptyText={t('reports.noIncome')}
        />
      </div>

      <AccountBreakdown from={report.from} to={report.to} currency={report.currency} />
    </div>
  );
}
