import { lazy, Suspense, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Button, buttonStyles } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { BudgetOverview } from '@/features/dashboard/BudgetOverview';
import { ChartSkeleton } from '@/features/dashboard/ChartCard';
import {
  RecentTransactions,
  RecentTransactionsSkeleton,
} from '@/features/dashboard/RecentTransactions';
import { SummaryCards, SummaryCardsSkeleton } from '@/features/dashboard/SummaryCards';
import { useDashboardSummary, useDashboardTrends } from '@/features/dashboard/useDashboard';
import { useCategoryReport } from '@/features/reports/useReports';
import { useAuth } from '@/hooks/useAuth';
import { PATHS } from '@/routes/paths';
import { PERIODS } from '@/utils/constants';
import { formatDate, isValidISODate, parseISODate, todayISO } from '@/utils/formatDate';

// Recharts is big: the charts load from their own files, after the cards are on screen.
const SpendingChart = lazy(() =>
  import('@/features/dashboard/SpendingChart').then((module) => ({
    default: module.SpendingChart,
  })),
);
const CategoryPieChart = lazy(() =>
  import('@/features/dashboard/CategoryPieChart').then((module) => ({
    default: module.CategoryPieChart,
  })),
);

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366 * 5; // the same limit as the API

/** null when the custom range can be sent, else the translation key of the problem. */
function rangeProblem(from, to) {
  if (!isValidISODate(from) || !isValidISODate(to)) return 'dashboard.customHint';
  if (from > to) return 'dashboard.rangeInvalid';
  const days = Math.round((parseISODate(to) - parseISODate(from)) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS) return 'dashboard.rangeTooLong';
  return null;
}

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

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [period, setPeriod] = useState('this_month');
  // The custom range starts as "the first of this month until today".
  const [from, setFrom] = useState(() => `${todayISO().slice(0, 8)}01`);
  const [to, setTo] = useState(todayISO);
  // '' = the profile currency (the API decides).
  const [currency, setCurrency] = useState('');

  const isCustom = period === 'custom';
  const problem = isCustom ? rangeProblem(from, to) : null;

  const params = useMemo(() => {
    const result = { period };
    if (isCustom) {
      result.from = from;
      result.to = to;
    }
    if (currency) result.currency = currency;
    return result;
  }, [period, isCustom, from, to, currency]);

  const query = useDashboardSummary(params, { enabled: !problem });
  const summary = query.data;
  const trendsQuery = useDashboardTrends(params, { enabled: !problem });
  // The pie uses the exact dates and the currency the summary has just resolved.
  const categoryQuery = useCategoryReport(
    summary
      ? {
          from: summary.period.from,
          to: summary.period.to,
          currency: summary.currency,
          type: 'expense',
        }
      : undefined,
    { enabled: Boolean(summary) },
  );

  // The currencies of the user's accounts. The chosen one is always in the list.
  const currencies = useMemo(() => {
    const list = summary?.meta?.availableCurrencies ?? [];
    return summary && !list.includes(summary.currency) ? [summary.currency, ...list] : list;
  }, [summary]);

  const firstName = user?.name?.split(' ')[0] ?? '';

  const renderBody = () => {
    if (problem) return null;
    if (query.isError) return <LoadError onRetry={() => query.refetch()} />;
    if (query.isLoading || !summary) {
      return (
        <div className="space-y-6">
          <SummaryCardsSkeleton />
          <RecentTransactionsSkeleton />
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <SummaryCards summary={summary} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense fallback={<ChartSkeleton />}>
              <SpendingChart query={trendsQuery} />
            </Suspense>
          </div>
          <Suspense fallback={<ChartSkeleton />}>
            <CategoryPieChart query={categoryQuery} />
          </Suspense>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentTransactions
            transactions={summary.recentTransactions}
            currency={summary.currency}
          />
          <BudgetOverview currency={(user?.currency ?? summary.currency).toUpperCase()} />
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.welcome', { name: firstName })}
        actions={
          <Link to={PATHS.expenses} state={{ openAdd: true }} className={buttonStyles()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('dashboard.addExpense')}
          </Link>
        }
      />

      <div className="mb-2 grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label={t('dashboard.periodLabel')}
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          options={PERIODS.map((value) => ({ value, label: t(`dashboard.periods.${value}`) }))}
        />
        {isCustom ? (
          <>
            <DatePicker
              label={t('dashboard.from')}
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <DatePicker
              label={t('dashboard.to')}
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </>
        ) : null}
        {currencies.length > 1 ? (
          <Select
            label={t('dashboard.currencyLabel')}
            value={summary?.currency ?? currency}
            onChange={(event) => setCurrency(event.target.value)}
            options={currencies.map((code) => ({ value: code, label: code }))}
          />
        ) : null}
      </div>

      {problem ? (
        <p role="note" className="mb-4 text-sm text-content-muted">
          {t(problem)}
        </p>
      ) : summary ? (
        <p className="mb-4 text-sm text-content-muted">
          {t('dashboard.range', {
            from: formatDate(summary.period.from, i18n.language),
            to: formatDate(summary.period.to, i18n.language),
          })}
          {' · '}
          {t('dashboard.transactionCount', { count: summary.transactionCount })}
        </p>
      ) : (
        <div className="mb-4 h-5" />
      )}

      <div
        aria-busy={query.isPlaceholderData || undefined}
        className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}
      >
        {renderBody()}
      </div>
    </>
  );
}
