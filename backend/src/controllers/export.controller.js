'use strict';

const asyncHandler = require('../utils/asyncHandler');
const exportService = require('../services/export.service');

/** Send a generated file as a download. Private data: it must never be cached. */
const sendFile = (res, { buffer, contentType, filename }) => {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(buffer);
};

const expenses = asyncHandler(async (req, res) => {
  const file = await exportService.exportExpenses(req.user.id, req.validatedQuery);
  return sendFile(res, file);
});

module.exports = { expenses };
