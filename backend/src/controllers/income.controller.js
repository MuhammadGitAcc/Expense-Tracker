'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const incomeService = require('../services/income.service');

const list = asyncHandler(async (req, res) => {
  const { incomes, meta } = await incomeService.list(req.user.id, req.validatedQuery);
  return ApiResponse.paginated(res, { data: { incomes }, meta });
});

const getOne = asyncHandler(async (req, res) => {
  const income = await incomeService.getById(req.user.id, req.params.id);
  return ApiResponse.success(res, { data: { income } });
});

const create = asyncHandler(async (req, res) => {
  const result = await incomeService.create(req.user.id, req.body);
  return ApiResponse.created(res, { message: 'Income added', data: result });
});

const update = asyncHandler(async (req, res) => {
  const result = await incomeService.update(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, { message: 'Income updated', data: result });
});

const remove = asyncHandler(async (req, res) => {
  const result = await incomeService.remove(req.user.id, req.params.id);
  return ApiResponse.success(res, { message: 'Income deleted', data: result });
});

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
};
