import { useMemo } from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartCard, ChartError, ChartSkeleton } from '@/features/dashboard/ChartCard';
import { formatPercent } from '@/utils/formatCurrency';

const TOP = 6; // the biggest categories get their own slice, the rest are one "Other" slice
const OTHER_COLOR = 'rgb(var(--color-content-muted))';

/**
 * Where the spending went, as a donut with a legend. query: the result of useCategoryReport for
 * the expenses of the chosen period. The slice sizes are only drawn here; every amount in the
 * legend is the exact string from the API and every share is the percent the API sends.
 */
export function CategoryPieChart({ query }) {
  const { t, i18n } = useTranslation();
  const report = query.data;
  const title = t('dashboard.categoryTitle');

  const { rows, slices } = useMemo(() => {
    const categories = report?.categories ?? [];
    const top = categories.slice(0, TOP);
    const rest = categories.slice(TOP);

    const items = top.map((item) => ({
      key: item.category.id,
      name: item.category.name,
      color: item.category.color,
      total: item.total,
      percent: item.percent,
    }));
    if (rest.length > 0) {
      items.push({
        key: 'other',
        name: t('dashboard.other'),
        color: OTHER_COLOR,
        total: null, // no amount shown: only the share
        percent: Number(rest.reduce((sum, item) => sum + item.percent, 0).toFixed(1)),
        // Only used to size the slice.
        plotValue: rest.reduce((sum, item) => sum + Number(item.total), 0),
      });
    }
    return {
      rows: items,
      slices: items.map((item) => ({ ...item, value: item.plotValue ?? Number(item.total) })),
    };
  }, [report, t]);

  if (query.isError) return <ChartError title={title} onRetry={() => query.refetch()} />;
  if (query.isLoading || !report) return <ChartSkeleton />;

  if (rows.length === 0) {
    return (
      <ChartCard title={title}>
        <EmptyState
          className="py-8"
          icon={PieIcon}
          title={t('dashboard.categoryEmptyTitle')}
          description={t('dashboard.categoryEmptyText')}
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={title}
      description={t('dashboard.categoryHint', { currency: report.currency })}
    >
      {/* The legend below says everything the chart shows, so screen readers skip the chart. */}
      <div dir="ltr" aria-hidden="true" className="mx-auto h-44 w-full max-w-[11rem]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="60%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: row.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-content">{row.name}</span>
            <span className="amount shrink-0 text-xs text-content-muted">
              {formatPercent(row.percent, i18n.language)}
            </span>
            {row.total === null ? null : (
              <CurrencyDisplay
                value={row.total}
                currency={report.currency}
                className="shrink-0 font-medium"
              />
            )}
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
