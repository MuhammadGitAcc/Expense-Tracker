'use strict';

const db = require('../config/db');

/**
 * SQL for the recurring_transactions table. Every query filters by user_id: a client id is
 * never trusted on its own. Money comes back as strings ("12.50") and dates as
 * "YYYY-MM-DD" strings. The last argument `client` is optional (a transaction client).
 */

const SELECT_JOINED = `
  SELECT r.id, r.type, r.amount, r.frequency, r.start_date, r.end_date, r.next_run_date,
         r.is_active, r.note, r.created_at, r.updated_at,
         r.account_id, a.name AS account_name, a.currency AS account_currency,
         r.category_id, c.name AS category_name, c.icon AS category_icon,
         c.color AS category_color
  FROM recurring_transactions r
  JOIN accounts a ON a.id = r.account_id
  JOIN categories c ON c.id = r.category_id`;

const mapRecurring = (row) =>
  row && {
    id: row.id,
    type: row.type,
    amount: row.amount,
    frequency: row.frequency,
    startDate: row.start_date,
    endDate: row.end_date,
    nextRunDate: row.next_run_date,
    isActive: row.is_active,
    note: row.note,
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

/** The user's templates, the ones that run first at the top. */
async function list(userId, filters = {}, client = db) {
  const values = [userId];
  const clauses = ['r.user_id = $1'];
  if (filters.type) {
    values.push(filters.type);
    clauses.push(`r.type = $${values.length}`);
  }
  if (filters.isActive !== undefined) {
    values.push(filters.isActive);
    clauses.push(`r.is_active = $${values.length}`);
  }
  const { rows } = await client.query(
    `${SELECT_JOINED}
     WHERE ${clauses.join(' AND ')}
     ORDER BY r.next_run_date, r.created_at, r.id`,
    values,
  );
  return rows.map(mapRecurring);
}

/** The user's OWN template with its account and category, or null. */
async function findById(id, userId, client = db) {
  const { rows } = await client.query(`${SELECT_JOINED} WHERE r.id = $1 AND r.user_id = $2`, [
    id,
    userId,
  ]);
  return mapRecurring(rows[0]) || null;
}

/** Insert the template. Resolves the new id (callers read the full row with findById). */
async function create(
  {
    userId,
    type,
    amount,
    accountId,
    categoryId,
    frequency,
    startDate,
    endDate = null,
    nextRunDate,
    note = null,
  },
  client = db,
) {
  const { rows } = await client.query(
    `INSERT INTO recurring_transactions
       (user_id, type, amount, account_id, category_id, frequency,
        start_date, end_date, next_run_date, note)
     VALUES ($1, $2, $3::numeric, $4, $5, $6, $7::date, $8::date, $9::date, $10)
     RETURNING id`,
    [userId, type, amount, accountId, categoryId, frequency, startDate, endDate, nextRunDate, note],
  );
  return rows[0].id;
}

// API field name -> column and the type its value is cast to. Nothing else is updatable.
const UPDATE_COLUMNS = {
  amount: { column: 'amount', cast: 'numeric' },
  accountId: { column: 'account_id', cast: 'uuid' },
  categoryId: { column: 'category_id', cast: 'uuid' },
  endDate: { column: 'end_date', cast: 'date' },
  note: { column: 'note', cast: 'text' },
};

/** Update only the fields that are present (null clears endDate or note). Resolves true if found. */
async function update(id, userId, fields, client = db) {
  const sets = [];
  const values = [];
  for (const [key, { column, cast }] of Object.entries(UPDATE_COLUMNS)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      sets.push(`${column} = $${values.length}::${cast}`);
    }
  }
  if (sets.length === 0) {
    const { rowCount } = await client.query(
      'SELECT 1 FROM recurring_transactions WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return rowCount > 0;
  }

  values.push(id, userId);
  const { rowCount } = await client.query(
    `UPDATE recurring_transactions SET ${sets.join(', ')}
     WHERE id = $${values.length - 1} AND user_id = $${values.length}`,
    values,
  );
  return rowCount > 0;
}

/** Pause or resume. A new next run date is only written when one is passed. */
async function setActive(id, userId, isActive, nextRunDate = null, client = db) {
  const { rowCount } = await client.query(
    `UPDATE recurring_transactions
     SET is_active = $1, next_run_date = COALESCE($2::date, next_run_date)
     WHERE id = $3 AND user_id = $4`,
    [isActive, nextRunDate, id, userId],
  );
  return rowCount > 0;
}

async function deleteById(id, userId, client = db) {
  const { rowCount } = await client.query(
    'DELETE FROM recurring_transactions WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return rowCount > 0;
}

module.exports = {
  list,
  findById,
  create,
  update,
  setActive,
  deleteById,
};
