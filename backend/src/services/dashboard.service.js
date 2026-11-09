'use strict';

const ApiError = require('../utils/ApiError');
const { resolvePeriod, daysBetween } = require('../utils/period');
const insights = require('../repositories/insights.repository');
const { resolveCurrency } = require('./currency.service');

const RECENT_LIMIT = 5;
const MAX_DAILY_POINTS = 366;

/** Change from `previous` to `current` in percent (one decimal), null when previous is 0. */
function percentChange(current, previous) {
  const base = Number(previous);
  if (!base) return null;
  return Math.round(((Number(current) - base) / base) * 1000) / 10;
}

/**
 * Dashboard cards for one period and one currency: the balance of the active accounts,
 * income, expense, savings, the same numbers for the period before, and the latest
 * transactions. Returns { data, meta }.
 */
async function summary(user, query) {
  const currency = resolveCurrency(user, query.currency);
  const period = resolvePeriod(query);

  const [current, previous, balance, recentTransactions, availableCurrencies] = await Promise.all([
    insights.totals(user.id, currency, period.from, period.to),
    insights.totals(user.id, currency, period.previous.from, period.previous.to),
    insights.balanceTotal(user.id, currency),
    insights.recentTransactions(user.id, currency, RECENT_LIMIT),
    insights.listCurrencies(user.id),
  ]);

  return {
    data: {
      currency,
      period: { key: period.key, from: period.from, to: period.to },
      balance,
      income: current.income,
      expense: current.expense,
      savings: current.savings,
      savingsRate: current.savingsRate,
      transactionCount: current.incomeCount + current.expenseCount,
      previous: {
        from: period.previous.from,
        to: period.previous.to,
        income: previous.income,
        expense: previous.expense,
        savings: previous.savings,
      },
      change: {
        income: percentChange(current.income, previous.income),
        expense: percentChange(current.expense, previous.expense),
      },
      recentTransactions,
    },
    meta: { availableCurrencies },
  };
}

/**
 * Income and expense per day or per month for a chart. The default is days for up to 62
 * days and months for longer periods. Empty days/months are included with "0.00".
 */
async function trends(user, query) {
  const currency = resolveCurrency(user, query.currency);
  const period = resolvePeriod(query);
  const length = daysBetween(period.from, period.to);
  const granularity = query.granularity ?? (length <= 62 ? 'day' : 'month');

  if (granularity === 'day' && length > MAX_DAILY_POINTS) {
    throw ApiError.badRequest(
      `Daily trends cover at most ${MAX_DAILY_POINTS} days. Use granularity=month.`,
    );
  }

  const [series, availableCurrencies] = await Promise.all([
    insights.series(user.id, currency, period.from, period.to, granularity),
    insights.listCurrencies(user.id),
  ]);

  return {
    data: {
      currency,
      period: { key: period.key, from: period.from, to: period.to },
      granularity,
      series,
    },
    meta: { availableCurrencies },
  };
}

module.exports = { summary, trends, percentChange };
