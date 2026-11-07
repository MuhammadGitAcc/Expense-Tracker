'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('./ApiError');

const ISSUER = 'expense-tracker-api';
const REFRESH_COOKIE_NAME = 'refreshToken';

/** Short-lived token sent in the Authorization header: "Bearer <token>". */
function signAccessToken(user) {
  return jwt.sign({ role: user.role, type: 'access' }, env.jwt.accessSecret, {
    subject: user.id,
    issuer: ISSUER,
    expiresIn: env.jwt.accessExpiresIn,
    algorithm: 'HS256',
  });
}

/** Returns the payload ({ sub, role, ... }) or throws a 401 ApiError. */
function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret, {
      issuer: ISSUER,
      algorithms: ['HS256'],
    });
    if (payload.type !== 'access') throw new Error('wrong token type');
    return payload;
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Access token expired');
    throw ApiError.unauthorized('Invalid access token');
  }
}

/**
 * Long-lived token kept in an httpOnly cookie. `jti` is a random id so two tokens issued in
 * the same second are still different (the database stores a unique hash of each token).
 * Returns { token, expiresAt } where expiresAt is the Date to store in refresh_tokens.
 */
function signRefreshToken(user) {
  const expiresAt = new Date(Date.now() + env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000);
  const token = jwt.sign({ type: 'refresh' }, env.jwt.refreshSecret, {
    subject: user.id,
    issuer: ISSUER,
    jwtid: crypto.randomUUID(),
    expiresIn: `${env.jwt.refreshExpiresDays}d`,
    algorithm: 'HS256',
  });
  return { token, expiresAt };
}

/** Returns the payload or throws a 401 ApiError. */
function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, env.jwt.refreshSecret, {
      issuer: ISSUER,
      algorithms: ['HS256'],
    });
    if (payload.type !== 'refresh') throw new Error('wrong token type');
    return payload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }
}

/**
 * Cookie settings for the refresh token.
 * - httpOnly: JavaScript in the browser cannot read it (protects against XSS theft).
 * - secure: HTTPS only (COOKIE_SECURE=true in production).
 * - sameSite: 'none' is needed when frontend and API are on different sites (production),
 *   and browsers only accept 'none' together with secure. Locally 'lax' works.
 * - path: the cookie is only sent to the auth endpoints, not to every API call.
 */
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSecure ? 'none' : 'lax',
    path: `${env.apiPrefix}/auth`,
    maxAge: env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000,
  };
}

module.exports = {
  REFRESH_COOKIE_NAME,
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshCookieOptions,
};
