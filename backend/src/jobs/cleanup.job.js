'use strict';

const logger = require('../config/logger');
const cleanupService = require('../services/cleanup.service');

/** Daily housekeeping. Never throws: a job must not crash the server. */
async function run() {
  try {
    const summary = await cleanupService.runCleanup();
    logger.info('Cleanup job finished', summary);
    return summary;
  } catch (err) {
    logger.error('Cleanup job failed', { error: err.message, stack: err.stack });
    return null;
  }
}

module.exports = { name: 'cleanup', schedule: '30 3 * * *', run };
