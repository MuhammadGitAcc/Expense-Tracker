'use strict';

const ApiError = require('../utils/ApiError');
const { today, addInterval } = require('../utils/dateHelpers');
const recurringRepository = require('../repositories/recurring.repository');
const accountRepository = require('../repositories/account.repository');
const categoryRepository = require('../repositories/category.repository');

// Dates are limited to 2000-2100 by the validator, so a daily schedule needs at most ~37,000 steps.
const MAX_STEPS = 40000;

/**
 * The first run of a schedule on or after `from`: the start date, then one interval after
 * another (monthly and yearly keep the start day when they can: Jan 31 -> Feb 28 -> Mar 31).
 * Dates that are already past are skipped, nothing is backfilled.
 */
function nextRunOnOrAfter(startDate, frequency, from) {
  let next = startDate;
  let steps = 0;
  while (next < from) {
    next = addInterval(next, frequency, startDate);
    steps += 1;
    if (steps > MAX_STEPS) throw ApiError.badRequest('This schedule is too long to calculate');
  }
  return next;
}

async function assertAccount(userId, accountId) {
  const account = await accountRepository.findById(accountId, userId);
  if (!account) throw ApiError.notFound('Account not found');
  if (account.isArchived) throw ApiError.badRequest('This account is archived');
}

/** The category must be a default or the user's own, and match the template's type. */
async function assertCategory(userId, categoryId, type) {
  const category = await categoryRepository.findAccessibleById(categoryId, userId);
  if (!category) throw ApiError.notFound('Category not found');
  if (category.type !== type) throw ApiError.badRequest(`Choose an ${type} category`);
}

async function list(userId, query = {}) {
  const recurringTransactions = await recurringRepository.list(userId, query);
  return { recurringTransactions };
}

async function getById(userId, id) {
  const recurring = await recurringRepository.findById(id, userId);
  if (!recurring) throw ApiError.notFound('Recurring transaction not found');
  return recurring;
}

async function create(userId, input) {
  const startDate = input.startDate ?? today();
  const endDate = input.endDate ?? null;

  await assertAccount(userId, input.accountId);
  await assertCategory(userId, input.categoryId, input.type);

  const nextRunDate = nextRunOnOrAfter(startDate, input.frequency, today());
  if (endDate && nextRunDate > endDate)
    throw ApiError.badRequest('This schedule has already ended');

  const id = await recurringRepository.create({
    userId,
    ...input,
    startDate,
    endDate,
    nextRunDate,
  });
  return recurringRepository.findById(id, userId);
}

/** Change amount, account, category, end date or note. The schedule itself stays the same. */
async function update(userId, id, fields) {
  const current = await recurringRepository.findById(id, userId);
  if (!current) throw ApiError.notFound('Recurring transaction not found');

  if (fields.accountId !== undefined && fields.accountId !== current.account.id) {
    await assertAccount(userId, fields.accountId);
  }
  if (fields.categoryId !== undefined) {
    await assertCategory(userId, fields.categoryId, current.type);
  }
  if (fields.endDate && fields.endDate < current.nextRunDate) {
    throw ApiError.badRequest('End date must not be before the next run date');
  }

  await recurringRepository.update(id, userId, fields);
  return recurringRepository.findById(id, userId);
}

/**
 * Pause stops the job from creating transactions. Resume keeps the next run date when it is
 * still today or later; otherwise it moves to the next valid date, so a long pause never
 * causes a burst of old transactions.
 */
async function setActive(userId, id, isActive) {
  const current = await recurringRepository.findById(id, userId);
  if (!current) throw ApiError.notFound('Recurring transaction not found');

  let nextRunDate = null;
  if (isActive && current.nextRunDate < today()) {
    nextRunDate = nextRunOnOrAfter(current.startDate, current.frequency, today());
    if (current.endDate && nextRunDate > current.endDate) {
      throw ApiError.badRequest('This schedule has already ended');
    }
  }

  await recurringRepository.setActive(id, userId, isActive, nextRunDate);
  return recurringRepository.findById(id, userId);
}

async function remove(userId, id) {
  const deleted = await recurringRepository.deleteById(id, userId);
  if (!deleted) throw ApiError.notFound('Recurring transaction not found');
}

module.exports = {
  nextRunOnOrAfter,
  list,
  getById,
  create,
  update,
  setActive,
  remove,
};
