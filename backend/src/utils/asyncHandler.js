'use strict';

/**
 * Wraps an async controller so a rejected promise reaches the error middleware.
 * Express 5 already does this for async handlers; the wrapper stays so intent is explicit
 * and the code keeps working if it is ever reused with another router.
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
