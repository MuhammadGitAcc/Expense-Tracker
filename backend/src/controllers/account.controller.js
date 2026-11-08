'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const accountService = require('../services/account.service');

const list = asyncHandler(async (req, res) => {
  const { accounts, totalsByCurrency } = await accountService.list(req.user.id, req.validatedQuery);
  return ApiResponse.success(res, {
    data: { accounts },
    meta: { total: accounts.length, totalsByCurrency },
  });
});

const getOne = asyncHandler(async (req, res) => {
  const account = await accountService.getById(req.user.id, req.params.id);
  return ApiResponse.success(res, { data: { account } });
});

const create = asyncHandler(async (req, res) => {
  const account = await accountService.create(req.user, req.body);
  return ApiResponse.created(res, { message: 'Account created', data: { account } });
});

const update = asyncHandler(async (req, res) => {
  const account = await accountService.update(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, { message: 'Account updated', data: { account } });
});

const archive = asyncHandler(async (req, res) => {
  const account = await accountService.setArchived(req.user.id, req.params.id, true);
  return ApiResponse.success(res, { message: 'Account archived', data: { account } });
});

const unarchive = asyncHandler(async (req, res) => {
  const account = await accountService.setArchived(req.user.id, req.params.id, false);
  return ApiResponse.success(res, { message: 'Account restored', data: { account } });
});

const remove = asyncHandler(async (req, res) => {
  await accountService.remove(req.user.id, req.params.id);
  return ApiResponse.success(res, { message: 'Account deleted' });
});

const transfer = asyncHandler(async (req, res) => {
  const result = await accountService.transfer(req.user.id, req.body);
  return ApiResponse.created(res, { message: 'Transfer completed', data: result });
});

const listTransfers = asyncHandler(async (req, res) => {
  const { transfers, meta } = await accountService.listTransfers(req.user.id, req.validatedQuery);
  return ApiResponse.paginated(res, { data: { transfers }, meta });
});

module.exports = {
  list,
  getOne,
  create,
  update,
  archive,
  unarchive,
  remove,
  transfer,
  listTransfers,
};
