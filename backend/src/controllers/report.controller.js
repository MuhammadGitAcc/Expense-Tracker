'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const reportService = require('../services/report.service');

const handler = (serviceFn) =>
  asyncHandler(async (req, res) => {
    const { data, meta } = await serviceFn(req.user, req.validatedQuery);
    return ApiResponse.success(res, { data, meta });
  });

module.exports = {
  monthly: handler(reportService.monthly),
  yearly: handler(reportService.yearly),
  byCategory: handler(reportService.byCategory),
  byAccount: handler(reportService.byAccount),
};
