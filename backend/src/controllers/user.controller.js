'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const userService = require('../services/user.service');
const { REFRESH_COOKIE_NAME, refreshCookieOptions } = require('../utils/jwt');

const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());

const getMe = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { data: { user: req.user } }),
);

const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  return ApiResponse.success(res, { message: 'Profile updated', data: { user } });
});

const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.user.id, req.body);
  clearRefreshCookie(res);
  return ApiResponse.success(res, {
    message: 'Password changed. Please log in again on all your devices',
  });
});

const uploadAvatar = asyncHandler(async (req, res) => {
  const user = await userService.updateAvatar(req.user.id, req.file);
  return ApiResponse.success(res, { message: 'Avatar updated', data: { user } });
});

const deleteMe = asyncHandler(async (req, res) => {
  await userService.deleteAccount(req.user.id, req.body);
  clearRefreshCookie(res);
  return ApiResponse.success(res, { message: 'Account deleted' });
});

module.exports = { getMe, updateMe, changePassword, uploadAvatar, deleteMe };
