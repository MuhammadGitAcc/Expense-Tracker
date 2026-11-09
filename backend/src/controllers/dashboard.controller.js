'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const dashboardService = require('../services/dashboard.service');

const summary = asyncHandler(async (req, res) => {
  const { data, meta } = await dashboardService.summary(req.user, req.validatedQuery);
  return ApiResponse.success(res, { data, meta });
});

const trends = asyncHandler(async (req, res) => {
  const { data, meta } = await dashboardService.trends(req.user, req.validatedQuery);
  return ApiResponse.success(res, { data, meta });
});

module.exports = { summary, trends };
