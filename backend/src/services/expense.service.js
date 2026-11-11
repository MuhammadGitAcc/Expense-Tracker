'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const expenseRepository = require('../repositories/expense.repository');
const accountRepository = require('../repositories/account.repository');
const categoryRepository = require('../repositories/category.repository');
const uploadService = require('./upload.service');
const budgetAlertService = require('./budgetAlert.service');

/** The category must be a default or the user's own, and an EXPENSE category. */
async function assertExpenseCategory(userId, categoryId, client) {
  const category = await categoryRepository.findAccessibleById(categoryId, userId, client);
  if (!category) throw ApiError.notFound('Category not found');
  if (category.type !== 'expense') throw ApiError.badRequest('Choose an expense category');
}

async function list(userId, query = {}) {
  const { page: rawPage, limit: rawLimit, sortBy, sortOrder, ...filters } = query;
  const { page, limit, offset } = getPagination({ page: rawPage, limit: rawLimit });

  const [expenses, summary] = await Promise.all([
    expenseRepository.list(userId, filters, { sortBy, sortOrder, limit, offset }),
    expenseRepository.summary(userId, filters),
  ]);
  return {
    expenses,
    meta: {
      ...buildMeta({ total: summary.total, page, limit }),
      totalAmount: summary.totalAmount,
    },
  };
}

async function getById(userId, id) {
  const expense = await expenseRepository.findById(id, userId);
  if (!expense) throw ApiError.notFound('Expense not found');
  return expense;
}

/**
 * Record an expense and take the amount from the account, in ONE transaction: either both
 * happen or neither. The account is locked first, so concurrent requests cannot lose an
 * update. Resolves { expense, accounts } where accounts holds the new balances.
 */
async function create(userId, input) {
  return db.withTransaction(async (client) => {
    const [account] = await accountRepository.lockForUpdate([input.accountId], userId, client);
    if (!account) throw ApiError.notFound('Account not found');
    if (account.isArchived) throw ApiError.badRequest('This account is archived');
    await assertExpenseCategory(userId, input.categoryId, client);

    const id = await expenseRepository.create({ userId, ...input }, client);
    const updatedAccount = await accountRepository.debit(account.id, userId, input.amount, client);
    const expense = await expenseRepository.findById(id, userId, client);
    return { expense, accounts: [updatedAccount] };
  });
}

/**
 * Change an expense. When the amount or the account changes, the old amount goes back to
 * the old account and the new amount is taken from the new account, in the same
 * transaction. Changing only the note, category, date, tags or payment method touches no
 * balance. An expense can be edited in an archived account, but not moved INTO one.
 */
async function update(userId, id, fields) {
  return db.withTransaction(async (client) => {
    const current = await expenseRepository.lockById(id, userId, client);
    if (!current) throw ApiError.notFound('Expense not found');

    if (fields.categoryId !== undefined) {
      await assertExpenseCategory(userId, fields.categoryId, client);
    }

    const balanceChanges = fields.accountId !== undefined || fields.amount !== undefined;
    const touched = new Map();

    if (balanceChanges) {
      const newAccountId = fields.accountId ?? current.accountId;
      const newAmount = fields.amount ?? current.amount;

      const locked = await accountRepository.lockForUpdate(
        [...new Set([current.accountId, newAccountId])],
        userId,
        client,
      );
      const target = locked.find((account) => account.id === newAccountId);
      if (!target) throw ApiError.notFound('Account not found');
      if (newAccountId !== current.accountId && target.isArchived) {
        throw ApiError.badRequest('This account is archived');
      }

      await expenseRepository.update(id, userId, fields, client);
      const credited = await accountRepository.credit(
        current.accountId,
        userId,
        current.amount,
        client,
      );
      const debited = await accountRepository.debit(newAccountId, userId, newAmount, client);
      touched.set(credited.id, credited);
      touched.set(debited.id, debited); // the later result wins when both are the same account
    } else {
      await expenseRepository.update(id, userId, fields, client);
    }

    const expense = await expenseRepository.findById(id, userId, client);
    return { expense, accounts: [...touched.values()] };
  });
}

/**
 * Delete an expense and give its amount back to the account, in one transaction. The
 * receipt file is deleted after the commit, when the database rows are really gone.
 */
async function remove(userId, id) {
  const result = await db.withTransaction(async (client) => {
    const current = await expenseRepository.lockById(id, userId, client);
    if (!current) throw ApiError.notFound('Expense not found');

    await accountRepository.lockForUpdate([current.accountId], userId, client);
    const account = await accountRepository.credit(
      current.accountId,
      userId,
      current.amount,
      client,
    );
    await expenseRepository.deleteById(id, userId, client);
    return { accounts: [account], receiptFile: current.receiptFile };
  });

  await uploadService.deleteReceiptFile(result.receiptFile);
  return { accounts: result.accounts };
}

/** Attach (or replace) the receipt of an expense. Resolves the updated expense. */
async function attachReceipt(userId, id, file) {
  if (!file) throw ApiError.badRequest('Choose a file to upload (form field name: receipt)');
  await getById(userId, id); // 404 before any file is written

  const filename = await uploadService.saveReceipt(userId, file);
  try {
    const previous = await expenseRepository.getReceiptFile(id, userId);
    const updated = await expenseRepository.setReceiptFile(id, userId, filename);
    if (!updated) throw ApiError.notFound('Expense not found');
    await uploadService.deleteReceiptFile(previous);
  } catch (err) {
    await uploadService.deleteReceiptFile(filename); // no orphan file when saving fails
    throw err;
  }
  return getById(userId, id);
}

async function removeReceipt(userId, id) {
  const file = await expenseRepository.getReceiptFile(id, userId);
  if (file === undefined) throw ApiError.notFound('Expense not found');
  if (file === null) throw ApiError.notFound('This expense has no receipt');

  await expenseRepository.setReceiptFile(id, userId, null);
  await uploadService.deleteReceiptFile(file);
  return getById(userId, id);
}

/** Absolute path of the receipt file of the user's own expense (for the download route). */
async function getReceiptPath(userId, id) {
  const file = await expenseRepository.getReceiptFile(id, userId);
  if (file === undefined) throw ApiError.notFound('Expense not found');
  const fullPath = await uploadService.resolveReceiptFile(file);
  if (!fullPath) throw ApiError.notFound('This expense has no receipt');
  return fullPath;
}

/**
 * After an expense is added or changed, look at the budgets of its month (alerts, see
 * budgetAlert.service). This never throws, so the expense answer is never affected.
 */
const withBudgetCheck =
  (action) =>
  async (userId, ...args) => {
    const result = await action(userId, ...args);
    await budgetAlertService.checkAfterChange(userId, result.expense.date);
    return result;
  };

module.exports = {
  list,
  getById,
  create: withBudgetCheck(create),
  update: withBudgetCheck(update),
  remove,
  attachReceipt,
  removeReceipt,
  getReceiptPath,
};
