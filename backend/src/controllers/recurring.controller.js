'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const recurringService = require('../services/recurring.service');

const list = asyncHandler(async (req, res) => {
  const { recurringTransactions } = await recurringService.list(req.user.id, req.validatedQuery);
  return ApiResponse.success(res, {
    data: { recurringTransactions },
    meta: { total: recurringTransactions.length },
  });
});

const getOne = asyncHandler(async (req, res) => {
  const recurring = await recurringService.getById(req.user.id, req.params.id);
  return ApiResponse.success(res, { data: { recurring } });
});

const create = asyncHandler(async (req, res) => {
  const recurring = await recurringService.create(req.user.id, req.body);
  return ApiResponse.created(res, {
    message: 'Recurring transaction created',
    data: { recurring },
  });
});

const update = asyncHandler(async (req, res) => {
  const recurring = await recurringService.update(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, {
    message: 'Recurring transaction updated',
    data: { recurring },
  });
});

const pause = asyncHandler(async (req, res) => {
  const recurring = await recurringService.setActive(req.user.id, req.params.id, false);
  return ApiResponse.success(res, {
    message: 'Recurring transaction paused',
    data: { recurring },
  });
});

const resume = asyncHandler(async (req, res) => {
  const recurring = await recurringService.setActive(req.user.id, req.params.id, true);
  return ApiResponse.success(res, {
    message: 'Recurring transaction resumed',
    data: { recurring },
  });
});

const remove = asyncHandler(async (req, res) => {
  await recurringService.remove(req.user.id, req.params.id);
  return ApiResponse.success(res, { message: 'Recurring transaction deleted' });
});

module.exports = {
  list,
  getOne,
  create,
  update,
  pause,
  resume,
  remove,
};
