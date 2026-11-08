'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');
const emailService = require('../src/services/email.service');
const { REFRESH_COOKIE_NAME } = require('../src/utils/jwt');

const DEFAULT_USER = { name: 'Test User', email: 'test@example.com', password: 'Test@12345' };

const api = () => request(app);
const url = (route) => `${env.apiPrefix}${route}`;
const authHeader = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });

/** The "refreshToken=..." part of a response's Set-Cookie header, ready to send back as Cookie. */
function refreshCookie(res) {
  const cookies = res.headers['set-cookie'] || [];
  const found = cookies.find((cookie) => cookie.startsWith(`${REFRESH_COOKIE_NAME}=`));
  return found ? found.split(';')[0] : null;
}

/**
 * Register through the real endpoint WITHOUT verifying the email. The 6-digit code that
 * would have been emailed is captured from the email service (nothing is sent).
 * Resolves { payload, res, code }.
 */
async function registerUnverified(overrides = {}) {
  const payload = { ...DEFAULT_USER, ...overrides };
  const spy = jest.spyOn(emailService, 'sendVerificationEmail').mockResolvedValue(true);
  try {
    const res = await api().post(url('/auth/register')).send(payload);
    if (res.status !== 201) {
      throw new Error(`registerUnverified failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    return { payload, res, code: lastCall ? lastCall[0].code : null };
  } finally {
    spy.mockRestore();
  }
}

const verifyEmail = (email, code) => api().post(url('/auth/verify-email')).send({ email, code });

/**
 * Register AND verify, like a real sign-up. Resolves the user, the access token and the
 * refresh cookie.
 */
async function registerUser(overrides = {}) {
  const { payload, code } = await registerUnverified(overrides);
  const res = await verifyEmail(payload.email, code);
  if (res.status !== 200) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    payload,
    user: res.body.data.user,
    accessToken: res.body.data.accessToken,
    cookie: refreshCookie(res),
  };
}

/** Pretend every code was created `seconds` ago (gets past the 60 second resend cooldown). */
const ageVerificationCodes = (seconds) =>
  db.query("UPDATE email_verification_codes SET created_at = NOW() - ($1 * INTERVAL '1 second')", [
    seconds,
  ]);

/** Make every code expired. */
const expireVerificationCodes = () =>
  db.query("UPDATE email_verification_codes SET expires_at = NOW() - INTERVAL '1 minute'");

const resetDatabase = () => db.query('TRUNCATE TABLE users CASCADE');

/** TRUNCATE ... CASCADE also empties categories (it references users), so put two defaults back. */
const seedDefaultCategories = () =>
  db.query(
    `INSERT INTO categories (user_id, name, type, icon, color, is_default) VALUES
       (NULL, 'Food',   'expense', 'utensils',  '#F97316', TRUE),
       (NULL, 'Salary', 'income',  'briefcase', '#16A34A', TRUE)
     ON CONFLICT (type, LOWER(name)) WHERE user_id IS NULL DO NOTHING`,
  );
const closeDatabase = () => db.close();

module.exports = {
  DEFAULT_USER,
  api,
  url,
  authHeader,
  refreshCookie,
  registerUnverified,
  registerUser,
  verifyEmail,
  ageVerificationCodes,
  expireVerificationCodes,
  resetDatabase,
  seedDefaultCategories,
  closeDatabase,
};
