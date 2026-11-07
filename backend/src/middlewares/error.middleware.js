'use strict';

const { ZodError } = require('zod');
const env = require('../config/env');
const logger = require('../config/logger');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

/** Convert any thrown value into { status, message, details }. */
function normalize(err) {
  if (err instanceof ApiError) {
    return { status: err.statusCode, message: err.message, details: err.details };
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return { status: 400, message: 'Validation failed', details };
  }

  if (err.isCors) {
    return { status: 403, message: 'Origin not allowed', details: null };
  }

  // Malformed JSON / body too large (from express.json)
  if (err.type === 'entity.parse.failed') {
    return { status: 400, message: 'Request body is not valid JSON', details: null };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, message: 'Request body is too large', details: null };
  }

  // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
  switch (err.code) {
    case '23505':
      return { status: 409, message: 'A record with these values already exists', details: null };
    case '23503':
      return {
        status: 409,
        message: 'This record is linked to other data and cannot be changed or removed',
        details: null,
      };
    case '23502':
    case '23514':
    case '22P02': // invalid input syntax (for example a malformed UUID)
    case '22003': // numeric out of range
    case '22007': // invalid date
    case '22008':
      return { status: 400, message: 'Invalid data', details: null };
    default:
  }

  return { status: err.statusCode || err.status || 500, message: err.message, details: null };
}

function errorMiddleware(err, req, res, _next) {
  const { status, message, details } = normalize(err);
  const isServerError = status >= 500;

  const context = { method: req.method, url: req.originalUrl, status };
  if (isServerError) logger.error(err.message, { ...context, stack: err.stack });
  else logger.warn(message, context);

  const payload = ApiResponse.body(
    false,
    // Never leak internal error text for 5xx in production.
    isServerError && env.isProduction ? 'Internal server error' : message,
    null,
    null,
  );
  if (details) payload.errors = details;
  if (isServerError && !env.isProduction) payload.stack = err.stack;

  if (res.headersSent) return res.end();
  return res.status(status).json(payload);
}

module.exports = errorMiddleware;
