'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Allow only some roles. Always place it after authenticate.
 *
 *   router.get('/admin/stats', authenticate, authorize('admin'), controller.stats);
 */
const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };

module.exports = { authorize };
