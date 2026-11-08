'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');
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

/** Register through the real endpoint. Resolves the user, the access token and the refresh cookie. */
async function registerUser(overrides = {}) {
  const payload = { ...DEFAULT_USER, ...overrides };
  const res = await api().post(url('/auth/register')).send(payload);
  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    payload,
    user: res.body.data.user,
    accessToken: res.body.data.accessToken,
    cookie: refreshCookie(res),
  };
}

const resetDatabase = () => db.query('TRUNCATE TABLE users CASCADE');
const closeDatabase = () => db.close();

module.exports = {
  DEFAULT_USER,
  api,
  url,
  authHeader,
  refreshCookie,
  registerUser,
  resetDatabase,
  closeDatabase,
};
