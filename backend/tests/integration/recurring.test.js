'use strict';

const {
  api,
  url,
  authHeader,
  registerUser,
  resetDatabase,
  seedDefaultCategories,
  closeDatabase,
} = require('../helpers');

const UNKNOWN_ID = '3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c';

beforeEach(async () => {
  await resetDatabase();
  await seedDefaultCategories();
});
afterAll(async () => {
  await closeDatabase();
});

const as = (token, method, path, body) => {
  const req = api()[method](url(path)).set(authHeader(token));
  return body === undefined ? req : req.send(body);
};
const addRecurring = (token, body) => as(token, 'post', '/recurring', body);
const getRecurring = (token, id) => as(token, 'get', `/recurring/${id}`);
const putRecurring = (token, id, body) => as(token, 'put', `/recurring/${id}`, body);
const delRecurring = (token, id) => as(token, 'delete', `/recurring/${id}`);
const pauseRecurring = (token, id) => as(token, 'post', `/recurring/${id}/pause`);
const resumeRecurring = (token, id) => as(token, 'post', `/recurring/${id}/resume`);
const listRecurring = (token, query = '') => as(token, 'get', `/recurring${query}`);
const makeAccount = async (token, body) =>
  (await as(token, 'post', '/accounts', body)).body.data.account;
const categoryNamed = async (token, name, type) =>
  (await as(token, 'get', '/categories')).body.data.categories.find(
    (c) => c.name === name && c.type === type,
  );

// Dates relative to today (UTC, like the server), so the tests do not age.
const isoDay = (offsetDays) =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** A signed-up user with a Wallet of 1000.00, a Food (expense) and a Salary (income) category. */
async function setup(overrides) {
  const { accessToken: token, user } = await registerUser(overrides);
  const wallet = await makeAccount(token, { name: 'Wallet', balance: '1000' });
  const food = await categoryNamed(token, 'Food', 'expense');
  const salary = await categoryNamed(token, 'Salary', 'income');
  return { token, user, wallet, food, salary };
}

const expenseBody = (ctx, extra = {}) => ({
  type: 'expense',
  amount: 12.5,
  accountId: ctx.wallet.id,
  categoryId: ctx.food.id,
  frequency: 'monthly',
  ...extra,
});

describe('authentication', () => {
  it('rejects every route without a token', async () => {
    expect((await api().get(url('/recurring'))).status).toBe(401);
    expect((await api().post(url('/recurring')).send({})).status).toBe(401);
  });
});

