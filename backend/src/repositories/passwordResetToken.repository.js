'use strict';

const db = require('../config/db');

/**
 * SQL for the password_reset_tokens table. Only SHA-256 hashes are stored (see
 * utils/hash.js hashToken); the raw token exists only in the email link.
 * The last argument `client` is optional, see user.repository.js.
 */

async function create({ userId, tokenHash, expiresAt }, client = db) {
  await client.query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt],
  );
}

/**
 * Atomically "use up" a token: it is marked used only if it is still unused and not
 * expired, and the owner's id is returned. Resolves null otherwise. Because this is ONE
 * statement, a reset link can only ever be used once.
 */
async function claimByHash(tokenHash, client = db) {
  const { rows } = await client.query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash],
  );
  return rows[0] ? rows[0].user_id : null;
}

/** Cancel every unused link of a user. Resolves the number of tokens cancelled. */
async function invalidateAllForUser(userId, client = db) {
  const { rowCount } = await client.query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
    [userId],
  );
  return rowCount;
}

/** Housekeeping for a scheduled job: delete expired tokens. Resolves the number deleted. */
async function deleteExpired(client = db) {
  const { rowCount } = await client.query(
    'DELETE FROM password_reset_tokens WHERE expires_at < NOW()',
  );
  return rowCount;
}

module.exports = { create, claimByHash, invalidateAllForUser, deleteExpired };
