'use strict';

const db = require('../../src/config/db');
const recurringGenerator = require('../../src/services/recurringGenerator.service');
const { addInterval } = require('../../src/utils/dateHelpers');
const {
  api,
  url,
  authHeader,
  registerUser,
  resetDatabase,
  seedDefaultCategories,
  closeDatabase,
} = require('../helpers');

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
const makeAccount = async (token, body) =>
  (await as(token, 'post', '/accounts', body)).body.data.account;
const categoryNamed = async (token, name, type) =>
  (await as(token, 'get', '/categories')).body.data.categories.find(
    (c) => c.name === name && c.type === type,
  );
const getAccount = async (token, id) =>
  (await as(token, 'get', `/accounts/${id}`)).body.data.account;
const expensesOf = async (token) => (await as(token, 'get', '/expenses')).body.data.expenses;
const incomesOf = async (token) => (await as(token, 'get', '/incomes')).body.data.incomes;
const notificationsOf = async (token) =>
  (await as(token, 'get', '/notifications')).body.data.notifications;
const template = async (token, id) =>
  (await as(token, 'get', `/recurring/${id}`)).body.data.recurring;

const FAR_FUTURE = '2099-01-01';

/** A user with a Wallet of 1000.00 plus the default Food and Salary categories. */
async function setup(overrides) {
  const { accessToken: token, user } = await registerUser(overrides);
  const wallet = await makeAccount(token, { name: 'Wallet', balance: '1000' });
  const food = await categoryNamed(token, 'Food', 'expense');
  const salary = await categoryNamed(token, 'Salary', 'income');
  return { token, user, wallet, food, salary };
}

/**
 * Create a template through the API, then move its dates straight in the database, so a
 * test controls exactly what is due (the API only accepts schedules from today on).
 */
async function addTemplate(
  ctx,
  { type = 'expense', frequency = 'monthly', amount = '50.00', ...rest } = {},
) {
  const { startDate = '2026-01-15', nextRunDate = startDate, endDate = null, note = 'Rent' } = rest;
  const res = await as(ctx.token, 'post', '/recurring', {
    type,
    amount,
    accountId: ctx.wallet.id,
    categoryId: type === 'expense' ? ctx.food.id : ctx.salary.id,
    frequency,
    startDate: '2099-01-01',
    note,
  });
  const id = res.body.data.recurring.id;
  await db.query(
    `UPDATE recurring_transactions
     SET start_date = $2::date, next_run_date = $3::date, end_date = $4::date
     WHERE id = $1`,
    [id, startDate, nextRunDate, endDate],
  );
  return id;
}

describe('generateDue: expenses', () => {
  it('creates the expense, takes the money, advances the date and notifies the user', async () => {
    const ctx = await setup();
    const id = await addTemplate(ctx, { startDate: '2026-11-10', note: 'Gym' });

    const summary = await recurringGenerator.generateDue('2026-11-10');

    expect(summary).toEqual({ due: 1, created: 1, paused: 0, failed: 0 });
    const [expense] = await expensesOf(ctx.token);
    expect(expense).toMatchObject({ amount: '50.00', date: '2026-11-10', note: 'Gym' });
    expect((await getAccount(ctx.token, ctx.wallet.id)).balance).toBe('950.00');
    expect(await template(ctx.token, id)).toMatchObject({
      nextRunDate: '2026-12-10',
      isActive: true,
    });
    const [notification] = await notificationsOf(ctx.token);
    expect(notification).toMatchObject({
      type: 'recurring_created',
      title: 'Recurring expense added',
      isRead: false,
    });
    expect(notification.message).toContain('50.00 USD was taken from Wallet on 2026-11-10');
    const { rows } = await db.query('SELECT recurring_id FROM expenses');
    expect(rows[0].recurring_id).toBe(id);
  });

  it('does nothing for templates that are not due yet or are paused', async () => {
    const ctx = await setup();
    await addTemplate(ctx, { startDate: '2026-12-01' });
    const pausedId = await addTemplate(ctx, { startDate: '2026-11-01' });
    await as(ctx.token, 'post', `/recurring/${pausedId}/pause`);

    const summary = await recurringGenerator.generateDue('2026-11-10');

    expect(summary).toEqual({ due: 0, created: 0, paused: 0, failed: 0 });
    expect(await expensesOf(ctx.token)).toHaveLength(0);
    expect((await getAccount(ctx.token, ctx.wallet.id)).balance).toBe('1000.00');
  });

  it('is safe to run twice: the same day never creates a second transaction', async () => {
    const ctx = await setup();
    await addTemplate(ctx, { startDate: '2026-11-10' });

    await recurringGenerator.generateDue('2026-11-10');
    const second = await recurringGenerator.generateDue('2026-11-10');

    expect(second.due).toBe(0);
    expect(await expensesOf(ctx.token)).toHaveLength(1);
    expect((await getAccount(ctx.token, ctx.wallet.id)).balance).toBe('950.00');
  });

  it('two runs at the same moment still create only one transaction', async () => {
    const ctx = await setup();
    await addTemplate(ctx, { startDate: '2026-11-10' });

    await Promise.all([
      recurringGenerator.generateDue('2026-11-10'),
      recurringGenerator.generateDue('2026-11-10'),
    ]);

    expect(await expensesOf(ctx.token)).toHaveLength(1);
    expect((await getAccount(ctx.token, ctx.wallet.id)).balance).toBe('950.00');
  });

  it('catches up every missed day, each dated with its scheduled day, in one notification', async () => {
    const ctx = await setup();
    const id = await addTemplate(ctx, {
      frequency: 'daily',
      amount: '10.00',
      startDate: '2026-11-07',
    });

    const summary = await recurringGenerator.generateDue('2026-11-10');

    expect(summary.created).toBe(4);
    const dates = (await expensesOf(ctx.token)).map((e) => e.date).sort();
    expect(dates).toEqual(['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']);
    expect((await getAccount(ctx.token, ctx.wallet.id)).balance).toBe('960.00');
    expect((await template(ctx.token, id)).nextRunDate).toBe('2026-11-11');
    const notifications = await notificationsOf(ctx.token);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain(
      '4 payments of 10.00 USD (2026-11-07 to 2026-11-10)',
    );
  });

  it('keeps the start day of a monthly schedule: Jan 31 -> Feb 28 -> Mar 31', async () => {
    const ctx = await setup();
    const id = await addTemplate(ctx, { startDate: '2026-01-31' });

    await recurringGenerator.generateDue('2026-02-28');

    const dates = (await expensesOf(ctx.token)).map((e) => e.date).sort();
    expect(dates).toEqual(['2026-01-31', '2026-02-28']);
    expect((await template(ctx.token, id)).nextRunDate).toBe('2026-03-31');
  });

  it('ends the schedule after its last run', async () => {
    const ctx = await setup();
    const id = await addTemplate(ctx, { startDate: '2026-11-10', endDate: '2026-11-20' });

    await recurringGenerator.generateDue('2026-11-10');

    const after = await template(ctx.token, id);
    expect(after.isActive).toBe(false);
    expect(after.nextRunDate).toBe('2026-12-10');
    expect(await expensesOf(ctx.token)).toHaveLength(1);
    expect((await recurringGenerator.generateDue(FAR_FUTURE)).due).toBe(0);
  });

  it('never creates a run after the end date, even when many days were missed', async () => {
    const ctx = await setup();
    await addTemplate(ctx, {
      frequency: 'daily',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
    });

    await recurringGenerator.generateDue('2026-11-30');

    const dates = (await expensesOf(ctx.token)).map((e) => e.date).sort();
    expect(dates).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });
});

describe('generateDue: income', () => {
  it('creates the income and adds the money', async () => {
    const ctx = await setup();
    await addTemplate(ctx, {
      type: 'income',
      amount: '2000.00',
      startDate: '2026-11-10',
      note: 'Pay',
    });

    const summary = await recurringGenerator.generateDue('2026-11-10');

    expect(summary.created).toBe(1);
    expect(await incomesOf(ctx.token)).toEqual([
      expect.objectContaining({ amount: '2000.00', date: '2026-11-10', note: 'Pay' }),
    ]);
    expect((await getAccount(ctx.token, ctx.wallet.id)).balance).toBe('3000.00');
    const [notification] = await notificationsOf(ctx.token);
    expect(notification.title).toBe('Recurring income added');
    expect(notification.message).toContain('was added to Wallet');
    expect(await expensesOf(ctx.token)).toHaveLength(0);
  });
});

describe('generateDue: special cases', () => {
  it('pauses a template whose account was archived and tells the user', async () => {
    const ctx = await setup();
    const id = await addTemplate(ctx, { startDate: '2026-11-10' });
    await as(ctx.token, 'post', `/accounts/${ctx.wallet.id}/archive`);

    const summary = await recurringGenerator.generateDue('2026-11-10');

    expect(summary).toEqual({ due: 1, created: 0, paused: 1, failed: 0 });
    expect(await expensesOf(ctx.token)).toHaveLength(0);
    expect((await template(ctx.token, id)).isActive).toBe(false);
    const [notification] = await notificationsOf(ctx.token);
    expect(notification).toMatchObject({ type: 'system', title: 'Recurring transaction paused' });
    expect(notification.message).toContain('"Wallet" is archived');
  });

  it("handles every user's templates and keeps their data apart", async () => {
    const alice = await setup({ email: 'alice@example.com' });
    const bob = await setup({ email: 'bob@example.com' });
    await addTemplate(alice, { startDate: '2026-11-10', amount: '10.00' });
    await addTemplate(bob, { startDate: '2026-11-10', amount: '20.00' });

    const summary = await recurringGenerator.generateDue('2026-11-10');

    expect(summary).toMatchObject({ due: 2, created: 2, failed: 0 });
    expect((await getAccount(alice.token, alice.wallet.id)).balance).toBe('990.00');
    expect((await getAccount(bob.token, bob.wallet.id)).balance).toBe('980.00');
    expect(await notificationsOf(alice.token)).toHaveLength(1);
    expect(await notificationsOf(bob.token)).toHaveLength(1);
  });

  it('keeps the generated transactions when the template is deleted', async () => {
    const ctx = await setup();
    const id = await addTemplate(ctx, { startDate: '2026-11-10' });
    await recurringGenerator.generateDue('2026-11-10');

    await as(ctx.token, 'delete', `/recurring/${id}`);

    const expenses = await expensesOf(ctx.token);
    expect(expenses).toHaveLength(1);
    const { rows } = await db.query('SELECT recurring_id FROM expenses');
    expect(rows[0].recurring_id).toBeNull();
  });

  it('daily dates advance with addInterval (sanity check of the helper the job relies on)', () => {
    expect(addInterval('2026-11-10', 'daily')).toBe('2026-11-11');
  });
});
