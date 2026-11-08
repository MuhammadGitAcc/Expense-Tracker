'use strict';

const env = require('../config/env');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const userRepository = require('../repositories/user.repository');
const refreshTokenRepository = require('../repositories/refreshToken.repository');
const passwordResetTokenRepository = require('../repositories/passwordResetToken.repository');
const emailService = require('./email.service');
const {
  hashPassword,
  comparePassword,
  DUMMY_HASH,
  hashToken,
  generateRandomToken,
} = require('../utils/hash');
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

  const result = await db.withTransaction(async (client) => {
    const user = await userRepository.create({ name, email, passwordHash }, client);
    return issueTokens(user, client);
  });

  emailService.sendWelcomeEmail(result.user);

  return result;
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

const RESET_TOKEN_MINUTES = 30;

async function forgotPassword({ email }) {
  const user = await userRepository.findByEmail(email);
  if (!user) return;

  const token = generateRandomToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);

  await db.withTransaction(async (client) => {
    await passwordResetTokenRepository.invalidateAllForUser(user.id, client);
    await passwordResetTokenRepository.create(
      { userId: user.id, tokenHash: hashToken(token), expiresAt },
      client,
    );
  });

  const resetUrl = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  emailService.sendPasswordResetEmail({
    user,
    resetUrl,
    expiresInMinutes: RESET_TOKEN_MINUTES,
  });
}

async function resetPassword({ token, password }) {
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(password);

  await db.withTransaction(async (client) => {
    const userId = await passwordResetTokenRepository.claimByHash(tokenHash, client);
    if (!userId) throw ApiError.badRequest('This reset link is invalid or has expired');

    await userRepository.updatePassword(userId, passwordHash, client);
    await refreshTokenRepository.revokeAllForUser(userId, client);
    await passwordResetTokenRepository.invalidateAllForUser(userId, client);
  });
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword };
