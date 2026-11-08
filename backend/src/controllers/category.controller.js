'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const categoryService = require('../services/category.service');

const list = asyncHandler(async (req, res) => {
  const categories = await categoryService.list(req.user.id, req.validatedQuery);
  return ApiResponse.success(res, { data: { categories }, meta: { total: categories.length } });
});

const getOne = asyncHandler(async (req, res) => {
  const category = await categoryService.getById(req.user.id, req.params.id);
  return ApiResponse.success(res, { data: { category } });
});

const create = asyncHandler(async (req, res) => {
  const category = await categoryService.create(req.user.id, req.body);
  return ApiResponse.created(res, { message: 'Category created', data: { category } });
});

const update = asyncHandler(async (req, res) => {
  const category = await categoryService.update(req.user.id, req.params.id, req.body);
  return ApiResponse.success(res, { message: 'Category updated', data: { category } });
});

const remove = asyncHandler(async (req, res) => {
  await categoryService.remove(req.user.id, req.params.id);
  return ApiResponse.success(res, { message: 'Category deleted' });
});

module.exports = { list, getOne, create, update, remove };
