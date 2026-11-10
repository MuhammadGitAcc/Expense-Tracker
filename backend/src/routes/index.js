'use strict';

const { Router } = require('express');
const db = require('../config/db');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');

const router = Router();

/**
 * GET /api/v1/health
 * 200 when the API and database are up, 503 when the database cannot be reached.
 */
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const database = await db.checkHealth();
    const data = {
      status: database.ok ? 'ok' : 'degraded',
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        status: database.ok ? 'up' : 'down',
        latencyMs: database.latencyMs === null ? null : Number(database.latencyMs.toFixed(2)),
      },
    };
    if (!database.ok) {
      return res.status(503).json(ApiResponse.body(false, 'Database unavailable', data));
    }
    return ApiResponse.success(res, { message: 'OK', data });
  }),
);

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/categories', require('./category.routes'));
router.use('/accounts', require('./account.routes'));
router.use('/expenses', require('./expense.routes'));
router.use('/incomes', require('./income.routes'));
router.use('/budgets', require('./budget.routes'));
router.use('/recurring', require('./recurring.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/reports', require('./report.routes'));
router.use('/notifications', require('./notification.routes'));

// Feature routers are mounted here as their phases are built, for example:
//   router.use('/expenses', require('./expense.routes')); (Phase 4)

module.exports = router;
