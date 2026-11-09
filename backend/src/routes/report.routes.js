'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const reportController = require('../controllers/report.controller');
const {
  monthlyReportQuerySchema,
  yearlyReportQuerySchema,
  byCategoryQuerySchema,
  byAccountQuerySchema,
} = require('../validators/insights.validator');

const router = Router();

router.use(authenticate);

router.get('/monthly', validate({ query: monthlyReportQuerySchema }), reportController.monthly);
router.get('/yearly', validate({ query: yearlyReportQuerySchema }), reportController.yearly);
router.get('/by-category', validate({ query: byCategoryQuerySchema }), reportController.byCategory);
router.get('/by-account', validate({ query: byAccountQuerySchema }), reportController.byAccount);

module.exports = router;
