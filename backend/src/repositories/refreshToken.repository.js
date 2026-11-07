'use strict';

const db = require('../config/db');

/**
 * SQL for the refresh_tokens table. Only SHA-256 hashes of tokens are stored (see
 * utils/hash.js hashToken); the raw token exists only in the user's cookie.
 * The last argument `client` is optional, see user.repository.js.
 */

const mapToken = (row) =>
  row && {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revoked: row.revoked,
    createdAt: row.created_at,
  };

async function create({ userId, tokenHash, expiresAt }, client = db) {
  const { rows } = await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, tokenHash, expiresAt],
  );
  return mapToken(rows[0]);
}

/** Any token with this hash (even revoked or expired), or null. */
async function findByHash(tokenHash, client = db) {
  const { rows } = await client.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [
    tokenHash,
  ]);
  return mapToken(rows[0]) || null;
}

/**
 * Atomically "use up" a token for rotation: it is marked revoked only if it is still valid
 * (not revoked, not expired), and the owner's id is returned. Resolves null otherwise.
 * Because this is ONE statement, two requests sending the same token at the same moment
 * cannot both succeed, so a refresh token can only ever be used once.
 */
async function claimByHash(tokenHash, client = db) {
  const { rows } = await client.query(
    `UPDATE refresh_tokens
     SET revoked = TRUE
     WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash],
  );
  return rows[0] ? rows[0].user_id : null;
}

/** Logout: revoke one token. Resolves true if a token was revoked. */
async function revokeByHash(tokenHash, client = db) {
  const { rowCount } = await client.query(
    'UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1 AND revoked = FALSE',
    [tokenHash],
  );
  return rowCount > 0;
}

/**
 * Revoke every active token of a user: used when a revoked token is presented again
 * (possible theft), after a password change or reset, and on "log out everywhere".
 * Resolves the number of tokens revoked.
 */
async function revokeAllForUser(userId, client = db) {
  const { rowCount } = await client.query(
    'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE',
    [userId],
  );
  return rowCount;
}

/** Housekeeping for a scheduled job: delete expired tokens. Resolves the number deleted. */
async function deleteExpired(client = db) {
  const { rowCount } = await client.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
  return rowCount;
}

module.exports = { create, findByHash, claimByHash, revokeByHash, revokeAllForUser, deleteExpired };
