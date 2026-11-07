'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const userRepository = require('../repositories/user.repository');

/**
 * Protects a route. Reads "Authorization: Bearer <token>", verifies it, loads the user
 * from the database and puts it on req.user. The database lookup means a deleted account
 * is locked out immediately instead of staying valid until its token expires.
 *
 *   router.get('/me', authenticate, controller.getMe);
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw ApiError.unauthorized('Authentication required');
  }

  const payload = verifyAccessToken(token);
  const user = await userRepository.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');

  req.user = user;
  return next();
});

module.exports = { authenticate };
