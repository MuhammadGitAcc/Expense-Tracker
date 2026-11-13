import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { ChartCard, ChartError, ChartSkeleton } from '@/features/dashboard/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCompactCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';

// The colours are the theme tokens, so the chart follows light and dark mode.
const INCOME = 'rgb(var(--color-income))';
const EXPENSE = 'rgb(var(--color-expense))';
const MUTED = 'rgb(var(--color-content-muted))';
const LINE = 'rgb(var(--color-line))';

const isMonth = (period) => period.length === 7; // "2026-11" (a day is "2026-11-09")

function shortLabel(period, locale) {
  return isMonth(period)
    ? formatDate(`${period}-01`, locale, { month: 'short', year: '2-digit' })
    : formatDate(period, locale, { day: 'numeric', month: 'short' });
}

function longLabel(period, locale) {
  return isMonth(period)
    ? formatDate(`${period}-01`, locale, { month: 'long', year: 'numeric' })
    : formatDate(period, locale);
}

function ChartTooltip({ active, payload, label, currency }) {
  const { t, i18n } = useTranslation();
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-line bg-surface p-3 text-sm shadow-card">
      <p className="mb-1 font-medium text-content">{longLabel(label, i18n.language)}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center justify-between gap-4">
          <span className="text-content-muted">
            {t(item.dataKey === 'income' ? 'dashboard.income' : 'dashboard.expenses')}
          </span>
          <CurrencyDisplay
            value={item.value}
            currency={currency}
            tone={item.dataKey === 'income' ? 'income' : 'expense'}
          />
        </p>
      ))}
    </div>
  );
}

function Legend() {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-content-muted">
      {[
        ['dashboard.income', INCOME],
        ['dashboard.expenses', EXPENSE],
      ].map(([key, color]) => (
        <li key={key} className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          {t(key)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Income and expenses over time, as bars (a day each, or a month each for long periods).
 * query: the result of useDashboardTrends. The numbers are only drawn here: the exact amounts
 * are in the cards and in the tooltip, formatted from the same values.
 */
export function SpendingChart({ query }) {
  const { t, i18n } = useTranslation();
  const trends = query.data;
  const title = t('dashboard.spendingTitle');

  const data = useMemo(
    () =>
      (trends?.series ?? []).map((point) => ({
        period: point.period,
        income: Number(point.income),
        expense: Number(point.expense),
      })),
    [trends],
  );

  if (query.isError) return <ChartError title={title} onRetry={() => query.refetch()} />;
  if (query.isLoading || !trends) return <ChartSkeleton />;

  const description = t(
    trends.granularity === 'month' ? 'dashboard.spendingMonthly' : 'dashboard.spendingDaily',
  );
  const hasActivity = data.some((point) => point.income !== 0 || point.expense !== 0);

  if (!hasActivity) {
    return (
      <ChartCard title={title} description={description}>
        <EmptyState
          className="py-8"
          icon={BarChart3}
          title={t('dashboard.chartEmptyTitle')}
          description={t('dashboard.chartEmptyText')}
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard title={title} description={description}>
      <Legend />
      {/* Time runs left to right in every language, so the chart stays LTR. */}
      <div
        dir="ltr"
        role="img"
        aria-label={t('dashboard.chartLabel', { currency: trends.currency })}
        className="mt-4 h-64 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={LINE} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="period"
              tickFormatter={(value) => shortLabel(value, i18n.language)}
              tick={{ fill: MUTED, fontSize: 12 }}
              stroke={LINE}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              width={64}
              tickFormatter={(value) =>
                formatCompactCurrency(value, trends.currency, i18n.language)
              }
              tick={{ fill: MUTED, fontSize: 12 }}
              stroke={LINE}
            />
            <Tooltip
              cursor={{ fill: 'rgb(var(--color-surface-muted))' }}
              content={<ChartTooltip currency={trends.currency} />}
            />
            <Bar
              dataKey="income"
              fill={INCOME}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expense"
              fill={EXPENSE}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
