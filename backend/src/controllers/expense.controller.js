'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const expenseService = require('../services/expense.service');

const list = asyncHandler(async (req, res) => {
  const { expenses, meta } = await expenseService.list(req.user.id, req.validatedQuery);
  return ApiResponse.paginated(res, { data: { expenses }, meta });
});

const getOne = asyncHandler(async (req, res) => {
  const expense = await expenseService.getById(req.user.id, req.params.id);
  return ApiResponse.success(res, { data: { expense } });
});

const create = asyncHandler(async (req, res) => {
  const result = await expenseService.create(req.user.id, req.body);
  return ApiResponse.created(res, { message: 'Expense added', data: result });
});

const update = asyncHandler(async (req, res) => {
  const result = await expenseService.update(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, { message: 'Expense updated', data: result });
});

const remove = asyncHandler(async (req, res) => {
  const result = await expenseService.remove(req.user.id, req.params.id);
  return ApiResponse.success(res, { message: 'Expense deleted', data: result });
});

const uploadReceipt = asyncHandler(async (req, res) => {
  const expense = await expenseService.attachReceipt(req.user.id, req.params.id, req.file);
  return ApiResponse.success(res, { message: 'Receipt saved', data: { expense } });
});

const removeReceipt = asyncHandler(async (req, res) => {
  const expense = await expenseService.removeReceipt(req.user.id, req.params.id);
  return ApiResponse.success(res, { message: 'Receipt removed', data: { expense } });
});

// Sends the file itself, only to its owner. private: shared caches must not keep it.
const downloadReceipt = asyncHandler(async (req, res) => {
  const filePath = await expenseService.getReceiptPath(req.user.id, req.params.id);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(filePath);
});

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  uploadReceipt,
  removeReceipt,
  downloadReceipt,
};
