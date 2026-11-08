'use strict';

const fs = require('fs');
const path = require('path');
const { UPLOAD_ROOT } = require('../../src/services/upload.service');
const {
  DEFAULT_USER,
  api,
  url,
  authHeader,
  registerUser,
  resetDatabase,
  closeDatabase,
} = require('../helpers');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fakePng = (extraBytes = 200) => Buffer.concat([PNG_SIGNATURE, Buffer.alloc(extraBytes)]);
const avatarFilesOf = (userId) => {
  const dir = path.join(UPLOAD_ROOT, 'avatars');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.startsWith(userId)) : [];
};

beforeEach(resetDatabase);
afterAll(async () => {
  fs.rmSync(UPLOAD_ROOT, { recursive: true, force: true });
  await closeDatabase();
});

describe('authentication', () => {
  it('rejects a request without a token', async () => {
    const res = await api().get(url('/users/me'));

    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await api().get(url('/users/me')).set(authHeader('abc'));

    expect(res.status).toBe(401);
  });
});

describe('GET and PUT /users/me', () => {
  it('returns the profile without the password hash', async () => {
    const { accessToken } = await registerUser();

    const res = await api().get(url('/users/me')).set(authHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(DEFAULT_USER.email);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('updates the allowed fields and upper-cases the currency', async () => {
    const { accessToken } = await registerUser();

    const res = await api()
      .put(url('/users/me'))
      .set(authHeader(accessToken))
      .send({ name: 'Renamed User', theme: 'dark', currency: 'eur' });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      name: 'Renamed User',
      theme: 'dark',
      currency: 'EUR',
    });
  });

  it('refuses to change the role or to send nothing', async () => {
    const { accessToken } = await registerUser();

    const role = await api()
      .put(url('/users/me'))
      .set(authHeader(accessToken))
      .send({ role: 'admin' });
    const empty = await api().put(url('/users/me')).set(authHeader(accessToken)).send({});

    expect(role.status).toBe(400);
    expect(empty.status).toBe(400);
  });
});

describe('PUT /users/me/password', () => {
  it('rejects a wrong current password', async () => {
    const { accessToken } = await registerUser();

    const res = await api()
      .put(url('/users/me/password'))
      .set(authHeader(accessToken))
      .send({ currentPassword: 'Wrong@12345', newPassword: 'Changed@12345' });

    expect(res.status).toBe(400);
  });

  it('changes the password and logs the user out of every device', async () => {
    const { accessToken, cookie } = await registerUser();

    const res = await api()
      .put(url('/users/me/password'))
      .set(authHeader(accessToken))
      .send({ currentPassword: DEFAULT_USER.password, newPassword: 'Changed@12345' });
    const oldSession = await api().post(url('/auth/refresh')).set('Cookie', cookie);
    const oldLogin = await api()
      .post(url('/auth/login'))
      .send({ email: DEFAULT_USER.email, password: DEFAULT_USER.password });
    const newLogin = await api()
      .post(url('/auth/login'))
      .send({ email: DEFAULT_USER.email, password: 'Changed@12345' });

    expect(res.status).toBe(200);
    expect(oldSession.status).toBe(401);
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });
});

describe('POST /users/me/avatar', () => {
  it('stores an image, serves it, and keeps only the newest file', async () => {
    const { user, accessToken } = await registerUser();

    const first = await api()
      .post(url('/users/me/avatar'))
      .set(authHeader(accessToken))
      .attach('avatar', fakePng(), { filename: 'one.png', contentType: 'image/png' });
    const second = await api()
      .post(url('/users/me/avatar'))
      .set(authHeader(accessToken))
      .attach('avatar', fakePng(300), { filename: 'two.png', contentType: 'image/png' });
    const served = await api().get(second.body.data.user.avatarUrl);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.user.avatarUrl).toMatch(/^\/uploads\/avatars\/.+\.png$/);
    expect(second.body.data.user.avatarUrl).not.toBe(first.body.data.user.avatarUrl);
    expect(avatarFilesOf(user.id)).toHaveLength(1);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/image\/png/);
    expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('rejects a file that only claims to be an image', async () => {
    const { accessToken } = await registerUser();

    const res = await api()
      .post(url('/users/me/avatar'))
      .set(authHeader(accessToken))
      .attach('avatar', Buffer.from('hello'), { filename: 'fake.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/JPEG, PNG or WebP/);
  });

  it('rejects a file over the size limit', async () => {
    const { accessToken } = await registerUser();

    const res = await api()
      .post(url('/users/me/avatar'))
      .set(authHeader(accessToken))
      .attach('avatar', fakePng(1.5 * 1024 * 1024), {
        filename: 'big.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at most 1 MB/);
  });

  it('rejects a request without a file', async () => {
    const { accessToken } = await registerUser();

    const res = await api().post(url('/users/me/avatar')).set(authHeader(accessToken));

    expect(res.status).toBe(400);
  });
});

describe('DELETE /users/me', () => {
  it('rejects a wrong password and keeps the account', async () => {
    const { accessToken } = await registerUser();

    const res = await api()
      .delete(url('/users/me'))
      .set(authHeader(accessToken))
      .send({ password: 'Wrong@12345' });
    const stillThere = await api().get(url('/users/me')).set(authHeader(accessToken));

    expect(res.status).toBe(400);
    expect(stillThere.status).toBe(200);
  });

  it('deletes the account, its avatar file and locks the old token out at once', async () => {
    const { user, accessToken } = await registerUser();
    await api()
      .post(url('/users/me/avatar'))
      .set(authHeader(accessToken))
      .attach('avatar', fakePng(), { filename: 'one.png', contentType: 'image/png' });

    const res = await api()
      .delete(url('/users/me'))
      .set(authHeader(accessToken))
      .send({ password: DEFAULT_USER.password });
    const oldToken = await api().get(url('/users/me')).set(authHeader(accessToken));
    const login = await api()
      .post(url('/auth/login'))
      .send({ email: DEFAULT_USER.email, password: DEFAULT_USER.password });

    expect(res.status).toBe(200);
    expect(oldToken.status).toBe(401);
    expect(login.status).toBe(401);
    expect(avatarFilesOf(user.id)).toHaveLength(0);
  });
});
