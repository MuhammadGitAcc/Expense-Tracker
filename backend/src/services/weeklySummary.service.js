'use strict';

const db = require('../config/db');
const logger = require('../config/logger');
const { today, fromISODate } = require('../utils/dateHelpers');
const { addDays } = require('../utils/period');
const insights = require('../repositories/insights.repository');
const weeklySummaryRepository = require('../repositories/weeklySummary.repository');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const { percentChange } = require('./dashboard.service');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TOP_CATEGORIES = 3;

/**
 * The last COMPLETE week (Monday to Sunday) before `asOf`, and the week before that.
 * On a Monday that is the week that ended yesterday; on any other day it is the week that
 * ended on the Sunday before. All dates are "YYYY-MM-DD" strings (UTC calendar days).
 */
function lastFullWeek(asOf = today()) {
  const daysSinceMonday = (fromISODate(asOf).getUTCDay() + 6) % 7;
  const thisMonday = addDays(asOf, -daysSinceMonday);
  const from = addDays(thisMonday, -7);
  const to = addDays(thisMonday, -1);
  return { from, to, previous: { from: addDays(from, -7), to: addDays(from, -1) } };
}

/** "Nov 2 - Nov 8, 2026" */
function weekLabel({ from, to }) {
  const short = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
  return `${short(from)} - ${short(to)}, ${to.slice(0, 4)}`;
}

function describeChange(change) {
  if (change === null) return '';
  if (change === 0) return 'Spending is the same as the week before.';
  return `Spending is ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% on the week before.`;
}

/**
 * The numbers of one user's week, in the currency of the profile (amounts are never
 * converted). Resolves null when nothing was spent or earned that week.
 */
async function buildSummary(user, week) {
  const { currency } = user;
  const [current, previous, categories] = await Promise.all([
    insights.totals(user.id, currency, week.from, week.to),
    insights.totals(user.id, currency, week.previous.from, week.previous.to),
    insights.byCategory(user.id, currency, 'expense', week.from, week.to),
  ]);
  if (current.incomeCount + current.expenseCount === 0) return null;

  return {
    currency,
    label: weekLabel(week),
    income: current.income,
    expense: current.expense,
    net: current.savings,
    topCategories: categories.slice(0, TOP_CATEGORIES).map((row) => ({
      name: row.category.name,
      total: row.total,
      percent: row.percent,
    })),
    changeText: describeChange(percentChange(current.expense, previous.expense)),
  };
}

function buildNotification(summary) {
  const { currency } = summary;
  let message =
    `Income ${summary.income} ${currency}, expenses ${summary.expense} ${currency}, ` +
    `net ${summary.net} ${currency}.`;
  const [top] = summary.topCategories;
  if (top) message += ` Biggest category: ${top.name} (${top.total}).`;
  if (summary.changeText) message += ` ${summary.changeText}`;
  return { type: 'weekly_summary', title: `Your week: ${summary.label}`, message };
}

/**
 * Send one user's summary of `week`: the notification and the "already sent" mark are
 * stored in ONE transaction, then the email goes out. Resolves true when a summary was
 * sent, false when there was nothing to report or it was already sent.
 */
async function sendForUser(user, week) {
  const summary = await buildSummary(user, week);
  if (!summary) return false;

  const claimed = await db.withTransaction(async (client) => {
    const won = await weeklySummaryRepository.claim(user.id, week.from, client);
    if (won) await notificationService.notify(user.id, buildNotification(summary), client);
    return won;
  });
  if (!claimed) return false;

  try {
    await emailService.sendWeeklySummaryEmail({ user, summary });
  } catch (err) {
    logger.error('Weekly summary email failed', { userId: user.id, error: err.message });
  }
  return true;
}

/**
 * Send the summary of the last full week to every verified user who has not got it yet.
 * Safe to run any number of times. One failing user is logged and does not stop the others.
 * Resolves { week, users, sent, failed }.
 */
async function sendAll(asOf = today()) {
  const week = lastFullWeek(asOf);
  const users = await weeklySummaryRepository.listUsersWithoutSummary(week.from);
  const result = {
    week: { from: week.from, to: week.to },
    users: users.length,
    sent: 0,
    failed: 0,
  };

  for (const user of users) {
    try {
      if (await sendForUser(user, week)) result.sent += 1;
    } catch (err) {
      result.failed += 1;
      logger.error('Weekly summary failed', { userId: user.id, error: err.message });
    }
  }
  return result;
}

module.exports = { lastFullWeek, buildSummary, sendForUser, sendAll };
