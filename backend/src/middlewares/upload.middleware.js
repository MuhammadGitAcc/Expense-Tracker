'use strict';

const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// Files are held in memory (limited by maxMb) and written to disk by upload.service.js
// only after their content has been checked.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxMb * 1024 * 1024, files: 1 },
});

/**
 * Accepts ONE image in the form field "avatar" and puts it on req.file.
 * Multer's own errors are turned into clean 400 responses.
 */
const uploadAvatar = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest(`The image must be at most ${env.upload.maxMb} MB`));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(ApiError.badRequest('Send exactly one image in the form field "avatar"'));
      }
      return next(ApiError.badRequest('Invalid upload'));
    }
    return next(err);
  });
};

/**
 * Accepts ONE file (an image or a PDF) in the form field "receipt" and puts it on req.file.
 * Multer's own errors are turned into clean 400 responses.
 */
const uploadReceipt = (req, res, next) => {
  upload.single('receipt')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest(`The file must be at most ${env.upload.maxMb} MB`));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(ApiError.badRequest('Send exactly one file in the form field "receipt"'));
      }
      return next(ApiError.badRequest('Invalid upload'));
    }
    return next(err);
  });
};

module.exports = { uploadAvatar, uploadReceipt };
