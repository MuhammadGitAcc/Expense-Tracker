'use strict';

/**
 * Seed runner.
 *
 *   npm run seed                 default categories only (safe in any environment)
 *   npm run seed:demo            default categories + demo user and sample data
 *
 * Seed files are written to be re-runnable, so running them twice is harmless.
 * Demo data is refused when NODE_ENV=production.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const SEEDS_DIR = path.join(__dirname, 'seeds');
const DEMO_EMAIL = 'demo@expensetracker.local';
const DEMO_PASSWORD = 'Demo@12345';

const readSeed = (file) => fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');

async function runSeed(client, file, sql) {
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`seeded   ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    err.message = `Seed ${file} failed (rolled back): ${err.message}`;
    throw err;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Check backend/.env');
  }
  const withDemo = process.argv.includes('--demo');
  if (withDemo && process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data when NODE_ENV=production.');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await runSeed(client, '001_default_categories.sql', readSeed('001_default_categories.sql'));

    if (withDemo) {
      // The demo password is hashed here with the same bcrypt the app uses, then
      // inserted into the SQL as a safely quoted literal.
      const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
      const literal = (s) => `'${s.replace(/'/g, "''")}'`;
      const sql = readSeed('002_demo_data.sql')
        .replaceAll(':demo_password_hash', literal(hash))
        .replaceAll(':demo_email', literal(DEMO_EMAIL));
      await runSeed(client, '002_demo_data.sql', sql);
      console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
