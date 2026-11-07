'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const userRepository = require('../repositories/user.repository');
const refreshTokenRepository = require('../repositories/refreshToken.repository');
const { hashPassword, comparePassword, DUMMY_HASH, hashToken } = require('../utils/hash');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

/**
 * Create an access token and a refresh token for a user, and store the refresh token's
 * hash. Pass a transaction client to run the insert inside that transaction.
 * Resolves { user, accessToken, refreshToken }.
 */
async function issueTokens(user, client) {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, expiresAt } = signRefreshToken(user);
  await refreshTokenRepository.create(
    { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt },
    client,
  );
  return { user, accessToken, refreshToken };
}

/** Create the account and log the user in. */
async function register({ name, email, password }) {
  if (await userRepository.emailExists(email)) {
    throw ApiError.conflict('An account with this email already exists');
  }
  const passwordHash = await hashPassword(password);

  return db.withTransaction(async (client) => {
    const user = await userRepository.create({ name, email, passwordHash }, client);
    return issueTokens(user, client);
  });
}

/**
 * Check the credentials. The same error and the same timing are used for "unknown email"
 * and "wrong password", so nobody can find out which emails are registered.
 */
async function login({ email, password }) {
  const found = await userRepository.findByEmailWithPassword(email);
  const matches = await comparePassword(password, found ? found.passwordHash : DUMMY_HASH);
  if (!found || !matches) throw ApiError.unauthorized('Invalid email or password');

  const user = { ...found };
  delete user.passwordHash;
  return issueTokens(user);
}

/**
 * Swap a refresh token for a new pair. Refresh tokens are single use: the old one is
 * revoked as part of the swap. If a token that was already used is presented again, it may
 * have been stolen, so every token of that user is revoked.
 */
async function refresh(rawToken) {
  if (!rawToken) throw ApiError.unauthorized('Refresh token missing');
  verifyRefreshToken(rawToken);
  const tokenHash = hashToken(rawToken);

  // The error is thrown AFTER the transaction, otherwise the "revoke everything" step
  // below would be rolled back together with it.
  const result = await db.withTransaction(async (client) => {
    const userId = await refreshTokenRepository.claimByHash(tokenHash, client);

    if (!userId) {
      const known = await refreshTokenRepository.findByHash(tokenHash, client);
      if (known && known.revoked) {
        await refreshTokenRepository.revokeAllForUser(known.userId, client);
      }
      return null;
    }

    const user = await userRepository.findById(userId, client);
    if (!user) return null;
    return issueTokens(user, client);
  });

  if (!result) throw ApiError.unauthorized('Invalid or expired refresh token');
  return result;
}

/** Revoke the refresh token from the cookie. Never fails, even without a valid token. */
async function logout(rawToken) {
  if (!rawToken) return;
  await refreshTokenRepository.revokeByHash(hashToken(rawToken));
}

module.exports = { register, login, refresh, logout };
