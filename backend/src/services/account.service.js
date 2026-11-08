'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const accountRepository = require('../repositories/account.repository');

const NAME_TAKEN = 'You already have an account with this name';

async function list(userId, { includeArchived = false } = {}) {
  const [accounts, totalsByCurrency] = await Promise.all([
    accountRepository.list(userId, { includeArchived }),
    accountRepository.totalsByCurrency(userId, { includeArchived }),
  ]);
  return { accounts, totalsByCurrency };
}

/** The user's own account, otherwise 404 (never reveals other users' accounts). */
async function getById(userId, id) {
  const account = await accountRepository.findById(id, userId);
  if (!account) throw ApiError.notFound('Account not found');
  return account;
}

/** `user` is req.user: its profile currency is the default currency of a new account. */
async function create(user, { name, type, balance, currency, color }) {
  if (await accountRepository.nameExists({ userId: user.id, name })) {
    throw ApiError.conflict(NAME_TAKEN);
  }
  try {
    return await accountRepository.create({
      userId: user.id,
      name,
      type,
      balance,
      currency: currency || user.currency,
      color,
    });
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict(NAME_TAKEN);
    throw err;
  }
}

async function update(userId, id, fields) {
  await getById(userId, id);

  if (
    fields.name !== undefined &&
    (await accountRepository.nameExists({ userId, name: fields.name, excludeId: id }))
  ) {
    throw ApiError.conflict(NAME_TAKEN);
  }

  try {
    const updated = await accountRepository.update(id, userId, fields);
    if (!updated) throw ApiError.notFound('Account not found');
    return updated;
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict(NAME_TAKEN);
    throw err;
  }
}

async function setArchived(userId, id, isArchived) {
  const account = await getById(userId, id);
  if (account.isArchived === isArchived) return account;
  return accountRepository.setArchived(id, userId, isArchived);
}

/** Refuses to delete an account that still has records (the safety check). */
async function remove(userId, id) {
  await getById(userId, id);

  const used = await accountRepository.countUsage(id);
  if (used > 0) {
    throw ApiError.conflict(
      `This account has ${used} record(s) (transactions, recurring items or transfers). Archive it instead`,
    );
  }
  await accountRepository.deleteOwned(id, userId);
}

/**
 * Move money between two of the user's accounts, all in ONE database transaction: either
 * both balances change and the transfer is recorded, or nothing happens. Both accounts are
 * locked first (in id order), so concurrent transfers can never lose an update.
 */
async function transfer(userId, { fromAccountId, toAccountId, amount, date, note }) {
  return db.withTransaction(async (client) => {
    const locked = await accountRepository.lockForUpdate(
      [fromAccountId, toAccountId],
      userId,
      client,
    );
    const from = locked.find((account) => account.id === fromAccountId);
    const to = locked.find((account) => account.id === toAccountId);

    if (!from || !to) throw ApiError.notFound('Account not found');
    if (from.isArchived || to.isArchived) {
      throw ApiError.badRequest('Archived accounts cannot be used for transfers');
    }
    if (from.currency !== to.currency) {
      throw ApiError.badRequest(
        'Transfers are only possible between accounts with the same currency',
      );
    }

    const updatedFrom = await accountRepository.debit(from.id, userId, amount, client);
    const updatedTo = await accountRepository.credit(to.id, userId, amount, client);
    const created = await accountRepository.createTransfer(
      { userId, fromAccountId, toAccountId, amount, date, note },
      client,
    );

    return { transfer: created, accounts: { from: updatedFrom, to: updatedTo } };
  });
}

async function listTransfers(userId, query = {}) {
  const { page, limit, offset } = getPagination(query);
  const [transfers, total] = await Promise.all([
    accountRepository.listTransfers(userId, { limit, offset }),
    accountRepository.countTransfers(userId),
  ]);
  return { transfers, meta: buildMeta({ total, page, limit }) };
}

module.exports = {
  list,
  getById,
  create,
  update,
  setArchived,
  remove,
  transfer,
  listTransfers,
};
