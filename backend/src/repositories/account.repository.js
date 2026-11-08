'use strict';

const db = require('../config/db');

/**
 * SQL for the accounts and transfers tables. Every query filters by user_id: a client id
 * is never trusted on its own. Money comes back as strings ("100.50") on purpose.
 * The last argument `client` is optional: pass a transaction client to join a transaction.
 */

const COLUMNS = 'id, name, type, balance, currency, color, is_archived, created_at';
const TRANSFER_COLUMNS = 'id, from_account_id, to_account_id, amount, date, note, created_at';

const mapAccount = (row) =>
  row && {
    id: row.id,
    name: row.name,
    type: row.type,
    balance: row.balance,
    currency: row.currency,
    color: row.color,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };

const mapTransfer = (row) =>
  row && {
    id: row.id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amount: row.amount,
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
  };

async function list(userId, { includeArchived = false } = {}, client = db) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM accounts
     WHERE user_id = $1 ${includeArchived ? '' : 'AND NOT is_archived'}
     ORDER BY is_archived, LOWER(name)`,
    [userId],
  );
  return rows.map(mapAccount);
}

/** Sum of balances per currency, as exact strings: { USD: '150.50' }. Summed in SQL. */
async function totalsByCurrency(userId, { includeArchived = false } = {}, client = db) {
  const { rows } = await client.query(
    `SELECT currency, SUM(balance)::text AS total FROM accounts
     WHERE user_id = $1 ${includeArchived ? '' : 'AND NOT is_archived'}
     GROUP BY currency ORDER BY currency`,
    [userId],
  );
  return Object.fromEntries(rows.map((row) => [row.currency, row.total]));
}

/** The user's OWN account, or null (another user's account looks like "not found"). */
async function findById(id, userId, client = db) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM accounts WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return mapAccount(rows[0]) || null;
}

/** True when the user already has an account with this name (ignoring case). */
async function nameExists({ userId, name, excludeId = null }, client = db) {
  const { rows } = await client.query(
    `SELECT 1 FROM accounts
     WHERE user_id = $1 AND LOWER(name) = LOWER($2)
       AND ($3::uuid IS NULL OR id <> $3::uuid)
     LIMIT 1`,
    [userId, name, excludeId],
  );
  return rows.length > 0;
}

async function create({ userId, name, type, balance, currency, color }, client = db) {
  const { rows } = await client.query(
    `INSERT INTO accounts (user_id, name, type, balance, currency, color)
     VALUES ($1, $2, $3, $4::numeric, $5, $6)
     RETURNING ${COLUMNS}`,
    [userId, name, type, balance, currency, color],
  );
  return mapAccount(rows[0]);
}

// API field name -> column. balance and currency are never updated here.
const UPDATE_COLUMNS = { name: 'name', type: 'type', color: 'color' };

async function update(id, userId, fields, client = db) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(UPDATE_COLUMNS)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) return findById(id, userId, client);

  values.push(id, userId);
  const { rows } = await client.query(
    `UPDATE accounts SET ${sets.join(', ')}
     WHERE id = $${values.length - 1} AND user_id = $${values.length}
     RETURNING ${COLUMNS}`,
    values,
  );
  return mapAccount(rows[0]) || null;
}

async function setArchived(id, userId, isArchived, client = db) {
  const { rows } = await client.query(
    `UPDATE accounts SET is_archived = $3 WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`,
    [id, userId, isArchived],
  );
  return mapAccount(rows[0]) || null;
}

/** Expenses, incomes, recurring items and transfers that still point at this account. */
async function countUsage(id, client = db) {
  const { rows } = await client.query(
    `SELECT (SELECT COUNT(*) FROM expenses WHERE account_id = $1)
          + (SELECT COUNT(*) FROM incomes WHERE account_id = $1)
          + (SELECT COUNT(*) FROM recurring_transactions WHERE account_id = $1)
          + (SELECT COUNT(*) FROM transfers WHERE from_account_id = $1 OR to_account_id = $1)
          AS used`,
    [id],
  );
  return Number(rows[0].used);
}

async function deleteOwned(id, userId, client = db) {
  const { rowCount } = await client.query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  return rowCount > 0;
}

/**
 * Lock the given accounts (only the user's own) until the transaction ends. Always locked in
 * id order, so two transfers in opposite directions can never deadlock.
 * MUST be called with a transaction client.
 */
async function lockForUpdate(ids, userId, client) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM accounts
     WHERE id = ANY($1::uuid[]) AND user_id = $2
     ORDER BY id
     FOR UPDATE`,
    [ids, userId],
  );
  return rows.map(mapAccount);
}

/**
 * Change a balance by a positive `amount` (a numeric string). The arithmetic is done by
 * PostgreSQL in NUMERIC, so there is no rounding. Resolve the updated account or null.
 * Expenses (4.3) and incomes (4.4) use these too, inside their own transactions.
 */
async function debit(id, userId, amount, client = db) {
  const { rows } = await client.query(
    `UPDATE accounts SET balance = balance - $3::numeric
     WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`,
    [id, userId, amount],
  );
  return mapAccount(rows[0]) || null;
}

async function credit(id, userId, amount, client = db) {
  const { rows } = await client.query(
    `UPDATE accounts SET balance = balance + $3::numeric
     WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`,
    [id, userId, amount],
  );
  return mapAccount(rows[0]) || null;
}

async function createTransfer(
  { userId, fromAccountId, toAccountId, amount, date = null, note = null },
  client = db,
) {
  const { rows } = await client.query(
    `INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, date, note)
     VALUES ($1, $2, $3, $4::numeric, COALESCE($5::date, CURRENT_DATE), $6)
     RETURNING ${TRANSFER_COLUMNS}`,
    [userId, fromAccountId, toAccountId, amount, date, note],
  );
  return mapTransfer(rows[0]);
}

async function listTransfers(userId, { limit, offset }, client = db) {
  const { rows } = await client.query(
    `SELECT ${TRANSFER_COLUMNS} FROM transfers
     WHERE user_id = $1
     ORDER BY date DESC, created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  return rows.map(mapTransfer);
}

async function countTransfers(userId, client = db) {
  const { rows } = await client.query(
    'SELECT COUNT(*) AS total FROM transfers WHERE user_id = $1',
    [userId],
  );
  return Number(rows[0].total);
}

module.exports = {
  list,
  totalsByCurrency,
  findById,
  nameExists,
  create,
  update,
  setArchived,
  countUsage,
  deleteOwned,
  lockForUpdate,
  debit,
  credit,
  createTransfer,
  listTransfers,
  countTransfers,
};
