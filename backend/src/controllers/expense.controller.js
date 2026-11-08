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

module.exports = { list, getOne, create, update, remove };
