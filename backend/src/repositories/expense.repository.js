'use strict';

const db = require('../config/db');
const env = require('../config/env');

/**
 * SQL for the expenses table. Every query filters by user_id: a client id is never trusted
 * on its own. Money comes back as strings ("12.50") and dates as "YYYY-MM-DD" strings.
 * The last argument `client` is optional: pass a transaction client to join a transaction.
 */

const SELECT_JOINED = `
  SELECT e.id, e.amount, e.date, e.note, e.payment_method, e.tags, e.receipt_url,
         e.recurring_id, e.created_at, e.updated_at,
         e.account_id, a.name AS account_name, a.currency AS account_currency,
         e.category_id, c.name AS category_name, c.icon AS category_icon,
         c.color AS category_color
  FROM expenses e
  JOIN accounts a ON a.id = e.account_id
  JOIN categories c ON c.id = e.category_id`;

const FROM_JOINED = `
  FROM expenses e
  JOIN accounts a ON a.id = e.account_id
  JOIN categories c ON c.id = e.category_id`;

const mapExpense = (row) =>
  row && {
    id: row.id,
    amount: row.amount,
    date: row.date,
    note: row.note,
    paymentMethod: row.payment_method,
    tags: row.tags,
    // The column holds the stored file name; the API exposes the (private) download route.
    receiptUrl: row.receipt_url ? `${env.apiPrefix}/expenses/${row.id}/receipt` : null,
    recurringId: row.recurring_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    account: { id: row.account_id, name: row.account_name, currency: row.account_currency },
    category: {
      id: row.category_id,
      name: row.category_name,
      icon: row.category_icon,
      color: row.category_color,
    },
  };

/** Make % _ and \ in a search text match themselves instead of acting as wildcards. */
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

/** WHERE clause and values for the list filters. user_id is always the first condition. */
function buildWhere(userId, filters = {}) {
  const values = [userId];
  const clauses = ['e.user_id = $1'];
  const add = (sql, value) => {
    values.push(value);
    clauses.push(sql.replace('?', `$${values.length}`));
  };

  if (filters.from) add('e.date >= ?::date', filters.from);
  if (filters.to) add('e.date <= ?::date', filters.to);
  if (filters.categoryId) add('e.category_id = ?::uuid', filters.categoryId);
  if (filters.accountId) add('e.account_id = ?::uuid', filters.accountId);
  if (filters.minAmount !== undefined) add('e.amount >= ?::numeric', filters.minAmount);
  if (filters.maxAmount !== undefined) add('e.amount <= ?::numeric', filters.maxAmount);
  if (filters.paymentMethod) add('e.payment_method = ?', filters.paymentMethod);
  if (filters.tag) add('e.tags @> ARRAY[?]::text[]', filters.tag);
  if (filters.search) {
    values.push(`%${escapeLike(filters.search)}%`);
    const n = values.length;
    clauses.push(`(e.note ILIKE $${n} ESCAPE '\\' OR c.name ILIKE $${n} ESCAPE '\\')`);
  }
  return { where: clauses.join(' AND '), values };
}

// Only these columns can be sorted on (never user input inside the SQL text).
const SORT_COLUMNS = { date: 'e.date', amount: 'e.amount', createdAt: 'e.created_at' };

async function list(userId, filters, { sortBy, sortOrder, limit, offset }, client = db) {
  const { where, values } = buildWhere(userId, filters);
  const column = SORT_COLUMNS[sortBy] || SORT_COLUMNS.date;
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  values.push(limit, offset);
  const { rows } = await client.query(
    `${SELECT_JOINED}
     WHERE ${where}
     ORDER BY ${column} ${direction}, e.created_at DESC, e.id
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return rows.map(mapExpense);
}

/** Count and exact total of ALL expenses that match the filters (not only one page). */
async function summary(userId, filters, client = db) {
  const { where, values } = buildWhere(userId, filters);
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS total, ROUND(COALESCE(SUM(e.amount), 0), 2)::text AS total_amount
     ${FROM_JOINED}
     WHERE ${where}`,
    values,
  );
  return { total: rows[0].total, totalAmount: rows[0].total_amount };
}

