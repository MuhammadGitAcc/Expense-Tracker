'use strict';

const logger = require('../config/logger');
const recurringGenerator = require('../services/recurringGenerator.service');

/** Create today's due recurring transactions. Never throws: a job must not crash the server. */
async function run() {
  try {
    const summary = await recurringGenerator.generateDue();
    logger.info('Recurring job finished', summary);
    return summary;
  } catch (err) {
    logger.error('Recurring job failed', { error: err.message, stack: err.stack });
    return null;
  }
}

module.exports = { name: 'recurring-transactions', schedule: '5 0 * * *', run };
