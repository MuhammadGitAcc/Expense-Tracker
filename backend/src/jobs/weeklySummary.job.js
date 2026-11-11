'use strict';

const logger = require('../config/logger');
const weeklySummaryService = require('../services/weeklySummary.service');

/**
 * Send the summary of the last full week (Monday to Sunday). Scheduled for Monday 08:00 UTC.
 * Running it on another day (the start-up run) is harmless: each user gets each week once.
 * Never throws: a job must not crash the server.
 */
async function run() {
  try {
    const summary = await weeklySummaryService.sendAll();
    logger.info('Weekly summary job finished', summary);
    return summary;
  } catch (err) {
    logger.error('Weekly summary job failed', { error: err.message, stack: err.stack });
    return null;
  }
}

module.exports = { name: 'weekly-summary', schedule: '0 8 * * 1', run };
