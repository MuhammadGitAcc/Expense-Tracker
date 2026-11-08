'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const userRepository = require('../repositories/user.repository');
const refreshTokenRepository = require('../repositories/refreshToken.repository');
const uploadService = require('./upload.service');
const { hashPassword, comparePassword } = require('../utils/hash');

/** `fields` was already whitelisted and validated (name, currency, language, theme). */
async function updateProfile(userId, fields) {
  const user = await userRepository.updateProfile(userId, fields);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/** Changes the password and logs the user out of every device. */
async function changePassword(userId, { currentPassword, newPassword }) {
  const found = await userRepository.findByIdWithPassword(userId);
  if (!found) throw ApiError.notFound('User not found');

  const matches = await comparePassword(currentPassword, found.passwordHash);
  if (!matches) throw ApiError.badRequest('Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  await db.withTransaction(async (client) => {
    await userRepository.updatePassword(userId, passwordHash, client);
    await refreshTokenRepository.revokeAllForUser(userId, client);
  });
}

/** Stores the new avatar, then removes the old file. Resolves the updated user. */
async function updateAvatar(userId, file) {
  if (!file) throw ApiError.badRequest('Choose an image to upload (form field name: avatar)');

  const previous = await userRepository.findById(userId);
  if (!previous) throw ApiError.notFound('User not found');

  const avatarUrl = await uploadService.saveAvatar(userId, file);
  try {
    const user = await userRepository.setAvatarUrl(userId, avatarUrl);
    if (!user) throw ApiError.notFound('User not found');
    await uploadService.deleteAvatarFile(previous.avatarUrl);
    return user;
  } catch (err) {
    await uploadService.deleteAvatarFile(avatarUrl);
    throw err;
  }
}

/** Deletes the account and, through the database cascade, everything the user owns. */
async function deleteAccount(userId, { password }) {
  const found = await userRepository.findByIdWithPassword(userId);
  if (!found) throw ApiError.notFound('User not found');

  const matches = await comparePassword(password, found.passwordHash);
  if (!matches) throw ApiError.badRequest('Password is incorrect');

  await userRepository.deleteById(userId);
  await uploadService.deleteAllReceiptsOfUser(userId);
  await uploadService.deleteAvatarFile(found.avatarUrl);
}

module.exports = { updateProfile, changePassword, updateAvatar, deleteAccount };
