import { axiosClient } from '@/api/axiosClient';

// Every function returns response.data: the body { success, message, data, meta }.
// Amounts are never converted: every answer is for ONE currency (data.currency; the optional
// "currency" param, else the profile currency). meta.availableCurrencies lists the choices.

/** params: { year?, month?, currency? } (the current month by default). */
export const getMonthlyReport = (params) =>
  axiosClient.get('/reports/monthly', { params }).then((response) => response.data);

/** params: { year?, currency? } (the current year by default). */
export const getYearlyReport = (params) =>
  axiosClient.get('/reports/yearly', { params }).then((response) => response.data);

/**
 * params: { from, to ("YYYY-MM-DD", both needed), type?: 'expense' | 'income', currency? }.
 * Answers data { currency, type, from, to, total, categories: [{ category { id, name, icon,
 * color }, total, count, percent }] }, the biggest first. percent is a number with one decimal.
 */
export const getReportByCategory = (params) =>
  axiosClient.get('/reports/by-category', { params }).then((response) => response.data);

/** params: { from, to, currency? }. Answers data { totals, accounts: [{ account, income, expense, net }] }. */
export const getReportByAccount = (params) =>
  axiosClient.get('/reports/by-account', { params }).then((response) => response.data);
