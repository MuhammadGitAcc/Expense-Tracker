'use strict';

/**
 * Migration runner.
 *
 *   npm run migrate                 apply all pending migrations
 *   node database/migrate.js --status   show applied / pending migrations
 *   node database/migrate.js --reset    DROP everything, then re-apply (development only)
 *
 * Each .sql file in database/migrations runs in its own transaction, in filename order,
 * and is recorded in the schema_migrations table with a checksum. If an applied file is
 * edited afterwards the runner stops: create a new migration instead of editing old ones.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const LOCK_ID = 727001; // arbitrary number; stops two runners migrating at once

const checksum = (sql) => crypto.createHash('sha256').update(sql).digest('hex');

function readMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      return { file, sql, checksum: checksum(sql) };
    });
}

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      checksum   CHAR(64)     NOT NULL,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(client) {
  const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations');
  return new Map(rows.map((r) => [r.filename, r.checksum]));
}

async function reset(client) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to --reset when NODE_ENV=production.');
  }
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  console.log('Schema dropped and recreated.');
}

async function status(client) {
  await ensureTrackingTable(client);
  const applied = await getApplied(client);
  for (const m of readMigrations()) {
    const state = !applied.has(m.file)
      ? 'pending'
      : applied.get(m.file) === m.checksum
        ? 'applied'
        : 'MODIFIED';
    console.log(`${state.padEnd(8)} ${m.file}`);
  }
}

async function up(client) {
  await ensureTrackingTable(client);
  const applied = await getApplied(client);
  const migrations = readMigrations();

  for (const m of migrations) {
    if (applied.has(m.file) && applied.get(m.file) !== m.checksum) {
      throw new Error(
        `${m.file} was already applied but has changed. Never edit an applied migration; add a new one.`,
      );
    }
  }

  const pending = migrations.filter((m) => !applied.has(m.file));
  if (pending.length === 0) {
    console.log('Database is up to date. Nothing to migrate.');
    return;
  }

  for (const m of pending) {
    try {
      await client.query('BEGIN');
      await client.query(m.sql);
      await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [
        m.file,
        m.checksum,
      ]);
      await client.query('COMMIT');
      console.log(`applied  ${m.file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      err.message = `Migration ${m.file} failed (rolled back): ${err.message}`;
      throw err;
    }
  }
  console.log(`Done. ${pending.length} migration(s) applied.`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Check backend/.env');
  }
  const args = process.argv.slice(2);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    if (args.includes('--reset')) await reset(client);
    if (args.includes('--status')) await status(client);
    else await up(client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
