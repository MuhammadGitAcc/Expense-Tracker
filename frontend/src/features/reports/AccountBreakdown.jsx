import { useTranslation } from 'react-i18next';
import { AccountTypeIcon } from '@/components/common/AccountTypeIcon';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAccountReport } from '@/features/reports/useReports';

/**
 * Income, expenses and net per account for a date range, in ONE currency (the accounts of that
 * currency only). It loads its own data: from and to are "YYYY-MM-DD", currency is 3 letters.
 */
export function AccountBreakdown({ from, to, currency }) {
  const { t } = useTranslation();
  const query = useAccountReport({ from, to, currency });
  const report = query.data;

  const renderBody = () => {
    if (query.isError) {
      return (
        <div className="flex flex-wrap items-center gap-3 text-sm text-content-muted">
          <span>{t('errors.loadFailed')}</span>
          <Button size="sm" variant="outline" onClick={() => query.refetch()}>
            {t('common.tryAgain')}
          </Button>
        </div>
      );
    }
    if (query.isLoading || !report) {
      return (
        <div aria-hidden="true" className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    if (report.accounts.length === 0) {
      return <p className="text-sm text-content-muted">{t('reports.noAccounts', { currency })}</p>;
    }
    return (
      <ul className="divide-y divide-line">
        {report.accounts.map((item) => (
          <li key={item.account.id} className="py-3">
            <div className="flex items-center gap-3">
              <AccountTypeIcon type={item.account.type} color={item.account.color} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-content">
                {item.account.name}
              </p>
              {item.account.isArchived ? <Badge>{t('accounts.archived')}</Badge> : null}
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-content-muted">{t('dashboard.income')}</dt>
                <dd>
                  <CurrencyDisplay value={item.income} currency={currency} tone="income" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">{t('dashboard.expenses')}</dt>
                <dd>
                  <CurrencyDisplay value={item.expense} currency={currency} tone="expense" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-content-muted">{t('reports.net')}</dt>
                <dd>
                  <CurrencyDisplay value={item.net} currency={currency} tone="auto" showSign />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Card>
      <CardHeader
        title={t('reports.byAccount')}
        description={t('reports.byAccountHint', { currency })}
      />
      <div
        aria-busy={query.isPlaceholderData || undefined}
        className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}
      >
        {renderBody()}
      </div>
    </Card>
  );
}
