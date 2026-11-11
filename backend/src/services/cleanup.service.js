'use strict';

const logger = require('../config/logger');
const userRepository = require('../repositories/user.repository');
const emailVerificationCodeRepository = require('../repositories/emailVerificationCode.repository');
const passwordResetTokenRepository = require('../repositories/passwordResetToken.repository');
const refreshTokenRepository = require('../repositories/refreshToken.repository');

// A sign-up that never confirmed its email is removed after this many days without activity.
const UNVERIFIED_MAX_AGE_DAYS = 3;

/**
 * Delete what is no longer needed. Every step runs on its own: if one fails it is logged
 * and counted, and the others still run. The order matters a little: stale accounts go
 * first, and the database removes their codes and tokens with them (ON DELETE CASCADE).
 * Safe to run any number of times. Resolves how many rows each step deleted, plus `failed`.
 */
async function runCleanup() {
  const steps = [
    ['unverifiedAccounts', () => userRepository.deleteStaleUnverified(UNVERIFIED_MAX_AGE_DAYS)],
    ['verificationCodes', () => emailVerificationCodeRepository.deleteExpired()],
    ['passwordResetTokens', () => passwordResetTokenRepository.deleteExpired()],
    ['refreshTokens', () => refreshTokenRepository.deleteExpired()],
  ];

  const result = { failed: 0 };
  for (const [name, step] of steps) {
    try {
      result[name] = await step();
    } catch (err) {
      result[name] = 0;
      result.failed += 1;
      logger.error('Cleanup step failed', { step: name, error: err.message });
    }
  }
  return result;
}

module.exports = { runCleanup, UNVERIFIED_MAX_AGE_DAYS };
