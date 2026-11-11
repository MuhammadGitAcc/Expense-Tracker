'use strict';

const db = require('../../src/config/db');
const budgetAlertService = require('../../src/services/budgetAlert.service');
const emailService = require('../../src/services/email.service');
const { today } = require('../../src/utils/dateHelpers');
const {
  api,
  url,
  authHeader,
  registerUser,
  resetDatabase,
  seedDefaultCategories,
  closeDatabase,
} = require('../helpers');

const [YEAR, MONTH] = today().split('-').map(Number);

let emailSpy;
beforeEach(async () => {
  await resetDatabase();
  await seedDefaultCategories();
  emailSpy = jest.spyOn(emailService, 'sendBudgetAlertEmail').mockResolvedValue(true);
});
afterEach(() => {
  emailSpy.mockRestore();
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
const notificationsOf = async (token) =>
  (await as(token, 'get', '/notifications')).body.data.notifications.reverse(); // oldest first
const titlesOf = async (token) => (await notificationsOf(token)).map((n) => n.title);

/** A user with a Wallet and the default Food category. */
async function setup(overrides) {
  const { accessToken: token, user } = await registerUser(overrides);
  const wallet = await makeAccount(token, { name: 'Wallet', balance: '5000' });
  const food = await categoryNamed(token, 'Food', 'expense');
  return { token, user, wallet, food };
}

const spend = (ctx, amount) =>
  as(ctx.token, 'post', '/expenses', {
    accountId: ctx.wallet.id,
    categoryId: ctx.food.id,
    amount,
  });

const addBudget = (ctx, body = {}) =>
  as(ctx.token, 'post', '/budgets', {
    categoryId: ctx.food.id,
    amount: 100,
    month: MONTH,
    year: YEAR,
    ...body,
  });

/** The email is sent in the background, so wait for it. */
async function waitForEmails(count) {
  for (let i = 0; i < 40 && emailSpy.mock.calls.length < count; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe('alerts after an expense', () => {
  it('stays quiet below the alert level', async () => {
    const ctx = await setup();
    await addBudget(ctx);

    await spend(ctx, '79.00');

    expect(await notificationsOf(ctx.token)).toHaveLength(0);
  });

  it('sends a warning when the alert level is reached, once, and an exceeded alert over 100%', async () => {
    const ctx = await setup();
    await addBudget(ctx);

    await spend(ctx, '80.00'); // exactly the alert level
    await spend(ctx, '5.00'); // still a warning: no second alert
    expect(await titlesOf(ctx.token)).toEqual(['Budget alert: Food']);
    const [warning] = await notificationsOf(ctx.token);
    expect(warning).toMatchObject({ type: 'budget_warning', isRead: false });
    expect(warning.message).toContain('80% of your Food budget');
    expect(warning.message).toContain('(80.00 of 100.00)');

    await spend(ctx, '20.00'); // 105.00 > 100.00
    await spend(ctx, '10.00'); // already exceeded: no more alerts
    expect(await titlesOf(ctx.token)).toEqual(['Budget alert: Food', 'Budget exceeded: Food']);
    const [, exceeded] = await notificationsOf(ctx.token);
    expect(exceeded).toMatchObject({ type: 'budget_exceeded' });
    expect(exceeded.message).toContain('105.00 spent of 100.00');
  });

  it('jumping straight over the limit sends only the exceeded alert', async () => {
    const ctx = await setup();
    await addBudget(ctx);

    await spend(ctx, '150.00');

    expect(await titlesOf(ctx.token)).toEqual(['Budget exceeded: Food']);
  });

  it('alerts again after the spending dropped below the level and crossed it again', async () => {
    const ctx = await setup();
    await addBudget(ctx);
    const big = await spend(ctx, '150.00');
    expect(await notificationsOf(ctx.token)).toHaveLength(1);

    await as(ctx.token, 'delete', `/expenses/${big.body.data.expense.id}`);
    await budgetAlertService.checkAll(); // the daily check stores the lower level silently
    expect(await notificationsOf(ctx.token)).toHaveLength(1);

    await spend(ctx, '150.00');
    expect(await titlesOf(ctx.token)).toEqual(['Budget exceeded: Food', 'Budget exceeded: Food']);
  });

  it('uses the alert level of the budget (a custom 50%)', async () => {
    const ctx = await setup();
    await addBudget(ctx, { alertThreshold: 50 });

    await spend(ctx, '50.00');

    expect(await titlesOf(ctx.token)).toEqual(['Budget alert: Food']);
  });

  it('alerts for the overall budget too, named "Overall"', async () => {
    const ctx = await setup();
    await addBudget(ctx, { categoryId: null, amount: 200 });

    await spend(ctx, '250.00');

    const [alert] = await notificationsOf(ctx.token);
    expect(alert).toMatchObject({ type: 'budget_exceeded', title: 'Budget exceeded: Overall' });
  });

  it('ignores expenses of another month and does not alert other users', async () => {
    const alice = await setup({ email: 'alice@example.com' });
    const bob = await setup({ email: 'bob@example.com' });
    await addBudget(alice);
    await addBudget(bob);

    await as(alice.token, 'post', '/expenses', {
      accountId: alice.wallet.id,
      categoryId: alice.food.id,
      amount: '500.00',
      date: `${YEAR - 1}-01-15`,
    });
    await spend(bob, '90.00');

    expect(await notificationsOf(alice.token)).toHaveLength(0);
    expect(await titlesOf(bob.token)).toEqual(['Budget alert: Food']);
  });

  it('an edit that pushes the spending over the limit alerts', async () => {
    const ctx = await setup();
    await addBudget(ctx);
    const expense = await spend(ctx, '10.00');

    await as(ctx.token, 'put', `/expenses/${expense.body.data.expense.id}`, { amount: '120.00' });

    expect(await titlesOf(ctx.token)).toEqual(['Budget exceeded: Food']);
  });
});

describe('alerts after a budget change', () => {
  it('creating a budget that is already over its limit alerts at once', async () => {
    const ctx = await setup();
    await spend(ctx, '130.00');

    await addBudget(ctx);

    expect(await titlesOf(ctx.token)).toEqual(['Budget exceeded: Food']);
  });

  it('raising the limit stores the lower level silently, so the next crossing alerts again', async () => {
    const ctx = await setup();
    const budget = await addBudget(ctx);
    await spend(ctx, '90.00');
    expect(await titlesOf(ctx.token)).toEqual(['Budget alert: Food']);

    await as(ctx.token, 'put', `/budgets/${budget.body.data.budget.id}`, { amount: 1000 });
    expect(await notificationsOf(ctx.token)).toHaveLength(1);

    await as(ctx.token, 'put', `/budgets/${budget.body.data.budget.id}`, { amount: 100 });
    expect(await titlesOf(ctx.token)).toEqual(['Budget alert: Food', 'Budget alert: Food']);
  });
});

describe('emails', () => {
  it('emails the user once per alert with the same numbers', async () => {
    const ctx = await setup();
    await addBudget(ctx);

    await spend(ctx, '85.00');
    await spend(ctx, '5.00');
    await waitForEmails(1);

    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0][0]).toMatchObject({
      level: 'warning',
      budgetName: 'Food',
      spent: '85.00',
      amount: '100.00',
      user: expect.objectContaining({ email: 'test@example.com' }),
    });
  });
});

describe('the daily check', () => {
  it('finds budgets that went over without a request (like recurring expenses) and sends each alert only once', async () => {
    const ctx = await setup();
    await addBudget(ctx);
    // An expense inserted directly, the way the recurring job creates one.
    await db.query(
      `INSERT INTO expenses (user_id, account_id, category_id, amount, date)
       VALUES ($1, $2, $3, 150, CURRENT_DATE)`,
      [ctx.user.id, ctx.wallet.id, ctx.food.id],
    );
    expect(await notificationsOf(ctx.token)).toHaveLength(0);

    const first = await budgetAlertService.checkAll();
    const second = await budgetAlertService.checkAll();

    expect(first).toEqual({ users: 1, alerts: 1 });
    expect(second).toEqual({ users: 1, alerts: 0 });
    expect(await titlesOf(ctx.token)).toEqual(['Budget exceeded: Food']);
  });

  it('two checks at the same moment send only one alert', async () => {
    const ctx = await setup();
    await addBudget(ctx);
    await db.query(
      `INSERT INTO expenses (user_id, account_id, category_id, amount, date)
       VALUES ($1, $2, $3, 150, CURRENT_DATE)`,
      [ctx.user.id, ctx.wallet.id, ctx.food.id],
    );

    await Promise.all([
      budgetAlertService.checkMonth(ctx.user.id, { month: MONTH, year: YEAR }),
      budgetAlertService.checkMonth(ctx.user.id, { month: MONTH, year: YEAR }),
    ]);

    expect(await notificationsOf(ctx.token)).toHaveLength(1);
  });

  it('does nothing for users without budgets', async () => {
    await setup();

    expect(await budgetAlertService.checkAll()).toEqual({ users: 0, alerts: 0 });
  });
});