describe('POST /recurring', () => {
  it('creates an expense template that starts in the future', async () => {
    const ctx = await setup();
    const start = isoDay(10);

    const res = await addRecurring(
      ctx.token,
      expenseBody(ctx, { startDate: start, note: ' Gym ' }),
    );

    expect(res.status).toBe(201);
    expect(res.body.data.recurring).toMatchObject({
      type: 'expense',
      amount: '12.50',
      frequency: 'monthly',
      startDate: start,
      endDate: null,
      nextRunDate: start,
      isActive: true,
      note: 'Gym',
      account: { id: ctx.wallet.id, name: 'Wallet', currency: 'USD' },
      category: { id: ctx.food.id, name: 'Food' },
    });
  });

  it('creates an income template, starting today when no start date is given', async () => {
    const ctx = await setup();

    const res = await addRecurring(ctx.token, {
      type: 'income',
      amount: '2000',
      accountId: ctx.wallet.id,
      categoryId: ctx.salary.id,
      frequency: 'monthly',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.recurring).toMatchObject({
      type: 'income',
      startDate: isoDay(0),
      nextRunDate: isoDay(0),
    });
  });

  it('skips past dates when the start date is in the past', async () => {
    const ctx = await setup();

    const daily = await addRecurring(
      ctx.token,
      expenseBody(ctx, { frequency: 'daily', startDate: isoDay(-5) }),
    );
    const weekly = await addRecurring(
      ctx.token,
      expenseBody(ctx, { frequency: 'weekly', startDate: isoDay(-3) }),
    );

    expect(daily.body.data.recurring.startDate).toBe(isoDay(-5));
    expect(daily.body.data.recurring.nextRunDate).toBe(isoDay(0));
    expect(weekly.body.data.recurring.nextRunDate).toBe(isoDay(4));
  });

  it('creates no transaction and changes no balance', async () => {
    const ctx = await setup();

    await addRecurring(ctx.token, expenseBody(ctx, { frequency: 'daily' }));

    const account = (await as(ctx.token, 'get', `/accounts/${ctx.wallet.id}`)).body.data.account;
    const expenses = await as(ctx.token, 'get', '/expenses');
    expect(account.balance).toBe('1000.00');
    expect(expenses.body.meta.total).toBe(0);
  });

  it('rejects bad references and bad input, and creates nothing', async () => {
    const ctx = await setup();
    const other = await setup({ email: 'other@example.com' });
    const archived = await makeAccount(ctx.token, { name: 'Old', balance: '10' });
    await as(ctx.token, 'post', `/accounts/${archived.id}/archive`);
    const theirCategory = (
      await as(other.token, 'post', '/categories', { name: 'Secret', type: 'expense' })
    ).body.data.category;

    const cases = await Promise.all([
      addRecurring(ctx.token, expenseBody(ctx, { categoryId: ctx.salary.id })), // 400: wrong type
      addRecurring(ctx.token, {
        ...expenseBody(ctx, { type: 'income' }),
        categoryId: ctx.food.id,
      }), // 400: wrong type
      addRecurring(ctx.token, expenseBody(ctx, { categoryId: UNKNOWN_ID })), // 404
      addRecurring(ctx.token, expenseBody(ctx, { categoryId: theirCategory.id })), // 404
      addRecurring(ctx.token, expenseBody(ctx, { accountId: other.wallet.id })), // 404
      addRecurring(ctx.token, expenseBody(ctx, { accountId: archived.id })), // 400
      addRecurring(ctx.token, expenseBody(ctx, { amount: 0 })),
      addRecurring(ctx.token, expenseBody(ctx, { amount: '1.234' })),
      addRecurring(ctx.token, expenseBody(ctx, { frequency: 'hourly' })),
      addRecurring(ctx.token, expenseBody(ctx, { startDate: '2026-02-31' })),
      addRecurring(ctx.token, expenseBody(ctx, { startDate: '1999-12-31' })),
      addRecurring(ctx.token, expenseBody(ctx, { startDate: isoDay(5), endDate: isoDay(2) })),
      addRecurring(
        ctx.token,
        expenseBody(ctx, { frequency: 'daily', startDate: isoDay(-10), endDate: isoDay(-5) }),
      ), // 400: schedule already ended
      addRecurring(ctx.token, expenseBody(ctx, { userId: other.user.id })), // unknown field
      addRecurring(ctx.token, { amount: 5 }), // missing fields
    ]);

    expect(cases.map((res) => res.status)).toEqual([
      400, 400, 404, 404, 404, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400,
    ]);
    expect((await listRecurring(ctx.token)).body.meta.total).toBe(0);
  });
});

describe('GET /recurring', () => {
  it('lists the templates (next run first) and filters by type and active state', async () => {
    const ctx = await setup();
    const later = (
      await addRecurring(ctx.token, expenseBody(ctx, { amount: 1, startDate: isoDay(20) }))
    ).body.data.recurring;
    const sooner = (
      await addRecurring(ctx.token, expenseBody(ctx, { amount: 2, startDate: isoDay(5) }))
    ).body.data.recurring;
    await addRecurring(ctx.token, {
      type: 'income',
      amount: 3,
      accountId: ctx.wallet.id,
      categoryId: ctx.salary.id,
      frequency: 'weekly',
      startDate: isoDay(30),
    });
    await pauseRecurring(ctx.token, later.id);

    const all = await listRecurring(ctx.token);
    const expenses = await listRecurring(ctx.token, '?type=expense');
    const active = await listRecurring(ctx.token, '?isActive=true');
    const paused = await listRecurring(ctx.token, '?isActive=false');

    const amounts = (res) => res.body.data.recurringTransactions.map((r) => r.amount);
    expect(all.status).toBe(200);
    expect(amounts(all)).toEqual(['2.00', '1.00', '3.00']);
    expect(all.body.meta.total).toBe(3);
    expect(amounts(expenses)).toEqual(['2.00', '1.00']);
    expect(amounts(active)).toEqual(['2.00', '3.00']);
    expect(paused.body.data.recurringTransactions.map((r) => r.id)).toEqual([later.id]);
    expect(sooner.isActive).toBe(true);
  });

  it('rejects invalid filters', async () => {
    const ctx = await setup();

    const bad = await Promise.all([
      listRecurring(ctx.token, '?type=transfer'),
      listRecurring(ctx.token, '?isActive=maybe'),
    ]);

    bad.forEach((res) => expect(res.status).toBe(400));
  });

  it('never shows the templates of another user', async () => {
    const ctx = await setup();
    const other = await setup({ email: 'other@example.com' });
    await addRecurring(ctx.token, expenseBody(ctx, { amount: 1 }));
    await addRecurring(other.token, expenseBody(other, { amount: 9 }));

    const mine = await listRecurring(ctx.token);
    const theirs = await listRecurring(other.token);

    expect(mine.body.data.recurringTransactions.map((r) => r.amount)).toEqual(['1.00']);
    expect(theirs.body.data.recurringTransactions.map((r) => r.amount)).toEqual(['9.00']);
  });
});

describe('GET /recurring/:id', () => {
  it('returns an own template, 404 for another user, 400 for a malformed id', async () => {
    const ctx = await setup();
    const other = await setup({ email: 'other@example.com' });
    const mine = (await addRecurring(ctx.token, expenseBody(ctx))).body.data.recurring;

    expect((await getRecurring(ctx.token, mine.id)).status).toBe(200);
    expect((await getRecurring(other.token, mine.id)).status).toBe(404);
    expect((await getRecurring(ctx.token, UNKNOWN_ID)).status).toBe(404);
    expect((await getRecurring(ctx.token, 'not-a-uuid')).status).toBe(400);
  });
});

describe('PUT /recurring/:id', () => {
  it('changes amount, note, end date, account and category, and keeps the schedule', async () => {
    const ctx = await setup();
    const bank = await makeAccount(ctx.token, { name: 'Bank', balance: '500' });
    const rent = (
      await as(ctx.token, 'post', '/categories', { name: 'Rent share', type: 'expense' })
    ).body.data.category;
    const start = isoDay(10);
    const created = (await addRecurring(ctx.token, expenseBody(ctx, { startDate: start }))).body
      .data.recurring;
    const end = isoDay(100);

    const res = await putRecurring(ctx.token, created.id, {
      amount: '99.99',
      note: 'Shared flat',
      endDate: end,
      accountId: bank.id,
      categoryId: rent.id,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.recurring).toMatchObject({
      amount: '99.99',
      note: 'Shared flat',
      endDate: end,
      account: { id: bank.id },
      category: { id: rent.id },
      frequency: 'monthly',
      startDate: start,
      nextRunDate: start,
    });
  });

  it('clears the end date and the note with null', async () => {
    const ctx = await setup();
    const created = (
      await addRecurring(
        ctx.token,
        expenseBody(ctx, { startDate: isoDay(10), endDate: isoDay(100), note: 'Gym' }),
      )
    ).body.data.recurring;

    const res = await putRecurring(ctx.token, created.id, { endDate: null, note: null });

    expect(res.status).toBe(200);
    expect(res.body.data.recurring).toMatchObject({ endDate: null, note: null });
  });

  it('rejects bad updates and changes nothing', async () => {
    const ctx = await setup();
    const other = await setup({ email: 'other@example.com' });
    const created = (await addRecurring(ctx.token, expenseBody(ctx, { startDate: isoDay(10) })))
      .body.data.recurring;

    const cases = await Promise.all([
      putRecurring(ctx.token, created.id, { categoryId: ctx.salary.id }), // 400: wrong type
      putRecurring(ctx.token, created.id, { accountId: other.wallet.id }), // 404
      putRecurring(ctx.token, created.id, { endDate: isoDay(2) }), // 400: before next run
      putRecurring(ctx.token, created.id, { amount: 0 }), // 400
      putRecurring(ctx.token, created.id, {}), // 400
      putRecurring(ctx.token, created.id, { frequency: 'daily' }), // 400: cannot change
      putRecurring(ctx.token, created.id, { startDate: isoDay(20) }), // 400: cannot change
      putRecurring(ctx.token, created.id, { type: 'income' }), // 400: cannot change
      putRecurring(other.token, created.id, { amount: 1 }), // 404: not theirs
      putRecurring(ctx.token, UNKNOWN_ID, { amount: 1 }), // 404
    ]);

    expect(cases.map((res) => res.status)).toEqual([
      400, 404, 400, 400, 400, 400, 400, 400, 404, 404,
    ]);
    expect((await getRecurring(ctx.token, created.id)).body.data.recurring.amount).toBe('12.50');
  });
});

describe('POST /recurring/:id/pause and /resume', () => {
  it('pauses and resumes, and both can be repeated safely', async () => {
    const ctx = await setup();
    const start = isoDay(10);
    const created = (await addRecurring(ctx.token, expenseBody(ctx, { startDate: start }))).body
      .data.recurring;

    const paused = await pauseRecurring(ctx.token, created.id);
    const pausedAgain = await pauseRecurring(ctx.token, created.id);
    const resumed = await resumeRecurring(ctx.token, created.id);
    const resumedAgain = await resumeRecurring(ctx.token, created.id);

    expect(paused.status).toBe(200);
    expect(paused.body.data.recurring.isActive).toBe(false);
    expect(pausedAgain.body.data.recurring.isActive).toBe(false);
    expect(resumed.body.data.recurring).toMatchObject({ isActive: true, nextRunDate: start });
    expect(resumedAgain.body.data.recurring.isActive).toBe(true);
  });

  it('answers 404 for another user and for unknown ids', async () => {
    const ctx = await setup();
    const other = await setup({ email: 'other@example.com' });
    const created = (await addRecurring(ctx.token, expenseBody(ctx))).body.data.recurring;

    expect((await pauseRecurring(other.token, created.id)).status).toBe(404);
    expect((await resumeRecurring(other.token, created.id)).status).toBe(404);
    expect((await pauseRecurring(ctx.token, UNKNOWN_ID)).status).toBe(404);
    expect((await getRecurring(ctx.token, created.id)).body.data.recurring.isActive).toBe(true);
  });
});

describe('DELETE /recurring/:id', () => {
  it('deletes an own template', async () => {
    const ctx = await setup();
    const created = (await addRecurring(ctx.token, expenseBody(ctx))).body.data.recurring;

    const res = await delRecurring(ctx.token, created.id);

    expect(res.status).toBe(200);
    expect((await getRecurring(ctx.token, created.id)).status).toBe(404);
    expect((await delRecurring(ctx.token, created.id)).status).toBe(404);
  });

  it('answers 404 for another user and leaves their template alone', async () => {
    const ctx = await setup();
    const other = await setup({ email: 'other@example.com' });
    const created = (await addRecurring(ctx.token, expenseBody(ctx))).body.data.recurring;

    const res = await delRecurring(other.token, created.id);

    expect(res.status).toBe(404);
    expect((await getRecurring(ctx.token, created.id)).status).toBe(200);
  });
});

describe('accounts and categories that have templates', () => {
  it('cannot be deleted while a template uses them', async () => {
    const ctx = await setup();
    const custom = (await as(ctx.token, 'post', '/categories', { name: 'Gym', type: 'expense' }))
      .body.data.category;
    await addRecurring(ctx.token, expenseBody(ctx, { categoryId: custom.id }));

    const deleteAccount = await as(ctx.token, 'delete', `/accounts/${ctx.wallet.id}`);
    const deleteCategory = await as(ctx.token, 'delete', `/categories/${custom.id}`);

    expect(deleteAccount.status).toBe(409);
    expect(deleteCategory.status).toBe(409);
  });
});
