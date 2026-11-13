import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getDashboardSummary, getDashboardTrends } from '@/api/dashboard.api';

// Every key starts with 'dashboard': invalidateMoneyData (app/invalidate.js) refreshes them after
// any expense, income or budget change.
export const dashboardKeys = {
  all: ['dashboard'],
  summary: (params) => ['dashboard', 'summary', params],
  trends: (params) => ['dashboard', 'trends', params],
};

// Defined outside the hooks so the result keeps the same identity between renders.
const selectResult = (body) => ({ ...body.data, meta: body.meta });

/**
 * The dashboard cards. params: { period, from?, to?, currency? } (see api/dashboard.api.js).
 * data = the summary fields plus meta (meta.availableCurrencies). The previous numbers stay on
 * screen while a new period or currency loads (isPlaceholderData is true then).
 * enabled = false is used while a custom range is not complete.
 */
export function useDashboardSummary(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: dashboardKeys.summary(params),
    queryFn: () => getDashboardSummary(params),
    select: selectResult,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** The income and expense series for the charts (used from step 10.2). Same params + granularity. */
export function useDashboardTrends(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: dashboardKeys.trends(params),
    queryFn: () => getDashboardTrends(params),
    select: selectResult,
    placeholderData: keepPreviousData,
    enabled,
  });
}
