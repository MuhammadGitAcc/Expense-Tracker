'use strict';

const db = require('../config/db');

/**
 * SQL for the email_verification_codes table. Only hashes of the 6-digit codes are
 * stored; the raw code exists only in the email. The last argument `client` is optional,
 * see user.repository.js.
 */

async function create({ userId, codeHash, expiresAt }, client = db) {
  await client.query(
    'INSERT INTO email_verification_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, codeHash, expiresAt],
  );
}

/**
 * The user's current code: unused, not expired. Resolves { id, codeHash, attempts } or
 * null. Only the newest one is returned (a new code cancels older ones anyway).
 */
async function findActiveByUserId(userId, client = db) {
  const { rows } = await client.query(
    `SELECT id, code_hash, attempts
     FROM email_verification_codes
     WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  if (!rows[0]) return null;
  return { id: rows[0].id, codeHash: rows[0].code_hash, attempts: rows[0].attempts };
}

/**
 * Seconds since the newest code of this user was created (any status), or null when
 * the user never had one. Used for the "one resend per 60 seconds" rule.
 */
async function secondsSinceLastCode(userId, client = db) {
  const { rows } = await client.query(
    `SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) AS seconds
     FROM email_verification_codes
     WHERE user_id = $1`,
    [userId],
  );
  const seconds = rows[0] && rows[0].seconds;
  return seconds === null || seconds === undefined ? null : Number(seconds);
}

/**
 * Count one wrong guess. When the count reaches maxAttempts the code is cancelled in the
 * same statement. Resolves the new attempt count, or null if the code was already used.
 */
async function registerFailedAttempt(id, maxAttempts, client = db) {
  const { rows } = await client.query(
    `UPDATE email_verification_codes
     SET attempts = attempts + 1,
         used_at = CASE WHEN attempts + 1 >= $2 THEN NOW() ELSE used_at END
     WHERE id = $1 AND used_at IS NULL
     RETURNING attempts`,
    [id, maxAttempts],
  );
  return rows[0] ? rows[0].attempts : null;
}

/**
 * Atomically "use up" a correct code: it is marked used only if it is still unused, not
 * expired and under the attempt limit. Resolves true when this call used it. ONE
 * statement, so a code can only ever be used once.
 */
async function markUsed(id, maxAttempts, client = db) {
  const { rowCount } = await client.query(
    `UPDATE email_verification_codes
     SET used_at = NOW()
     WHERE id = $1 AND used_at IS NULL AND expires_at > NOW() AND attempts < $2`,
    [id, maxAttempts],
  );
  return rowCount === 1;
}

/** Cancel every unused code of a user (a new code replaces older ones). */
async function invalidateAllForUser(userId, client = db) {
  const { rowCount } = await client.query(
    'UPDATE email_verification_codes SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
    [userId],
  );
  return rowCount;
}

/** Housekeeping for a scheduled job: delete expired codes. Resolves the number deleted. */
async function deleteExpired(client = db) {
  const { rowCount } = await client.query(
    'DELETE FROM email_verification_codes WHERE expires_at < NOW()',
  );
  return rowCount;
}

module.exports = {
  create,
  findActiveByUserId,
  secondsSinceLastCode,
  registerFailedAttempt,
  markUsed,
  invalidateAllForUser,
  deleteExpired,
};
