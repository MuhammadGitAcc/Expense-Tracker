'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const env = require('../config/env');
const { EMAIL_VERIFICATION } = require('./constants');

// Cost factor: each +1 doubles the time. 12 is a good default in 2026.
// Tests use 4 so the test suite stays fast.
const BCRYPT_ROUNDS = env.isTest ? 4 : 12;

/** Hash a password for storage in users.password_hash. */
const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

/** Compare a login attempt with a stored hash. Resolves true or false. */
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

/**
 * A fixed, valid bcrypt hash of a random password. Login compares against it when the
 * email does not exist, so "unknown email" and "wrong password" take the same time and
 * an attacker cannot tell which emails are registered.
 */
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

/** SHA-256 hex of a token. Refresh and reset tokens are stored hashed, never raw. */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Unguessable random string for password-reset links (URL-safe). */
const generateRandomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

/** Random 6-digit code (leading zeros kept), e.g. "042917". Uses a secure random source. */
const generateVerificationCode = () =>
  String(crypto.randomInt(0, 10 ** EMAIL_VERIFICATION.CODE_LENGTH)).padStart(
    EMAIL_VERIFICATION.CODE_LENGTH,
    '0',
  );

/**
 * Hash a verification code for storage. A 6-digit code has only 1,000,000 possibilities, so
 * a plain hash could be reversed instantly; an HMAC with a server secret (and the user id)
 * cannot be checked without that secret. Attempt limits and expiry add a second layer.
 */
const hashVerificationCode = (userId, code) =>
  crypto.createHmac('sha256', env.jwt.refreshSecret).update(`${userId}:${code}`).digest('hex');

/** Constant-time check of a submitted code against the stored hash. Resolves true or false. */
const verifyVerificationCode = (userId, code, storedHash) => {
  const actual = Buffer.from(hashVerificationCode(userId, code), 'hex');
  const expected = Buffer.from(String(storedHash), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

module.exports = {
  hashPassword,
  comparePassword,
  DUMMY_HASH,
  hashToken,
  generateRandomToken,
  generateVerificationCode,
  hashVerificationCode,
  verifyVerificationCode,
};
