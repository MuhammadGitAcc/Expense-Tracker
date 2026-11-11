'use strict';

const db = require('../config/db');
const logger = require('../config/logger');
const { today } = require('../utils/dateHelpers');
const budgetRepository = require('../repositories/budget.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const emailService = require('./email.service');

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// 'warning' = the alert level was reached, 'exceeded' = over the limit, null = fine.
const rank = (level) => (level === 'exceeded' ? 2 : level === 'warning' ? 1 : 0);

/** What the user reads: the in-app notification (the email uses the same numbers). */
function buildNotification(budget, level) {
  const name = budget.category ? budget.category.name : 'Overall';
  const monthLabel = `${MONTH_NAMES[budget.month - 1]} ${budget.year}`;
  if (level === 'exceeded') {
    return {
      type: 'budget_exceeded',
      title: `Budget exceeded: ${name}`,
      message: `You went over your ${name} budget for ${monthLabel}: ${budget.spent} spent of ${budget.amount}.`,
    };
  }
  return {
    type: 'budget_warning',
    title: `Budget alert: ${name}`,
    message: `You have used ${budget.percentUsed}% of your ${name} budget for ${monthLabel} (${budget.spent} of ${budget.amount}).`,
  };
}

/** Email the user about one alert. Never throws and is never awaited by callers. */
async function sendAlertEmail(userId, budget, level) {
  try {
    const user = await userRepository.findById(userId);
    if (!user) return;
    await emailService.sendBudgetAlertEmail({
      user,
      level,
      budgetName: budget.category ? budget.category.name : 'Overall',
      monthLabel: `${MONTH_NAMES[budget.month - 1]} ${budget.year}`,
      spent: budget.spent,
      amount: budget.amount,
      percentUsed: budget.percentUsed,
    });
  } catch (err) {
    logger.error('Budget alert email failed', { userId, error: err.message });
  }
}

/**
 * Compare every budget of one month with the alert level already sent.
 *  - Level went UP (ok -> warning, warning -> exceeded): store it, create the notification
 *    (same transaction), then email the user.
 *  - Level went DOWN (an expense was deleted, the limit was raised): store it silently, so
 *    crossing the level again later alerts again.
 * Only one of several simultaneous callers can store a change, so nothing is sent twice.
 * `month` and `year` are numbers. Resolves the list of alerts that were sent.
 */
async function checkMonth(userId, { month, year }) {
  const budgets = await budgetRepository.list(userId, { month, year });
  if (budgets.length === 0) return [];
  const levels = await budgetRepository.getAlertLevels(userId, { month, year });

  const sent = [];
  for (const budget of budgets) {
    const stored = levels.get(budget.id) ?? null;
    const actual = budget.status === 'ok' ? null : budget.status;
    if (actual === stored) continue;

    if (rank(actual) < rank(stored)) {
      await budgetRepository.setAlertLevel(budget.id, userId, stored, actual);
      continue;
    }

    const won = await db.withTransaction(async (client) => {
      const claimed = await budgetRepository.setAlertLevel(
        budget.id,
        userId,
        stored,
        actual,
        client,
      );
      if (claimed) {
        await notificationService.notify(userId, buildNotification(budget, actual), client);
      }
      return claimed;
    });
    if (won) {
      sent.push({ budgetId: budget.id, level: actual });
      sendAlertEmail(userId, budget, actual); // not awaited: a slow mail server must not slow a request
    }
  }
  return sent;
}

/** Same as checkMonth, but never throws: used right after an expense or budget changes. */
async function checkUserMonth(userId, { month, year }) {
  try {
    return await checkMonth(userId, { month, year });
  } catch (err) {
    logger.error('Budget alert check failed', { userId, error: err.message });
    return [];
  }
}

/** Check the month of an expense date ("YYYY-MM-DD"). Never throws. */
async function checkAfterChange(userId, isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return [];
  return checkUserMonth(userId, {
    year: Number(isoDate.slice(0, 4)),
    month: Number(isoDate.slice(5, 7)),
  });
}

/**
 * The daily check: every user with a budget this month. It also catches what the request
 * triggers cannot see (expenses made by the recurring job) and resets levels after deletes.
 * Resolves { users, alerts }.
 */
async function checkAll(asOf = today()) {
  const [year, month] = asOf.split('-').map(Number);
  const userIds = await budgetRepository.listUserIdsWithBudgets({ month, year });
  let alerts = 0;
  for (const userId of userIds) {
    alerts += (await checkUserMonth(userId, { month, year })).length;
  }
  return { users: userIds.length, alerts };
}

module.exports = { checkMonth, checkUserMonth, checkAfterChange, checkAll };
