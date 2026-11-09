'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const incomeRepository = require('../repositories/income.repository');
const accountRepository = require('../repositories/account.repository');
const categoryRepository = require('../repositories/category.repository');

/** The category must be a default or the user's own, and an INCOME category. */
async function assertIncomeCategory(userId, categoryId, client) {
  const category = await categoryRepository.findAccessibleById(categoryId, userId, client);
  if (!category) throw ApiError.notFound('Category not found');
  if (category.type !== 'income') throw ApiError.badRequest('Choose an income category');
}

async function list(userId, query = {}) {
  const { page: rawPage, limit: rawLimit, sortBy, sortOrder, ...filters } = query;
  const { page, limit, offset } = getPagination({ page: rawPage, limit: rawLimit });

  const [incomes, summary] = await Promise.all([
    incomeRepository.list(userId, filters, { sortBy, sortOrder, limit, offset }),
    incomeRepository.summary(userId, filters),
  ]);
  return {
    incomes,
    meta: {
      ...buildMeta({ total: summary.total, page, limit }),
      totalAmount: summary.totalAmount,
    },
  };
}

async function getById(userId, id) {
  const income = await incomeRepository.findById(id, userId);
  if (!income) throw ApiError.notFound('Income not found');
  return income;
}

/**
 * Record an income and add the amount to the account, in ONE transaction: either both
 * happen or neither. The account is locked first, so concurrent requests cannot lose an
 * update. Resolves { income, accounts } where accounts holds the new balances.
 */
async function create(userId, input) {
  return db.withTransaction(async (client) => {
    const [account] = await accountRepository.lockForUpdate([input.accountId], userId, client);
    if (!account) throw ApiError.notFound('Account not found');
    if (account.isArchived) throw ApiError.badRequest('This account is archived');
    await assertIncomeCategory(userId, input.categoryId, client);

    const id = await incomeRepository.create({ userId, ...input }, client);
    const updatedAccount = await accountRepository.credit(account.id, userId, input.amount, client);
    const income = await incomeRepository.findById(id, userId, client);
    return { income, accounts: [updatedAccount] };
  });
}

/**
 * Change an income. When the amount or the account changes, the old amount is taken back
 * from the old account and the new amount is added to the new account, in the same
 * transaction. Changing only the source, note, category or date touches no balance. An
 * income can be edited in an archived account, but not moved INTO one.
 */
async function update(userId, id, fields) {
  return db.withTransaction(async (client) => {
    const current = await incomeRepository.lockById(id, userId, client);
    if (!current) throw ApiError.notFound('Income not found');

    if (fields.categoryId !== undefined) {
      await assertIncomeCategory(userId, fields.categoryId, client);
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

      await incomeRepository.update(id, userId, fields, client);
      const debited = await accountRepository.debit(
        current.accountId,
        userId,
        current.amount,
        client,
      );
      const credited = await accountRepository.credit(newAccountId, userId, newAmount, client);
      touched.set(debited.id, debited);
      touched.set(credited.id, credited); // the later result wins when both are the same account
    } else {
      await incomeRepository.update(id, userId, fields, client);
    }

    const income = await incomeRepository.findById(id, userId, client);
    return { income, accounts: [...touched.values()] };
  });
}

/** Delete an income and take its amount back from the account, in one transaction. */
async function remove(userId, id) {
  return db.withTransaction(async (client) => {
    const current = await incomeRepository.lockById(id, userId, client);
    if (!current) throw ApiError.notFound('Income not found');

    await accountRepository.lockForUpdate([current.accountId], userId, client);
    const account = await accountRepository.debit(
      current.accountId,
      userId,
      current.amount,
      client,
    );
    await incomeRepository.deleteById(id, userId, client);
    return { accounts: [account] };
  });
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