/** The user's OWN expense with its account and category, or null. */
async function findById(id, userId, client = db) {
  const { rows } = await client.query(`${SELECT_JOINED} WHERE e.id = $1 AND e.user_id = $2`, [
    id,
    userId,
  ]);
  return mapExpense(rows[0]) || null;
}

/**
 * Lock the user's expense row until the transaction ends and resolve the values needed to
 * fix balances: { id, accountId, categoryId, amount }, or null. Use a transaction client.
 */
async function lockById(id, userId, client) {
  const { rows } = await client.query(
    `SELECT id, account_id, category_id, amount, receipt_url FROM expenses
     WHERE id = $1 AND user_id = $2 FOR UPDATE`,
    [id, userId],
  );
  return rows[0]
    ? {
        id: rows[0].id,
        accountId: rows[0].account_id,
        categoryId: rows[0].category_id,
        amount: rows[0].amount,
        receiptFile: rows[0].receipt_url,
      }
    : null;
}

/** Insert the expense. Resolves the new id (callers read the full row with findById). */
async function create(
  { userId, accountId, categoryId, amount, date = null, note = null, paymentMethod, tags = [] },
  client = db,
) {
  const { rows } = await client.query(
    `INSERT INTO expenses
       (user_id, account_id, category_id, amount, date, note, payment_method, tags)
     VALUES ($1, $2, $3, $4::numeric, COALESCE($5::date, CURRENT_DATE), $6, $7, $8::text[])
     RETURNING id`,
    [userId, accountId, categoryId, amount, date, note, paymentMethod, tags],
  );
  return rows[0].id;
}

// API field name -> column and the type its value is cast to. Nothing else is updatable.
const UPDATE_COLUMNS = {
  accountId: { column: 'account_id', cast: 'uuid' },
  categoryId: { column: 'category_id', cast: 'uuid' },
  amount: { column: 'amount', cast: 'numeric' },
  date: { column: 'date', cast: 'date' },
  note: { column: 'note', cast: 'text' },
  paymentMethod: { column: 'payment_method', cast: 'text' },
  tags: { column: 'tags', cast: 'text[]' },
};

/** Update only the fields that are present (null clears the note). Resolves true if updated. */
async function update(id, userId, fields, client = db) {
  const sets = [];
  const values = [];
  for (const [key, { column, cast }] of Object.entries(UPDATE_COLUMNS)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      sets.push(`${column} = $${values.length}::${cast}`);
    }
  }
  if (sets.length === 0) return true;

  values.push(id, userId);
  const { rowCount } = await client.query(
    `UPDATE expenses SET ${sets.join(', ')}
     WHERE id = $${values.length - 1} AND user_id = $${values.length}`,
    values,
  );
  return rowCount > 0;
}

async function deleteById(id, userId, client = db) {
  const { rowCount } = await client.query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  return rowCount > 0;
}

/**
 * The stored receipt file name: a string, null when the expense has no receipt, undefined
 * when the expense does not exist or belongs to someone else.
 */
async function getReceiptFile(id, userId, client = db) {
  const { rows } = await client.query(
    'SELECT receipt_url FROM expenses WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return rows[0] ? rows[0].receipt_url : undefined;
}

/** Set (or clear with null) the receipt file name. Resolves true when the expense exists. */
async function setReceiptFile(id, userId, filename, client = db) {
  const { rowCount } = await client.query(
    'UPDATE expenses SET receipt_url = $3 WHERE id = $1 AND user_id = $2',
    [id, userId, filename],
  );
  return rowCount > 0;
}

module.exports = {
  list,
  summary,
  findById,
  lockById,
  create,
  update,
  deleteById,
  getReceiptFile,
  setReceiptFile,
};
