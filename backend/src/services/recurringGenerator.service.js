'use strict';

const db = require('../config/db');
const logger = require('../config/logger');
const { today, addInterval } = require('../utils/dateHelpers');
const recurringRepository = require('../repositories/recurring.repository');
const accountRepository = require('../repositories/account.repository');
const expenseRepository = require('../repositories/expense.repository');
const incomeRepository = require('../repositories/income.repository');
const notificationService = require('./notification.service');

// Safety net: one template never creates more than this many transactions in one run.
// Whatever is still due is picked up by the next run.
const MAX_PER_TEMPLATE_PER_RUN = 100;

/** Notification text for a template that just created `dates.length` transactions. */
function buildCreatedNotification(template, dates) {
  const isExpense = template.type === 'expense';
  const money = `${template.amount} ${template.currency}`;
  const direction = isExpense ? 'taken from' : 'added to';
  const label = template.categoryName;

  if (dates.length === 1) {
    return {
      title: `Recurring ${template.type} added`,
      message: `"${label}": ${money} was ${direction} ${template.accountName} on ${dates[0]}.`,
    };
  }
  return {
    title: `Recurring ${template.type}s added`,
    message:
      `"${label}": ${dates.length} payments of ${money} (${dates[0]} to ${dates[dates.length - 1]}) ` +
      `were ${direction} ${template.accountName}.`,
  };
}

/**
 * Handle ONE due template inside ONE transaction: every missed occurrence up to `asOf` is
 * created (dated with its scheduled day), the balance is changed, the next run date moves
 * forward and the user gets a notification. All of it happens or none of it.
 * Resolves { created, paused, skipped }.
 */
async function processTemplate(id, asOf) {
  return db.withTransaction(async (client) => {
    const template = await recurringRepository.lockDue(id, asOf, client);
    if (!template) return { created: 0, paused: false, skipped: true };

    const [account] = await accountRepository.lockForUpdate(
      [template.accountId],
      template.userId,
      client,
    );

    // An archived account takes no new transactions. Pause the template (so it is not retried
    // every day and cannot create a burst later) and tell the user.
    if (!account || account.isArchived) {
      await recurringRepository.pause(template.id, client);
      await notificationService.notify(
        template.userId,
        {
          type: 'system',
          title: 'Recurring transaction paused',
          message:
            `"${template.categoryName}" was paused because the account "${template.accountName}" ` +
            'is archived. Choose another account and resume it.',
        },
        client,
      );
      return { created: 0, paused: true, skipped: false };
    }

    const createdDates = [];
    let next = template.nextRunDate;
    while (
      next <= asOf &&
      (!template.endDate || next <= template.endDate) &&
      createdDates.length < MAX_PER_TEMPLATE_PER_RUN
    ) {
      if (template.type === 'expense') {
        await expenseRepository.create(
          {
            userId: template.userId,
            accountId: template.accountId,
            categoryId: template.categoryId,
            amount: template.amount,
            date: next,
            note: template.note,
            paymentMethod: 'cash',
            recurringId: template.id,
          },
          client,
        );
        await accountRepository.debit(template.accountId, template.userId, template.amount, client);
      } else {
        await incomeRepository.create(
          {
            userId: template.userId,
            accountId: template.accountId,
            categoryId: template.categoryId,
            amount: template.amount,
            date: next,
            note: template.note,
            recurringId: template.id,
          },
          client,
        );
        await accountRepository.credit(
          template.accountId,
          template.userId,
          template.amount,
          client,
        );
      }
      createdDates.push(next);
      next = addInterval(next, template.frequency, template.startDate);
    }

    // Past its end date: the schedule is finished.
    const finished = Boolean(template.endDate) && next > template.endDate;
    await recurringRepository.advance(template.id, next, !finished, client);

    await notificationService.notify(
      template.userId,
      {
        type: 'recurring_created',
        ...buildCreatedNotification(template, createdDates),
      },
      client,
    );
    return { created: createdDates.length, paused: false, skipped: false };
  });
}

/**
 * Create the transactions of every recurring template that is due on or before `asOf`
 * (a "YYYY-MM-DD" date, today by default). Safe to run any number of times: a template
 * advances in the same transaction that creates its transactions. One failing template is
 * logged and does not stop the others.
 * Resolves { due, created, paused, failed }.
 */
async function generateDue(asOf = today()) {
  const ids = await recurringRepository.findDueIds(asOf);
  const summary = { due: ids.length, created: 0, paused: 0, failed: 0 };

  for (const id of ids) {
    try {
      // Templates are handled one after another on purpose: each has its own transaction.
      const result = await processTemplate(id, asOf);
      summary.created += result.created;
      if (result.paused) summary.paused += 1;
    } catch (err) {
      summary.failed += 1;
      logger.error('Recurring template failed', { recurringId: id, error: err.message });
    }
  }
  return summary;
}

module.exports = { generateDue, processTemplate };
