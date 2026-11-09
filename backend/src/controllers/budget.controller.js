'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const budgetService = require('../services/budget.service');

const list = asyncHandler(async (req, res) => {
  const { budgets, month, year } = await budgetService.list(req.user.id, req.validatedQuery);
  return ApiResponse.success(res, {
    data: { budgets },
    meta: { month, year, total: budgets.length },
  });
});

const getOne = asyncHandler(async (req, res) => {
  const budget = await budgetService.getById(req.user.id, req.params.id);
  return ApiResponse.success(res, { data: { budget } });
});

const create = asyncHandler(async (req, res) => {
  const budget = await budgetService.create(req.user.id, req.body);
  return ApiResponse.created(res, { message: 'Budget created', data: { budget } });
});

const update = asyncHandler(async (req, res) => {
  const budget = await budgetService.update(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, { message: 'Budget updated', data: { budget } });
});

const remove = asyncHandler(async (req, res) => {
  await budgetService.remove(req.user.id, req.params.id);
  return ApiResponse.success(res, { message: 'Budget deleted' });
});

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
};
