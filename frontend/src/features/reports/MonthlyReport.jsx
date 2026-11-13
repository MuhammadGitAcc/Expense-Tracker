import { ReportBody } from '@/features/reports/ReportBody';

/** The report of one month. query: the result of useMonthlyReport. The chart shows days. */
export function MonthlyReport({ query }) {
  return <ReportBody query={query} seriesKey="daily" granularity="day" />;
}
