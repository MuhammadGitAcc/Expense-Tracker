'use strict';

const ApiError = require('../utils/ApiError');
const { today } = require('../utils/dateHelpers');
const budgetRepository = require('../repositories/budget.repository');
const categoryRepository = require('../repositories/category.repository');
const budgetAlertService = require('./budgetAlert.service');

/** The category must be a default or the user's own, and an EXPENSE category. */
async function assertExpenseCategory(userId, categoryId) {
  const category = await categoryRepository.findAccessibleById(categoryId, userId);
  if (!category) throw ApiError.notFound('Category not found');
  if (category.type !== 'expense') throw ApiError.badRequest('Choose an expense category');
}

/** Budgets of one month (the current month when month or year is left out). */
async function list(userId, query = {}) {
  const [currentYear, currentMonth] = today().split('-').map(Number);
  const month = query.month ?? currentMonth;
  const year = query.year ?? currentYear;
  const budgets = await budgetRepository.list(userId, { month, year });
  return { budgets, month, year };
}

async function getById(userId, id) {
  const budget = await budgetRepository.findById(id, userId);
  if (!budget) throw ApiError.notFound('Budget not found');
  return budget;
}

async function create(userId, input) {
  if (input.categoryId) await assertExpenseCategory(userId, input.categoryId);

  let id;
  try {
    id = await budgetRepository.create({ userId, ...input });
  } catch (err) {
    if (err.code === '23505') {
      throw ApiError.conflict(
        input.categoryId
          ? 'A budget for this category and month already exists'
          : 'An overall budget for this month already exists',
      );
    }
    throw err;
  }
  const budget = await budgetRepository.findById(id, userId);
  await budgetAlertService.checkUserMonth(userId, budget); // already over the limit? tell the user
  return budget;
}

/** Change the limit and/or the alert level. Spent is recalculated on every read. */
async function update(userId, id, fields) {
  const found = await budgetRepository.update(id, userId, fields);
  if (!found) throw ApiError.notFound('Budget not found');
  const budget = await budgetRepository.findById(id, userId);
  await budgetAlertService.checkUserMonth(userId, budget);
  return budget;
}

async function remove(userId, id) {
  const deleted = await budgetRepository.deleteById(id, userId);
  if (!deleted) throw ApiError.notFound('Budget not found');
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
