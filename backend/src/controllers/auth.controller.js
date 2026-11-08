'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const authService = require('../services/auth.service');
const { REFRESH_COOKIE_NAME, refreshCookieOptions } = require('../utils/jwt');

const setRefreshCookie = (res, token) =>
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());

// The options (especially path) must match the ones used to set the cookie.
const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());

// No tokens and no cookie here: the user must confirm the email code first.
const register = asyncHandler(async (req, res) => {
  const { user, expiresInMinutes } = await authService.register(req.body);
  return ApiResponse.created(res, {
    message: 'Account created. Check your email for a 6-digit code',
    data: { email: user.email, expiresInMinutes },
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.verifyEmail(req.body);
  setRefreshCookie(res, refreshToken);
  return ApiResponse.success(res, { message: 'Email verified', data: { user, accessToken } });
});

const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.body);
  return ApiResponse.success(res, {
    message: 'If the account exists and is not verified yet, a new code has been sent',
  });
});

const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  return ApiResponse.success(res, { message: 'Logged in', data: { user, accessToken } });
});

const refresh = asyncHandler(async (req, res) => {
  try {
    const { user, accessToken, refreshToken } = await authService.refresh(
      req.cookies?.[REFRESH_COOKIE_NAME],
    );
    setRefreshCookie(res, refreshToken);
    return ApiResponse.success(res, { message: 'Token refreshed', data: { user, accessToken } });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE_NAME]);
  clearRefreshCookie(res);
  return ApiResponse.success(res, { message: 'Logged out' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body);
  return ApiResponse.success(res, {
    message: 'If an account with that email exists, a reset link has been sent',
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  clearRefreshCookie(res);
  return ApiResponse.success(res, {
    message: 'Password updated. Please log in with your new password',
  });
});

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
