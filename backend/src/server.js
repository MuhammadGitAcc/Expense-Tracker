'use strict';

const env = require('./config/env');
const logger = require('./config/logger');
const db = require('./config/db');
const app = require('./app');

async function start() {
  // Fail fast: do not accept traffic if the database is unreachable.
  const health = await db.checkHealth();
  if (!health.ok) {
    logger.error(
      'Cannot connect to PostgreSQL. Check DATABASE_URL in backend/.env and that the database is running.',
    );
    process.exit(1);
  }
  logger.info('PostgreSQL connection OK');

  const server = app.listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port}${env.apiPrefix} (${env.nodeEnv})`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down...`);
    // Safety net: force exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await db.close().catch(() => {});
      logger.info('Shutdown complete');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason?.stack || reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception, exiting', { error: err.message, stack: err.stack });
  process.exit(1);
});

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
