'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');
const { summaryQuerySchema, trendsQuerySchema } = require('../validators/insights.validator');

const router = Router();

router.use(authenticate);

router.get('/summary', validate({ query: summaryQuerySchema }), dashboardController.summary);
router.get('/trends', validate({ query: trendsQuerySchema }), dashboardController.trends);

module.exports = router;
