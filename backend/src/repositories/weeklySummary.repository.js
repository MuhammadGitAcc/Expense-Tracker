'use strict';

const db = require('../config/db');

/**
 * SQL for the weekly_summaries table: which user already got the summary of which week.
 * The last argument `client` is optional (a transaction client).
 */

/**
 * Verified users that have not got the summary of the week starting on `weekStart` yet.
 * Resolves [{ id, name, email, currency }], oldest accounts first.
 */
async function listUsersWithoutSummary(weekStart, client = db) {
  const { rows } = await client.query(
    `SELECT u.id, u.name, u.email, u.currency
     FROM users u
     WHERE u.email_verified
       AND NOT EXISTS (
         SELECT 1 FROM weekly_summaries w WHERE w.user_id = u.id AND w.week_start = $1::date
       )
     ORDER BY u.created_at, u.id`,
    [weekStart],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    currency: row.currency.trim(),
  }));
}

/**
 * Mark the week as sent for the user. Resolves true when this call did it, false when the
 * week was already marked (so exactly one of two simultaneous runs sends the summary).
 */
async function claim(userId, weekStart, client = db) {
  const { rowCount } = await client.query(
    `INSERT INTO weekly_summaries (user_id, week_start) VALUES ($1, $2::date)
     ON CONFLICT DO NOTHING`,
    [userId, weekStart],
  );
  return rowCount > 0;
}

module.exports = { listUsersWithoutSummary, claim };
