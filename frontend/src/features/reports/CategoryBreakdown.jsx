import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Card, CardHeader } from '@/components/ui/Card';
import { formatPercent } from '@/utils/formatCurrency';

/**
 * Every category of a period, the biggest first, with its exact total, its share and a bar.
 * items: [{ category { id, name, icon, color }, total, count, percent }] straight from the API
 * (the percent is the share of the whole; nothing is calculated here).
 * tone: 'expense' | 'income'. emptyText: shown when there is nothing.
 */
export function CategoryBreakdown({ title, items, currency, tone, emptyText }) {
  const { t, i18n } = useTranslation();

  return (
    <Card>
      <CardHeader title={title} description={t('reports.inCurrency', { currency })} />
      {items.length === 0 ? (
        <p className="text-sm text-content-muted">{emptyText}</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.category.id}>
              <div className="flex items-center gap-3">
                <CategoryIcon icon={item.category.icon} color={item.category.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">{item.category.name}</p>
                  <p className="truncate text-xs text-content-muted">
                    {t('reports.entries', { count: item.count })}
                    {' · '}
                    {formatPercent(item.percent, i18n.language)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold">
                  <CurrencyDisplay value={item.total} currency={currency} tone={tone} />
                </span>
              </div>
              {/* The bar repeats the percent in words above, so it is hidden from screen readers. */}
              <div
                aria-hidden="true"
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${item.percent}%`, backgroundColor: item.category.color }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
