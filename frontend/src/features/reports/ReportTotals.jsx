import { ArrowDownLeft, ArrowUpRight, PiggyBank } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Change, SummaryCard } from '@/features/dashboard/SummaryCards';
import { formatPercent } from '@/utils/formatCurrency';

/**
 * Income, expenses and savings of a report, in ONE currency, each with the change against the
 * previous period (the same cards and words as the dashboard).
 * report: the data of the monthly or yearly report { currency, totals, change }.
 */
export function ReportTotals({ report }) {
  const { t, i18n } = useTranslation();
  const { currency, totals, change } = report;

  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      <SummaryCard
        icon={ArrowDownLeft}
        label={t('dashboard.income')}
        footer={<Change value={change.income} upIsGood />}
      >
        <CurrencyDisplay value={totals.income} currency={currency} tone="income" />
      </SummaryCard>

      <SummaryCard
        icon={ArrowUpRight}
        label={t('dashboard.expenses')}
        footer={<Change value={change.expense} upIsGood={false} />}
      >
        <CurrencyDisplay value={totals.expense} currency={currency} tone="expense" />
      </SummaryCard>

      <SummaryCard
        icon={PiggyBank}
        label={t('dashboard.savings')}
        footer={
          <p className="text-xs text-content-muted">
            {totals.savingsRate === null || totals.savingsRate === undefined
              ? t('dashboard.savingsRateNone')
              : t('dashboard.savingsRate', {
                  rate: formatPercent(totals.savingsRate, i18n.language),
                })}
          </p>
        }
      >
        <CurrencyDisplay value={totals.savings} currency={currency} tone="auto" showSign />
      </SummaryCard>
    </ul>
  );
}
