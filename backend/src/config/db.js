'use strict';

const { Pool, types } = require('pg');

// DATE columns (transaction dates) come back as "YYYY-MM-DD" strings, not JavaScript Dates,
// which the server time zone would shift. NUMERIC already stays a string: never a float.
types.setTypeParser(types.builtins.DATE, (value) => value);
const env = require('./env');
const logger = require('./logger');

const pool = new Pool({
  connectionString: env.db.url,
  max: env.db.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// An idle client can error (for example when the database restarts). Log it, do not crash.
pool.on('error', (err) => logger.error('Unexpected PostgreSQL pool error', { error: err.message }));

/** Run one parameterized query. Always pass values in `params`, never build SQL from input. */
const query = (text, params) => pool.query(text, params);

/**
 * Run several queries atomically (used from Phase 4 for balance updates).
 *   await withTransaction(async (client) => { await client.query(...); ... });
 * Commits when the callback resolves, rolls back when it throws.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Resolves { ok, latencyMs } and never throws, so the health endpoint can report failure. */
async function checkHealth() {
  const start = process.hrtime.bigint();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Number(process.hrtime.bigint() - start) / 1e6 };
  } catch (err) {
    logger.error('Database health check failed', { error: err.message });
    return { ok: false, latencyMs: null };
  }
}

const close = () => pool.end();

module.exports = { pool, query, withTransaction, checkHealth, close };
