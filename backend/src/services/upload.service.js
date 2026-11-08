'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

// Relative paths are resolved from the backend folder, whatever folder the server starts in.
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', env.upload.dir);
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');
const AVATAR_URL_PREFIX = '/uploads/avatars/';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Look at the first bytes of the file and return 'jpg', 'png' or 'webp', or null.
 * The file name and the Content-Type sent by the client are never trusted.
 */
function detectImageExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/** Save an uploaded avatar (multer memory file). Resolves the public path to store in the database. */
async function saveAvatar(userId, file) {
  const extension = detectImageExtension(file.buffer);
  if (!extension) throw ApiError.badRequest('Only JPEG, PNG or WebP images are allowed');

  await fs.mkdir(AVATAR_DIR, { recursive: true });
  const filename = `${userId}-${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(AVATAR_DIR, filename), file.buffer, { flag: 'wx' });
  return `${AVATAR_URL_PREFIX}${filename}`;
}

/** Delete a stored avatar file. Never throws: a leftover file is not worth failing a request. */
async function deleteAvatarFile(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith(AVATAR_URL_PREFIX)) return;
  const filename = path.basename(avatarUrl);
  try {
    await fs.unlink(path.join(AVATAR_DIR, filename));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn('Could not delete avatar file', { filename, error: err.message });
    }
  }
}

module.exports = { UPLOAD_ROOT, saveAvatar, deleteAvatarFile };
