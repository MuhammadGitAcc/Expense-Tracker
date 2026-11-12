'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const env = require('../../src/config/env');

const API = env.apiPrefix;
const SOME_ID = '00000000-0000-0000-0000-000000000000';
const ISSUER = 'expense-tracker-api';

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('security headers', () => {
  it('hides the framework and sets the Helmet headers', async () => {
    const res = await request(app).get(`${API}/users/me`);

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('tells browsers and proxies not to keep API answers', async () => {
    const res = await request(app).get(`${API}/users/me`);

    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('CORS', () => {
  it('answers an allowed origin with the matching header', async () => {
    const origin = env.corsOrigins[0];
    const res = await request(app).get(`${API}/users/me`).set('Origin', origin);

    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects an unknown origin before any route runs', async () => {
    const res = await request(app).get(`${API}/users/me`).set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('blocks a cross-site call to the refresh endpoint', async () => {
    const res = await request(app)
      .post(`${API}/auth/refresh`)
      .set('Origin', 'https://evil.example')
      .set('Cookie', 'refreshToken=anything');

    expect(res.status).toBe(403);
  });
});

describe('protected routes', () => {
  const PROTECTED = [
    ['get', '/users/me'],
    ['put', '/users/me'],
    ['delete', '/users/me'],
    ['post', '/users/me/avatar'],
    ['get', '/categories'],
    ['get', '/accounts'],
    ['get', '/accounts/transfers'],
    ['get', '/expenses'],
    ['get', `/expenses/${SOME_ID}/receipt`],
    ['post', `/expenses/${SOME_ID}/receipt`],
    ['get', '/incomes'],
    ['get', '/budgets'],
    ['get', '/recurring'],
    ['get', '/dashboard/summary'],
    ['get', '/dashboard/trends'],
    ['get', '/reports/monthly'],
    ['get', '/reports/yearly'],
    ['get', '/notifications'],
    ['get', '/notifications/unread-count'],
    ['get', '/exports/expenses'],
  ];

  it.each(PROTECTED)('%s %s needs a login', async (method, route) => {
    const res = await request(app)[method](`${API}${route}`);

    expect(res.status).toBe(401);
  });
});

describe('access tokens', () => {
  const claims = { type: 'access' };
  const options = { subject: SOME_ID, issuer: ISSUER, algorithm: 'HS256' };

  it('rejects a token signed with another secret', async () => {
    const token = jwt.sign(claims, 'x'.repeat(40), { ...options, expiresIn: '5m' });
    const res = await request(app).get(`${API}/users/me`).set(bearer(token));

    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = jwt.sign(claims, env.jwt.accessSecret, { ...options, expiresIn: -60 });
    const res = await request(app).get(`${API}/users/me`).set(bearer(token));

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Access token expired');
  });

  it('rejects an unsigned token (alg "none")', async () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      sub: SOME_ID,
      iss: ISSUER,
      type: 'access',
      exp,
    })}.`;
    const res = await request(app).get(`${API}/users/me`).set(bearer(token));

    expect(res.status).toBe(401);
  });

  it('rejects a refresh token used as an access token', async () => {
    const token = jwt.sign({ type: 'refresh' }, env.jwt.refreshSecret, {
      ...options,
      expiresIn: '5m',
    });
    const res = await request(app).get(`${API}/users/me`).set(bearer(token));

    expect(res.status).toBe(401);
  });

  it('rejects an Authorization header that is not a Bearer token', async () => {
    const res = await request(app).get(`${API}/users/me`).set('Authorization', 'Token abc');

    expect(res.status).toBe(401);
  });
});

describe('request limits', () => {
  it('rejects a body above 1 MB with 413', async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: 'a@b.com', password: 'x'.repeat(1100000) });

    expect(res.status).toBe(413);
  });

  it('rejects broken JSON with 400', async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
  });
});

describe('private files', () => {
  it('does not serve receipts as static files', async () => {
    const res = await request(app).get('/uploads/receipts/anything.jpg');

    expect(res.status).toBe(404);
  });

  it('does not let a path climb out of the avatar folder', async () => {
    const res = await request(app).get('/uploads/avatars/..%2f..%2fpackage.json');

    expect([403, 404]).toContain(res.status);
  });
});
