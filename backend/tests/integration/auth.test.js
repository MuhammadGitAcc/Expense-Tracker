'use strict';

const emailService = require('../../src/services/email.service');
const { REFRESH_COOKIE_NAME } = require('../../src/utils/jwt');
const {
  DEFAULT_USER,
  api,
  url,
  refreshCookie,
  registerUnverified,
  registerUser,
  verifyEmail,
  resetDatabase,
  closeDatabase,
} = require('../helpers');

beforeEach(resetDatabase);
afterEach(() => jest.restoreAllMocks());
afterAll(closeDatabase);

describe('POST /auth/register', () => {
  it('creates an unverified account and logs nobody in: no token and no cookie', async () => {
    const { res } = await registerUnverified();

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ email: DEFAULT_USER.email, expiresInMinutes: 10 });
    expect(res.body.data).not.toHaveProperty('accessToken');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('returns an access token and an httpOnly refresh cookie once the email is verified', async () => {
    const { code } = await registerUnverified();

    const res = await verifyEmail(DEFAULT_USER.email, code);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(DEFAULT_USER.email);
    expect(res.body.data.user.role).toBe('user');
    expect(res.body.data.user.emailVerified).toBe(true);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.headers['set-cookie'][0]).toMatch(
      new RegExp(`^${REFRESH_COOKIE_NAME}=.+HttpOnly`, 'i'),
    );
  });

  it('rejects an email that is already registered, whatever its letter case', async () => {
    await registerUser();

    const res = await api()
      .post(url('/auth/register'))
      .send({ ...DEFAULT_USER, email: 'TEST@Example.com' });

    expect(res.status).toBe(409);
  });

  it('rejects a weak password with a list of reasons', async () => {
    const res = await api()
      .post(url('/auth/register'))
      .send({ ...DEFAULT_USER, password: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});

describe('POST /auth/login', () => {
  it('logs in with the right credentials', async () => {
    await registerUser();

    const res = await api()
      .post(url('/auth/login'))
      .send({ email: DEFAULT_USER.email, password: DEFAULT_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toMatch(new RegExp(`^${REFRESH_COOKIE_NAME}=.+`));
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    await registerUser();

    const wrongPassword = await api()
      .post(url('/auth/login'))
      .send({ email: DEFAULT_USER.email, password: 'Wrong@12345' });
    const unknownEmail = await api()
      .post(url('/auth/login'))
      .send({ email: 'nobody@example.com', password: 'Test@12345' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });
});

describe('POST /auth/refresh', () => {
  it('rejects a request without the cookie', async () => {
    const res = await api().post(url('/auth/refresh'));

    expect(res.status).toBe(401);
  });

  it('swaps the token for a new pair', async () => {
    const { cookie } = await registerUser();

    const res = await api().post(url('/auth/refresh')).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).not.toBe(cookie);
  });

  it('rejects a reused token and revokes the new one as well', async () => {
    const { cookie: oldCookie } = await registerUser();
    const first = await api().post(url('/auth/refresh')).set('Cookie', oldCookie);
    const newCookie = refreshCookie(first);

    const reuse = await api().post(url('/auth/refresh')).set('Cookie', oldCookie);
    const afterReuse = await api().post(url('/auth/refresh')).set('Cookie', newCookie);

    expect(first.status).toBe(200);
    expect(reuse.status).toBe(401);
    expect(afterReuse.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('clears the cookie and makes the refresh token unusable', async () => {
    const { cookie } = await registerUser();

    const res = await api().post(url('/auth/logout')).set('Cookie', cookie);
    const refreshAfter = await api().post(url('/auth/refresh')).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(refreshCookie(res)).toBe(`${REFRESH_COOKIE_NAME}=`);
    expect(refreshAfter.status).toBe(401);
  });

  it('succeeds even without a cookie', async () => {
    const res = await api().post(url('/auth/logout'));

    expect(res.status).toBe(200);
  });
});

describe('forgot and reset password', () => {
  it('answers identically for a known and an unknown email, and emails only the known one', async () => {
    const spy = jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue(true);
    await registerUser();

    const known = await api()
      .post(url('/auth/forgot-password'))
      .send({ email: DEFAULT_USER.email });
    const unknown = await api()
      .post(url('/auth/forgot-password'))
      .send({ email: 'nobody@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('lets the link be used exactly once and logs the user out everywhere', async () => {
    const spy = jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue(true);
    const { cookie } = await registerUser();
    await api().post(url('/auth/forgot-password')).send({ email: DEFAULT_USER.email });
    const token = new URL(spy.mock.calls[0][0].resetUrl).searchParams.get('token');

    const weak = await api().post(url('/auth/reset-password')).send({ token, password: 'abc' });
    const reset = await api()
      .post(url('/auth/reset-password'))
      .send({ token, password: 'NewPass@12345' });
    const reuse = await api()
      .post(url('/auth/reset-password'))
      .send({ token, password: 'Another@12345' });
    const oldSession = await api().post(url('/auth/refresh')).set('Cookie', cookie);
    const oldLogin = await api()
      .post(url('/auth/login'))
      .send({ email: DEFAULT_USER.email, password: DEFAULT_USER.password });
    const newLogin = await api()
      .post(url('/auth/login'))
      .send({ email: DEFAULT_USER.email, password: 'NewPass@12345' });

    expect(weak.status).toBe(400);
    expect(reset.status).toBe(200);
    expect(reuse.status).toBe(400);
    expect(oldSession.status).toBe(401);
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it('rejects a made-up token', async () => {
    const res = await api()
      .post(url('/auth/reset-password'))
      .send({ token: 'a'.repeat(43), password: 'NewPass@12345' });

    expect(res.status).toBe(400);
  });
});
