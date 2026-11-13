import { ReportBody } from '@/features/reports/ReportBody';

/** The report of one year. query: the result of useYearlyReport. The chart shows months. */
export function YearlyReport({ query }) {
  return <ReportBody query={query} seriesKey="monthly" granularity="month" />;
}
