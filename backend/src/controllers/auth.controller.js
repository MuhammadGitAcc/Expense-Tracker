'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const authService = require('../services/auth.service');
const { REFRESH_COOKIE_NAME, refreshCookieOptions } = require('../utils/jwt');

const setRefreshCookie = (res, token) =>
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());

// The options (especially path) must match the ones used to set the cookie.
const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());

const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  setRefreshCookie(res, refreshToken);
  return ApiResponse.created(res, { message: 'Account created', data: { user, accessToken } });
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

module.exports = { register, login, refresh, logout };
