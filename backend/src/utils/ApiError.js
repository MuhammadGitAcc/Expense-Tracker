'use strict';

/**
 * An error we expected and know how to describe to the client.
 * Throw it anywhere (service, middleware); the central error handler turns it into JSON.
 *   throw ApiError.notFound('Expense not found');
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null, code = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details; // optional, e.g. field-level validation errors
    this.code = code; // optional machine-readable code, e.g. 'EMAIL_NOT_VERIFIED'
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have permission to do this') {
    return new ApiError(403, message);
  }
  static emailNotVerified(message = 'Please verify your email address first') {
    return new ApiError(403, message, null, 'EMAIL_NOT_VERIFIED');
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }
  static conflict(message = 'Conflict', details) {
    return new ApiError(409, message, details);
  }
  static tooManyRequests(message = 'Too many requests, please try again later') {
    return new ApiError(429, message);
  }
  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
