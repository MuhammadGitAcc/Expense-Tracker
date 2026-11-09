'use strict';

const { today, monthRange, yearRange } = require('../utils/dateHelpers');
const insights = require('../repositories/insights.repository');
const { resolveCurrency } = require('./currency.service');
const { percentChange } = require('./dashboard.service');

const currentYearMonth = () => today().split('-').map(Number);

async function currencyMeta(userId) {
  return { availableCurrencies: await insights.listCurrencies(userId) };
}

/** One calendar month: totals, comparison with the month before, a day-by-day series and category breakdowns. */
async function monthly(user, query) {
  const [currentYear, currentMonth] = currentYearMonth();
  const year = query.year ?? currentYear;
  const month = query.month ?? currentMonth;
  const currency = resolveCurrency(user, query.currency);
  const { from, to } = monthRange(year, month);
  const [prevYear, prevMonth] = month === 1 ? [year - 1, 12] : [year, month - 1];
  const previousRange = monthRange(prevYear, prevMonth);

  const [totals, previous, daily, expenseByCategory, incomeByCategory, meta] = await Promise.all([
    insights.totals(user.id, currency, from, to),
    insights.totals(user.id, currency, previousRange.from, previousRange.to),
    insights.series(user.id, currency, from, to, 'day'),
    insights.byCategory(user.id, currency, 'expense', from, to),
    insights.byCategory(user.id, currency, 'income', from, to),
    currencyMeta(user.id),
  ]);

  return {
    data: {
      currency,
      year,
      month,
      from,
      to,
      totals,
      previous: {
        year: prevYear,
        month: prevMonth,
        income: previous.income,
        expense: previous.expense,
        savings: previous.savings,
      },
      change: {
        income: percentChange(totals.income, previous.income),
        expense: percentChange(totals.expense, previous.expense),
      },
      daily,
      expenseByCategory,
      incomeByCategory,
    },
    meta,
  };
}

/** One calendar year: totals, a month-by-month series (12 points) and category breakdowns. */
async function yearly(user, query) {
  const year = query.year ?? currentYearMonth()[0];
  const currency = resolveCurrency(user, query.currency);
  const { from, to } = yearRange(year);
  const previousRange = yearRange(year - 1);

  const [totals, previous, monthlySeries, expenseByCategory, incomeByCategory, meta] =
    await Promise.all([
      insights.totals(user.id, currency, from, to),
      insights.totals(user.id, currency, previousRange.from, previousRange.to),
      insights.series(user.id, currency, from, to, 'month'),
      insights.byCategory(user.id, currency, 'expense', from, to),
      insights.byCategory(user.id, currency, 'income', from, to),
      currencyMeta(user.id),
    ]);

  return {
    data: {
      currency,
      year,
      from,
      to,
      totals,
      previous: {
        year: year - 1,
        income: previous.income,
        expense: previous.expense,
        savings: previous.savings,
      },
      change: {
        income: percentChange(totals.income, previous.income),
        expense: percentChange(totals.expense, previous.expense),
      },
      monthly: monthlySeries,
      expenseByCategory,
      incomeByCategory,
    },
    meta,
  };
}

/** Expense (or income) per category for any date range, biggest first, with percent shares. */
async function byCategory(user, query) {
  const currency = resolveCurrency(user, query.currency);
  const { from, to, type } = query;

  const [categories, totals, meta] = await Promise.all([
    insights.byCategory(user.id, currency, type, from, to),
    insights.totals(user.id, currency, from, to),
    currencyMeta(user.id),
  ]);

  return {
    data: { currency, type, from, to, total: totals[type], categories },
    meta,
  };
}

/** Income and expense per account for any date range. */
async function byAccount(user, query) {
  const currency = resolveCurrency(user, query.currency);
  const { from, to } = query;

  const [accounts, totals, meta] = await Promise.all([
    insights.byAccount(user.id, currency, from, to),
    insights.totals(user.id, currency, from, to),
    currencyMeta(user.id),
  ]);

  return {
    data: {
      currency,
      from,
      to,
      totals: { income: totals.income, expense: totals.expense, savings: totals.savings },
      accounts,
    },
    meta,
  };
}

module.exports = { monthly, yearly, byCategory, byAccount };
