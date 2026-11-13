import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getMonthlyReport,
  getReportByAccount,
  getReportByCategory,
  getYearlyReport,
} from '@/api/reports.api';

// Every key starts with 'reports': invalidateMoneyData (app/invalidate.js) refreshes them after
// any expense, income or budget change.
export const reportKeys = {
  all: ['reports'],
  monthly: (params) => ['reports', 'monthly', params],
  yearly: (params) => ['reports', 'yearly', params],
  byCategory: (params) => ['reports', 'by-category', params],
  byAccount: (params) => ['reports', 'by-account', params],
};

// Defined outside the hooks so the result keeps the same identity between renders.
const selectResult = (body) => ({ ...body.data, meta: body.meta });

function useReport(key, queryFn, params, enabled) {
  return useQuery({
    queryKey: key(params),
    queryFn: () => queryFn(params),
    select: selectResult,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Monthly report. params: { year?, month?, currency? }. data = the report fields plus meta. */
export const useMonthlyReport = (params, { enabled = true } = {}) =>
  useReport(reportKeys.monthly, getMonthlyReport, params, enabled);

/** Yearly report. params: { year?, currency? }. */
export const useYearlyReport = (params, { enabled = true } = {}) =>
  useReport(reportKeys.yearly, getYearlyReport, params, enabled);

/** Totals per category. params: { from, to, type?, currency? } (from and to are required). */
export const useCategoryReport = (params, { enabled = true } = {}) =>
  useReport(reportKeys.byCategory, getReportByCategory, params, enabled);

/** Income and expense per account. params: { from, to, currency? }. */
export const useAccountReport = (params, { enabled = true } = {}) =>
  useReport(reportKeys.byAccount, getReportByAccount, params, enabled);
