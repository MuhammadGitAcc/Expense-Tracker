'use strict';

const db = require('../config/db');

/**
 * SQL for the categories table. Default categories have user_id NULL (shared by everyone),
 * custom ones belong to one user. user_id is never part of a result: callers only need to
 * know isDefault. The last argument `client` is optional, see user.repository.js.
 */

const COLUMNS = 'id, name, type, icon, color, is_default';

const mapCategory = (row) =>
  row && {
    id: row.id,
    name: row.name,
    type: row.type,
    icon: row.icon,
    color: row.color,
    isDefault: row.is_default,
  };

/** Defaults plus the user's own categories, optionally only one type. */
async function listForUser(userId, { type } = {}, client = db) {
  const values = [userId];
  let typeFilter = '';
  if (type) {
    values.push(type);
    typeFilter = `AND type = $${values.length}`;
  }
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM categories
     WHERE (user_id IS NULL OR user_id = $1) ${typeFilter}
     ORDER BY type, is_default DESC, LOWER(name)`,
    values,
  );
  return rows.map(mapCategory);
}

/** A default category or one of the user's own. Anyone else's resolves null. */
async function findAccessibleById(id, userId, client = db) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
    [id, userId],
  );
  return mapCategory(rows[0]) || null;
}

/**
 * True when a default or the user's own category of this type already has this name
 * (ignoring case). Pass excludeId to ignore the category being renamed.
 */
async function nameExists({ userId, type, name, excludeId = null }, client = db) {
  const { rows } = await client.query(
    `SELECT 1 FROM categories
     WHERE type = $1 AND LOWER(name) = LOWER($2)
       AND (user_id IS NULL OR user_id = $3)
       AND ($4::uuid IS NULL OR id <> $4::uuid)
     LIMIT 1`,
    [type, name, userId, excludeId],
  );
  return rows.length > 0;
}

async function create({ userId, name, type, icon, color }, client = db) {
  const { rows } = await client.query(
    `INSERT INTO categories (user_id, name, type, icon, color, is_default)
     VALUES ($1, $2, $3, $4, $5, FALSE)
     RETURNING ${COLUMNS}`,
    [userId, name, type, icon, color],
  );
  return mapCategory(rows[0]);
}

// API field name -> column. Only these can ever be updated (type and ownership never).
const UPDATE_COLUMNS = { name: 'name', icon: 'icon', color: 'color' };

/** Update the user's OWN category. Resolves the updated category, or null. */
async function update(id, userId, fields, client = db) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(UPDATE_COLUMNS)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) return findAccessibleById(id, userId, client);

  values.push(id, userId);
  const { rows } = await client.query(
    `UPDATE categories SET ${sets.join(', ')}
     WHERE id = $${values.length - 1} AND user_id = $${values.length}
     RETURNING ${COLUMNS}`,
    values,
  );
  return mapCategory(rows[0]) || null;
}

/** How many expenses, incomes and recurring transactions use this category. */
async function countUsage(id, client = db) {
  const { rows } = await client.query(
    `SELECT (SELECT COUNT(*) FROM expenses WHERE category_id = $1)
          + (SELECT COUNT(*) FROM incomes WHERE category_id = $1)
          + (SELECT COUNT(*) FROM recurring_transactions WHERE category_id = $1) AS used`,
    [id],
  );
  return Number(rows[0].used);
}

/** Delete the user's OWN category. Resolves true if a row was deleted. */
async function deleteOwned(id, userId, client = db) {
  const { rowCount } = await client.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  return rowCount > 0;
}

module.exports = {
  listForUser,
  findAccessibleById,
  nameExists,
  create,
  update,
  countUsage,
  deleteOwned,
};
