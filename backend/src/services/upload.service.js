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
// Receipts are private financial documents: they are NOT served as static files. They are
// only sent by GET /expenses/:id/receipt after an ownership check.
const RECEIPT_DIR = path.join(UPLOAD_ROOT, 'receipts');

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

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');

/** Like detectImageExtension, but PDF is allowed too. Resolves 'jpg', 'png', 'webp', 'pdf' or null. */
function detectReceiptExtension(buffer) {
  const image = detectImageExtension(buffer);
  if (image) return image;
  if (buffer.length >= 5 && buffer.subarray(0, 5).equals(PDF_SIGNATURE)) return 'pdf';
  return null;
}

/**
 * Save an uploaded receipt (multer memory file) after checking its real content.
 * Resolves the stored file NAME ("<userId>-<uuid>.<ext>"), not a public URL.
 */
async function saveReceipt(userId, file) {
  const extension = detectReceiptExtension(file.buffer);
  if (!extension) throw ApiError.badRequest('Only JPEG, PNG, WebP or PDF files are allowed');

  await fs.mkdir(RECEIPT_DIR, { recursive: true });
  const filename = `${userId}-${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(RECEIPT_DIR, filename), file.buffer, { flag: 'wx' });
  return filename;
}

/** Delete a stored receipt file. Never throws: a leftover file is not worth failing a request. */
async function deleteReceiptFile(filename) {
  if (!filename) return;
  const safeName = path.basename(filename);
  try {
    await fs.unlink(path.join(RECEIPT_DIR, safeName));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn('Could not delete receipt file', { filename: safeName, error: err.message });
    }
  }
}

/** Absolute path of a stored receipt, or null when the file is missing on disk. */
async function resolveReceiptFile(filename) {
  if (!filename) return null;
  const fullPath = path.join(RECEIPT_DIR, path.basename(filename));
  try {
    await fs.access(fullPath);
    return fullPath;
  } catch {
    return null;
  }
}

/** Delete every receipt file of a user (used when the account is deleted). Never throws. */
async function deleteAllReceiptsOfUser(userId) {
  let names;
  try {
    names = await fs.readdir(RECEIPT_DIR);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn('Could not list receipt files', { error: err.message });
    }
    return;
  }
  await Promise.all(
    names.filter((name) => name.startsWith(`${userId}-`)).map((name) => deleteReceiptFile(name)),
  );
}

module.exports = {
  UPLOAD_ROOT,
  AVATAR_DIR,
  saveAvatar,
  deleteAvatarFile,
  saveReceipt,
  deleteReceiptFile,
  resolveReceiptFile,
  deleteAllReceiptsOfUser,
};
