'use strict';

const os = require('os');
const path = require('path');

// Load backend/.env here so TEST_DATABASE_URL is known before src/config/env.js runs.
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set in backend/.env. The tests need their own database.',
  );
}
// Safety net: the integration tests delete every user, so never run them on a normal database.
if (!testDatabaseUrl.split('?')[0].endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a database whose name ends with "_test".');
}

// These are set BEFORE src/config/env.js reads the environment (dotenv never overrides them).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl;
process.env.LOG_LEVEL = 'error';
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.MAX_UPLOAD_MB = '1';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'expense-tracker-test-uploads');
// An empty SMTP host guarantees tests never send a real email.
process.env.SMTP_HOST = '';
