import { axiosClient } from '@/api/axiosClient';

// Every function returns response.data: the body { success, message, data, meta }.
// Amounts are never converted: every answer is for ONE currency (data.currency).

/**
 * params: { period?: 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom',
 *           from?, to? (both needed for custom, "YYYY-MM-DD"), currency? (3 letters, default =
 *           the profile currency) }.
 * Answers data { currency, period { key, from, to }, balance { total, accountCount }, income,
 * expense, savings, savingsRate, transactionCount, previous { from, to, income, expense,
 * savings }, change { income, expense }, recentTransactions } and meta { availableCurrencies }.
 */
export const getDashboardSummary = (params) =>
  axiosClient.get('/dashboard/summary', { params }).then((response) => response.data);

/**
 * params: the same as the summary, plus granularity?: 'day' | 'month'.
 * Answers data { currency, period, granularity, series: [{ period, income, expense, net }] }
 * and meta { availableCurrencies }.
 */
export const getDashboardTrends = (params) =>
  axiosClient.get('/dashboard/trends', { params }).then((response) => response.data);
