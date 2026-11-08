'use strict';

const env = require('../config/env');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const userRepository = require('../repositories/user.repository');
const refreshTokenRepository = require('../repositories/refreshToken.repository');
const passwordResetTokenRepository = require('../repositories/passwordResetToken.repository');
const emailVerificationCodeRepository = require('../repositories/emailVerificationCode.repository');
const emailService = require('./email.service');
const {
  hashPassword,
  comparePassword,
  DUMMY_HASH,
  hashToken,
  generateRandomToken,
  generateVerificationCode,
  hashVerificationCode,
  verifyVerificationCode,
} = require('../utils/hash');
const { EMAIL_VERIFICATION } = require('../utils/constants');
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

const INVALID_CODE_MESSAGE = 'This code is invalid or has expired';

/**
 * Create a fresh 6-digit code for the user (older codes are cancelled) and email it.
 * Does nothing when the last code was created less than the cooldown ago.
 * Resolves true when a new code was created. The email is sent without waiting.
 */
async function sendVerificationCode(user) {
  const seconds = await emailVerificationCodeRepository.secondsSinceLastCode(user.id);
  if (seconds !== null && seconds < EMAIL_VERIFICATION.RESEND_COOLDOWN_SECONDS) return false;

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION.EXPIRES_MINUTES * 60 * 1000);

  await db.withTransaction(async (client) => {
    await emailVerificationCodeRepository.invalidateAllForUser(user.id, client);
    await emailVerificationCodeRepository.create(
      { userId: user.id, codeHash: hashVerificationCode(user.id, code), expiresAt },
      client,
    );
  });

  emailService.sendVerificationEmail({
    user,
    code,
    expiresInMinutes: EMAIL_VERIFICATION.EXPIRES_MINUTES,
  });
  return true;
}

/**
 * Create the account as unverified and email a code. Nobody is logged in yet.
 * If the email belongs to an account that was never verified, that pending account is
 * taken over (new name and password); otherwise anyone could block an address forever
 * by registering it first.
 */
async function register({ name, email, password }) {
  const existing = await userRepository.findByEmail(email);
  if (existing && existing.emailVerified) {
    throw ApiError.conflict('An account with this email already exists');
  }
  const passwordHash = await hashPassword(password);

  let user;
  if (existing) {
    user = await db.withTransaction(async (client) => {
      await userRepository.updatePassword(existing.id, passwordHash, client);
      return userRepository.updateProfile(existing.id, { name }, client);
    });
  } else {
    user = await userRepository.create({ name, email, passwordHash });
  }

  await sendVerificationCode(user);
  return { user, expiresInMinutes: EMAIL_VERIFICATION.EXPIRES_MINUTES };
}

/**
 * Check the 6-digit code. A wrong guess is counted (outside any transaction, so the count
 * survives the error); the 5th wrong guess cancels the code. A right code is used up
 * atomically, the email is marked verified and the user is logged in.
 */
async function verifyEmail({ email, code }) {
  const user = await userRepository.findByEmail(email);
  if (!user || user.emailVerified) throw ApiError.badRequest(INVALID_CODE_MESSAGE);

  const active = await emailVerificationCodeRepository.findActiveByUserId(user.id);
  if (!active) throw ApiError.badRequest(INVALID_CODE_MESSAGE);

  const max = EMAIL_VERIFICATION.MAX_ATTEMPTS;
  if (!verifyVerificationCode(user.id, code, active.codeHash)) {
    const attempts = await emailVerificationCodeRepository.registerFailedAttempt(active.id, max);
    if (attempts === null || attempts >= max) {
      throw ApiError.badRequest('Too many wrong attempts. Please request a new code');
    }
    throw ApiError.badRequest(`Incorrect code. ${max - attempts} attempt(s) left`);
  }

  const result = await db.withTransaction(async (client) => {
    const used = await emailVerificationCodeRepository.markUsed(active.id, max, client);
    if (!used) return null;
    await userRepository.markEmailVerified(user.id, client);
    return issueTokens({ ...user, emailVerified: true }, client);
  });
  if (!result) throw ApiError.badRequest(INVALID_CODE_MESSAGE);

  emailService.sendWelcomeEmail(result.user);
  return result;
}

/** Always resolves the same way, so nobody can find out which emails are registered. */
async function resendVerification({ email }) {
  const user = await userRepository.findByEmail(email);
  if (!user || user.emailVerified) return;
  await sendVerificationCode(user);
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

  // Only reached with the right password, so this reveals nothing to strangers.
  if (!user.emailVerified) {
    await sendVerificationCode(user);
    throw ApiError.emailNotVerified('Please verify your email address with the code we sent you');
  }
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
    await userRepository.markEmailVerified(userId, client);
    await emailVerificationCodeRepository.invalidateAllForUser(userId, client);
    await refreshTokenRepository.revokeAllForUser(userId, client);
    await passwordResetTokenRepository.invalidateAllForUser(userId, client);
  });
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
