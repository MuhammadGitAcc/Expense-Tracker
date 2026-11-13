import {
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';
import { formatPercent } from '@/utils/formatCurrency';

const GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4';

/** The four cards while the first load runs. */
export function SummaryCardsSkeleton() {
  return (
    <ul aria-hidden="true" className={GRID}>
      {Array.from({ length: 4 }, (_, index) => (
        <Card as="li" key={index} className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-3 w-32" />
        </Card>
      ))}
    </ul>
  );
}

/**
 * The change against the previous period. The API sends a number with one decimal, or null when
 * the previous period had nothing. upIsGood: income is good when it goes up, spending when it
 * goes down. An arrow and a sentence say it too, so colour is never the only signal.
 */
export function Change({ value, upIsGood }) {
  const { t, i18n } = useTranslation();

  if (value === null || value === undefined) {
    return <p className="text-xs text-content-muted">{t('dashboard.changeNone')}</p>;
  }
  if (value === 0) {
    return <p className="text-xs text-content-muted">{t('dashboard.changeSame')}</p>;
  }

  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        up === upIsGood ? 'text-income' : 'text-expense',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {t(up ? 'dashboard.changeUp' : 'dashboard.changeDown', {
          percent: formatPercent(Math.abs(value), i18n.language),
        })}
      </span>
    </p>
  );
}

export function SummaryCard({ icon: Icon, label, footer, children }) {
  return (
    <Card as="li" className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-content-muted">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text"
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="truncate font-medium">{label}</h3>
      </div>
      <p className="break-words text-2xl font-semibold text-content">{children}</p>
      <div>{footer}</div>
    </Card>
  );
}

/**
 * Balance, income, expenses and savings of the chosen period, all in ONE currency
 * (summary.currency). Money is shown exactly as the API sends it, never calculated here.
 */
export function SummaryCards({ summary }) {
  const { t, i18n } = useTranslation();
  const { currency } = summary;

  return (
    <ul className={GRID}>
      <SummaryCard
        icon={Wallet}
        label={t('dashboard.balance')}
        footer={
          <p className="text-xs text-content-muted">
            {t('dashboard.activeAccounts', { count: summary.balance.accountCount })}
          </p>
        }
      >
        <CurrencyDisplay value={summary.balance.total} currency={currency} tone="auto" />
      </SummaryCard>

      <SummaryCard
        icon={ArrowDownLeft}
        label={t('dashboard.income')}
        footer={<Change value={summary.change.income} upIsGood />}
      >
        <CurrencyDisplay value={summary.income} currency={currency} tone="income" />
      </SummaryCard>

      <SummaryCard
        icon={ArrowUpRight}
        label={t('dashboard.expenses')}
        footer={<Change value={summary.change.expense} upIsGood={false} />}
      >
        <CurrencyDisplay value={summary.expense} currency={currency} tone="expense" />
      </SummaryCard>

      <SummaryCard
        icon={PiggyBank}
        label={t('dashboard.savings')}
        footer={
          <p className="text-xs text-content-muted">
            {summary.savingsRate === null || summary.savingsRate === undefined
              ? t('dashboard.savingsRateNone')
              : t('dashboard.savingsRate', {
                  rate: formatPercent(summary.savingsRate, i18n.language),
                })}
          </p>
        }
      >
        <CurrencyDisplay value={summary.savings} currency={currency} tone="auto" showSign />
      </SummaryCard>
    </ul>
  );
}
