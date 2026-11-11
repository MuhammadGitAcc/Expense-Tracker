'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { exportLimiter } = require('../middlewares/rateLimit.middleware');
const exportController = require('../controllers/export.controller');
const { exportExpensesQuerySchema } = require('../validators/export.validator');

const router = Router();

router.use(authenticate);

// GET /exports/expenses?format=csv|xlsx|pdf plus the same filters as GET /expenses
router.get(
  '/expenses',
  exportLimiter,
  validate({ query: exportExpensesQuerySchema }),
  exportController.expenses,
);

module.exports = router;
