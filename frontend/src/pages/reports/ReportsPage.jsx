import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { ExportButtons } from '@/features/reports/ExportButtons';
import { MonthlyReport } from '@/features/reports/MonthlyReport';
import { useMonthlyReport, useYearlyReport } from '@/features/reports/useReports';
import { YearlyReport } from '@/features/reports/YearlyReport';
import { formatMonthYear, monthRange, yearRange } from '@/utils/formatDate';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const ID_PREFIX = 'reports';

export default function ReportsPage() {
  const { t, i18n } = useTranslation();

  const [tab, setTab] = useState('monthly');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
  // '' = the profile currency (the API decides).
  const [currency, setCurrency] = useState('');

  const isMonthly = tab === 'monthly';
  const { month, year } = period;

  const monthlyParams = useMemo(
    () => ({ year, month, ...(currency ? { currency } : {}) }),
    [year, month, currency],
  );
  const yearlyParams = useMemo(
    () => ({ year, ...(currency ? { currency } : {}) }),
    [year, currency],
  );

  // Only the open tab asks the API.
  const monthlyQuery = useMonthlyReport(monthlyParams, { enabled: isMonthly });
  const yearlyQuery = useYearlyReport(yearlyParams, { enabled: !isMonthly });
  const activeQuery = isMonthly ? monthlyQuery : yearlyQuery;
  const report = activeQuery.data;

  // The currencies of the user's accounts. The chosen one is always in the list.
  const currencies = useMemo(() => {
    const list = report?.meta?.availableCurrencies ?? [];
    return report && !list.includes(report.currency) ? [report.currency, ...list] : list;
  }, [report]);

  const now = new Date();
  const isCurrent = isMonthly
    ? month === now.getMonth() + 1 && year === now.getFullYear()
    : year === now.getFullYear();
  const label = isMonthly ? formatMonthYear(year, month, i18n.language) : String(year);
  const range = isMonthly ? monthRange(year, month) : yearRange(year);

  const shift = (delta) =>
    setPeriod((current) => {
      const index = isMonthly
        ? current.year * 12 + (current.month - 1) + delta
        : (current.year + delta) * 12 + (current.month - 1);
      const nextYear = Math.floor(index / 12);
      if (nextYear < MIN_YEAR || nextYear > MAX_YEAR) return current;
      return { month: (index % 12) + 1, year: nextYear };
    });
  const goToToday = () => setPeriod({ month: now.getMonth() + 1, year: now.getFullYear() });

  const tabs = [
    { id: 'monthly', label: t('reports.monthly') },
    { id: 'yearly', label: t('reports.yearly') },
  ];

  return (
    <>
      <PageHeader title={t('reports.title')} description={t('reports.subtitle')} />

      <Tabs
        idPrefix={ID_PREFIX}
        ariaLabel={t('reports.tabsLabel')}
        tabs={tabs}
        value={tab}
        onChange={setTab}
      />

      <div className="flex flex-wrap items-end gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={t(isMonthly ? 'reports.previousMonth' : 'reports.previousYear')}
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
          <h2
            aria-live="polite"
            className="min-w-36 text-center text-base font-semibold text-content"
          >
            {label}
          </h2>
          <Button
            variant="outline"
            size="sm"
            aria-label={t(isMonthly ? 'reports.nextMonth' : 'reports.nextYear')}
            onClick={() => shift(1)}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
          {isCurrent ? null : (
            <Button variant="ghost" size="sm" onClick={goToToday}>
              {t(isMonthly ? 'reports.thisMonth' : 'reports.thisYear')}
            </Button>
          )}
        </div>
        {currencies.length > 1 ? (
          <Select
            className="w-32"
            label={t('dashboard.currencyLabel')}
            value={report?.currency ?? currency}
            onChange={(event) => setCurrency(event.target.value)}
            options={currencies.map((code) => ({ value: code, label: code }))}
          />
        ) : null}
      </div>

      <div
        aria-busy={activeQuery.isPlaceholderData || undefined}
        className={activeQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}
      >
        <TabPanel idPrefix={ID_PREFIX} id="monthly" value={tab} className="pt-0">
          <MonthlyReport query={monthlyQuery} />
        </TabPanel>
        <TabPanel idPrefix={ID_PREFIX} id="yearly" value={tab} className="pt-0">
          <YearlyReport query={yearlyQuery} />
        </TabPanel>
      </div>

      <div className="mt-6">
        <ExportButtons from={range.from} to={range.to} periodLabel={label} />
      </div>
    </>
  );
}
