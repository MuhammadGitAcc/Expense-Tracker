'use strict';

const logger = require('../config/logger');
const budgetAlertService = require('../services/budgetAlert.service');

/** Check this month's budgets of every user. Never throws: a job must not crash the server. */
async function run() {
  try {
    const summary = await budgetAlertService.checkAll();
    logger.info('Budget alerts job finished', summary);
    return summary;
  } catch (err) {
    logger.error('Budget alerts job failed', { error: err.message, stack: err.stack });
    return null;
  }
}

module.exports = { name: 'budget-alerts', schedule: '10 0 * * *', run };
