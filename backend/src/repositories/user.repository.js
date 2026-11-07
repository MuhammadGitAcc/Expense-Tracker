'use strict';

const db = require('../config/db');

/**
 * SQL for the users table, and nothing else (Route -> Controller -> Service -> Repository).
 *
 * - Every value goes through $1, $2... parameters, never string concatenation.
 * - Rows are returned in camelCase. password_hash is NEVER part of a normal result;
 *   only the *WithPassword functions return it, so it cannot leak into an API response.
 * - The last argument `client` is optional. Pass a transaction client from
 *   db.withTransaction to run the query inside that transaction.
 */

const PUBLIC_COLUMNS = `id, name, email, avatar_url, currency, language, theme, role,
  email_verified, created_at, updated_at`;

const mapUser = (row) =>
  row && {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    currency: row.currency,
    language: row.language,
    theme: row.theme,
    role: row.role,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

/** Public user by id, or null. */
async function findById(id, client = db) {
  const { rows } = await client.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return mapUser(rows[0]) || null;
}

/** Public user by email (case-insensitive), or null. */
async function findByEmail(email, client = db) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  return mapUser(rows[0]) || null;
}

/** For login: the public user plus passwordHash, or null. */
async function findByEmailWithPassword(email, client = db) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  return rows[0] ? { ...mapUser(rows[0]), passwordHash: rows[0].password_hash } : null;
}

/** For change-password and delete-account: the public user plus passwordHash, or null. */
async function findByIdWithPassword(id, client = db) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ? { ...mapUser(rows[0]), passwordHash: rows[0].password_hash } : null;
}

async function emailExists(email, client = db) {
  const { rows } = await client.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [
    email,
  ]);
  return rows.length > 0;
}

/**
 * Insert a user. `passwordHash` must already be hashed.
 * A duplicate email throws a PostgreSQL 23505 error (the error middleware turns it into 409).
 */
async function create({ name, email, passwordHash }, client = db) {
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash],
  );
  return mapUser(rows[0]);
}

// API field name -> column. Only these can ever be updated through updateProfile.
const PROFILE_COLUMNS = {
  name: 'name',
  currency: 'currency',
  language: 'language',
  theme: 'theme',
};

/**
 * Update only the profile fields that are present in `fields`.
 * Unknown keys are ignored, so role / email / password_hash can never be changed here.
 * Returns the updated public user, or null if the id does not exist.
 */
async function updateProfile(id, fields, client = db) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(PROFILE_COLUMNS)) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) return findById(id, client);

  values.push(id);
  const { rows } = await client.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}
     RETURNING ${PUBLIC_COLUMNS}`,
    values,
  );
  return mapUser(rows[0]) || null;
}

/** Pass null to remove the avatar. Returns the updated public user, or null. */
async function setAvatarUrl(id, avatarUrl, client = db) {
  const { rows } = await client.query(
    `UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [avatarUrl, id],
  );
  return mapUser(rows[0]) || null;
}

/** `passwordHash` must already be hashed. Resolves true if a user was updated. */
async function updatePassword(id, passwordHash, client = db) {
  const { rowCount } = await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
    passwordHash,
    id,
  ]);
  return rowCount > 0;
}

async function markEmailVerified(id, client = db) {
  const { rowCount } = await client.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [
    id,
  ]);
  return rowCount > 0;
}

/**
 * Delete the user. The database removes everything they own (accounts, expenses, budgets,
 * tokens...) because those foreign keys are ON DELETE CASCADE. Resolves true if deleted.
 */
async function deleteById(id, client = db) {
  const { rowCount } = await client.query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  findById,
  findByEmail,
  findByEmailWithPassword,
  findByIdWithPassword,
  emailExists,
  create,
  updateProfile,
  setAvatarUrl,
  updatePassword,
  markEmailVerified,
  deleteById,
};
