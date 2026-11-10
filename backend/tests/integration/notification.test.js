'use strict';

const { api, url, authHeader, registerUser, resetDatabase, closeDatabase } = require('../helpers');
const notificationService = require('../../src/services/notification.service');

const UNKNOWN_ID = '3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c';

beforeEach(async () => {
  await resetDatabase();
});
afterAll(async () => {
  await closeDatabase();
});

const as = (token, method, path, body) => {
  const req = api()[method](url(path)).set(authHeader(token));
  return body === undefined ? req : req.send(body);
};
const listNotifications = (token, query = '') => as(token, 'get', `/notifications${query}`);
const unreadCount = (token) => as(token, 'get', '/notifications/unread-count');
const markRead = (token, id) => as(token, 'put', `/notifications/${id}/read`);
const markAllRead = (token) => as(token, 'put', '/notifications/read-all');

/** Create notifications the way the jobs do. Resolves them oldest first. */
async function seed(userId, count, type = 'system') {
  const created = [];
  for (let i = 1; i <= count; i += 1) {
    created.push(
      await notificationService.notify(userId, {
        type,
        title: `Title ${i}`,
        message: `Message ${i}`,
      }),
    );
  }
  return created;
}

describe('authentication', () => {
  it('rejects every route without a token', async () => {
    expect((await api().get(url('/notifications'))).status).toBe(401);
    expect((await api().get(url('/notifications/unread-count'))).status).toBe(401);
    expect((await api().put(url('/notifications/read-all'))).status).toBe(401);
    expect((await api().put(url(`/notifications/${UNKNOWN_ID}/read`))).status).toBe(401);
  });
});

describe('GET /notifications', () => {
  it('answers an empty list for a new user', async () => {
    const { accessToken } = await registerUser();

    const res = await listNotifications(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toEqual([]);
    expect(res.body.meta).toMatchObject({ total: 0, page: 1, unreadCount: 0, hasNext: false });
  });

  it('lists newest first with the camelCase shape and the unread count', async () => {
    const { accessToken, user } = await registerUser();
    await seed(user.id, 3);

    const res = await listNotifications(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications.map((n) => n.title)).toEqual([
      'Title 3',
      'Title 2',
      'Title 1',
    ]);
    expect(res.body.data.notifications[0]).toEqual({
      id: expect.any(String),
      type: 'system',
      title: 'Title 3',
      message: 'Message 3',
      isRead: false,
      createdAt: expect.any(String),
    });
    expect(res.body.meta).toMatchObject({ total: 3, unreadCount: 3 });
  });

  it('paginates', async () => {
    const { accessToken, user } = await registerUser();
    await seed(user.id, 5);

    const res = await listNotifications(accessToken, '?page=2&limit=2');

    expect(res.body.data.notifications.map((n) => n.title)).toEqual(['Title 3', 'Title 2']);
    expect(res.body.meta).toMatchObject({
      total: 5,
      page: 2,
      limit: 2,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('filters by isRead and by type; unreadCount ignores the filters', async () => {
    const { accessToken, user } = await registerUser();
    const [first] = await seed(user.id, 2, 'budget_exceeded');
    await seed(user.id, 1, 'weekly_summary');
    await markRead(accessToken, first.id);

    const unread = await listNotifications(accessToken, '?isRead=false');
    const read = await listNotifications(accessToken, '?isRead=true');
    const exceeded = await listNotifications(accessToken, '?type=budget_exceeded');

    expect(unread.body.meta.total).toBe(2);
    expect(read.body.data.notifications.map((n) => n.id)).toEqual([first.id]);
    expect(exceeded.body.meta.total).toBe(2);
    expect(exceeded.body.meta.unreadCount).toBe(2);
  });

  it('rejects bad query values (400)', async () => {
    const { accessToken } = await registerUser();

    expect((await listNotifications(accessToken, '?isRead=maybe')).status).toBe(400);
    expect((await listNotifications(accessToken, '?type=nope')).status).toBe(400);
    expect((await listNotifications(accessToken, '?limit=1000')).status).toBe(400);
    expect((await listNotifications(accessToken, '?page=0')).status).toBe(400);
  });

  it("never shows another user's notifications", async () => {
    const alice = await registerUser({ email: 'alice@example.com' });
    const bob = await registerUser({ email: 'bob@example.com' });
    await seed(alice.user.id, 2);

    const res = await listNotifications(bob.accessToken);

    expect(res.body.data.notifications).toEqual([]);
    expect(res.body.meta.unreadCount).toBe(0);
  });
});

describe('GET /notifications/unread-count', () => {
  it('counts only the unread notifications of the user', async () => {
    const alice = await registerUser({ email: 'alice@example.com' });
    const bob = await registerUser({ email: 'bob@example.com' });
    const [first] = await seed(alice.user.id, 3);
    await seed(bob.user.id, 4);
    await markRead(alice.accessToken, first.id);

    const res = await unreadCount(alice.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ unreadCount: 2 });
  });
});

describe('PUT /notifications/:id/read', () => {
  it('marks one notification as read and is idempotent', async () => {
    const { accessToken, user } = await registerUser();
    const [first] = await seed(user.id, 2);

    const res = await markRead(accessToken, first.id);
    const again = await markRead(accessToken, first.id);

    expect(res.status).toBe(200);
    expect(res.body.data.notification).toMatchObject({ id: first.id, isRead: true });
    expect(again.status).toBe(200);
    expect((await unreadCount(accessToken)).body.data.unreadCount).toBe(1);
  });

  it("answers 404 for an unknown id and for another user's notification", async () => {
    const alice = await registerUser({ email: 'alice@example.com' });
    const bob = await registerUser({ email: 'bob@example.com' });
    const [theirs] = await seed(alice.user.id, 1);

    expect((await markRead(bob.accessToken, UNKNOWN_ID)).status).toBe(404);
    expect((await markRead(bob.accessToken, theirs.id)).status).toBe(404);
    // Alice's notification is still unread.
    expect((await unreadCount(alice.accessToken)).body.data.unreadCount).toBe(1);
  });

  it('answers 400 for a malformed id', async () => {
    const { accessToken } = await registerUser();

    expect((await markRead(accessToken, 'not-a-uuid')).status).toBe(400);
  });
});

describe('PUT /notifications/read-all', () => {
  it('marks every unread notification of the user and reports how many changed', async () => {
    const alice = await registerUser({ email: 'alice@example.com' });
    const bob = await registerUser({ email: 'bob@example.com' });
    await seed(alice.user.id, 3);
    await seed(bob.user.id, 2);

    const res = await markAllRead(alice.accessToken);
    const second = await markAllRead(alice.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updated: 3 });
    expect(second.body.data).toEqual({ updated: 0 });
    expect((await unreadCount(alice.accessToken)).body.data.unreadCount).toBe(0);
    expect((await unreadCount(bob.accessToken)).body.data.unreadCount).toBe(2);
  });
});

describe('notificationService.notify', () => {
  it('rejects a type that is not allowed by the database', async () => {
    const { user } = await registerUser();

    await expect(
      notificationService.notify(user.id, { type: 'bogus', title: 'x', message: 'y' }),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
