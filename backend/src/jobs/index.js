'use strict';

const cron = require('node-cron');
const logger = require('../config/logger');

// Add each job here as it is built (budgetAlerts 5.3, weeklySummary 5.4, cleanup 5.6).
// ORDER MATTERS: the recurring job runs first, so the budget check sees the expenses it creates.
const jobs = [
  require('./recurringTransactions.job'),
  require('./budgetAlerts.job'),
  require('./weeklySummary.job'),
  require('./cleanup.job'),
];

let tasks = [];

/**
 * Schedule every job and run each one once right away, so a day missed while the server was
 * off is caught up. Dates in this app are UTC calendar dates, so the schedule uses UTC too.
 * Called from server.js only (never from app.js, so the tests start no timers).
 */
function startJobs() {
  tasks = jobs.map((job) => {
    const task = cron.schedule(job.schedule, () => job.run(), {
      name: job.name,
      timezone: 'UTC',
      noOverlap: true,
    });
    logger.info(`Job scheduled: ${job.name} (${job.schedule} UTC)`);
    return task;
  });
  // One after another (not at the same time) because of the order explained above.
  (async () => {
    for (const job of jobs) {
      await job.run();
    }
  })();
}

async function stopJobs() {
  await Promise.all(tasks.map((task) => task.destroy()));
  tasks = [];
}

module.exports = { startJobs, stopJobs };
