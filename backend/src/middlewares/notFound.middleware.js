'use strict';

const ApiError = require('../utils/ApiError');

/** Runs when no route matched. Must be registered after all routes. */
const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

module.exports = notFound;
