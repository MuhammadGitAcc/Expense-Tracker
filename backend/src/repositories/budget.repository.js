'use strict';

const db = require('../config/db');

/**
 * SQL for the budgets table. Every query filters by user_id: a client id is never trusted
 * on its own. Each budget comes back with the money already spent in its month (expenses of
 * the category, or of all categories for the overall budget), calculated by the database
 * with exact NUMERIC math. Money comes back as strings ("12.50").
 * The last argument `client` is optional: pass a transaction client to join a transaction.
 */

const SELECT_BUDGET = `
  SELECT b.id, b.category_id, b.amount, b.month, b.year, b.alert_threshold, b.created_at,
         c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
         s.spent,
         (b.amount - s.spent) AS remaining,
         ROUND(s.spent * 100 / b.amount, 1)::float8 AS percent_used,
         CASE
           WHEN s.spent > b.amount THEN 'exceeded'
           WHEN s.spent * 100 >= b.alert_threshold * b.amount THEN 'warning'
           ELSE 'ok'
         END AS status
  FROM budgets b
  LEFT JOIN categories c ON c.id = b.category_id
  CROSS JOIN LATERAL (
    SELECT ROUND(COALESCE(SUM(e.amount), 0), 2) AS spent
    FROM expenses e
    WHERE e.user_id = b.user_id
      AND e.date >= make_date(b.year, b.month, 1)
      AND e.date < (make_date(b.year, b.month, 1) + INTERVAL '1 month')::date
      AND (b.category_id IS NULL OR e.category_id = b.category_id)
  ) s`;

const mapBudget = (row) =>
  row && {
    id: row.id,
    category: row.category_id
      ? {
          id: row.category_id,
          name: row.category_name,
          icon: row.category_icon,
          color: row.category_color,
        }
      : null,
    amount: row.amount,
    month: row.month,
    year: row.year,
    alertThreshold: row.alert_threshold,
    spent: row.spent,
    remaining: row.remaining,
    percentUsed: row.percent_used,
    status: row.status,
    createdAt: row.created_at,
  };

/** All budgets of one month: the overall budget first, then the categories by name. */
async function list(userId, { month, year }, client = db) {
  const { rows } = await client.query(
    `${SELECT_BUDGET}
     WHERE b.user_id = $1 AND b.month = $2 AND b.year = $3
     ORDER BY (b.category_id IS NOT NULL), c.name, b.id`,
    [userId, month, year],
  );
  return rows.map(mapBudget);
}

/** The user's OWN budget, or null. */
async function findById(id, userId, client = db) {
  const { rows } = await client.query(`${SELECT_BUDGET} WHERE b.id = $1 AND b.user_id = $2`, [
    id,
    userId,
  ]);
  return mapBudget(rows[0]) || null;
}

/**
 * Insert the budget and resolve its new id (callers read the full row with findById).
 * A second budget for the same category and month (or a second overall budget) throws a
 * PostgreSQL 23505 error.
 */
async function create(
  { userId, categoryId = null, amount, month, year, alertThreshold = null },
  client = db,
) {
  const { rows } = await client.query(
    `INSERT INTO budgets (user_id, category_id, amount, month, year, alert_threshold)
     VALUES ($1, $2, $3::numeric, $4::smallint, $5::smallint, COALESCE($6::smallint, 80))
     RETURNING id`,
    [userId, categoryId, amount, month, year, alertThreshold],
  );
  return rows[0].id;
}

// API field name -> column and the type its value is cast to. Nothing else is updatable.
const UPDATE_COLUMNS = {
  amount: { column: 'amount', cast: 'numeric' },
  alertThreshold: { column: 'alert_threshold', cast: 'smallint' },
};

/** Update only the fields that are present. Resolves true when the budget was found. */
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
      'SELECT 1 FROM budgets WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return rowCount > 0;
  }

  values.push(id, userId);
  const { rowCount } = await client.query(
    `UPDATE budgets SET ${sets.join(', ')}
     WHERE id = $${values.length - 1} AND user_id = $${values.length}`,
    values,
  );
  return rowCount > 0;
}

async function deleteById(id, userId, client = db) {
  const { rowCount } = await client.query('DELETE FROM budgets WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  return rowCount > 0;
}

module.exports = {
  list,
  findById,
  create,
  update,
  deleteById,
};
