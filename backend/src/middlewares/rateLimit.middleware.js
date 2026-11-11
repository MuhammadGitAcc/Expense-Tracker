'use strict';

const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const handler = (_req, _res, next) => next(ApiError.tooManyRequests());

/** Applied to the whole API. */
const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
  skip: (req) => req.path.endsWith('/health'), // uptime monitors must never be blocked
});

/** Stricter limit for login/register/password endpoints (used from Phase 3). */
const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.authMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
});

/** Exports are heavy: a tenth of the normal API limit (30 per 15 minutes by default). */
const exportLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: Math.max(1, Math.floor(env.rateLimit.max / 10)),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
});

module.exports = { apiLimiter, authLimiter, exportLimiter };
