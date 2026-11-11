'use strict';

const db = require('../../src/config/db');
const weeklySummaryService = require('../../src/services/weeklySummary.service');
const emailService = require('../../src/services/email.service');
const {
  api,
  url,
  authHeader,
  registerUser,
  registerUnverified,
  resetDatabase,
  seedDefaultCategories,
  closeDatabase,
} = require('../helpers');

// 2026-11-09 is a Monday: the week that just ended is Mon 2026-11-02 .. Sun 2026-11-08.
const MONDAY = '2026-11-09';

let emailSpy;
beforeEach(async () => {
  await resetDatabase();
  await seedDefaultCategories();
  emailSpy = jest.spyOn(emailService, 'sendWeeklySummaryEmail').mockResolvedValue(true);
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
const makeCategory = async (token, name) =>
  (await as(token, 'post', '/categories', { name, type: 'expense' })).body.data.category;
const notificationsOf = async (token) =>
  (await as(token, 'get', '/notifications')).body.data.notifications;

/** A user with a Wallet of 5000.00, the default Food/Salary categories and a custom Rent category. */
async function setup(overrides) {
  const { accessToken: token, user } = await registerUser(overrides);
  const wallet = await makeAccount(token, { name: 'Wallet', balance: '5000' });
  const food = await categoryNamed(token, 'Food', 'expense');
  const salary = await categoryNamed(token, 'Salary', 'income');
  const rent = await makeCategory(token, 'Rent');
  return { token, user, wallet, food, salary, rent };
}

const spend = (ctx, category, amount, date) =>
  as(ctx.token, 'post', '/expenses', {
    accountId: ctx.wallet.id,
    categoryId: category.id,
    amount,
    date,
  });
const earn = (ctx, amount, date) =>
  as(ctx.token, 'post', '/incomes', {
    accountId: ctx.wallet.id,
    categoryId: ctx.salary.id,
    amount,
    date,
  });

describe('lastFullWeek', () => {
  it.each([
    ['a Monday', '2026-11-09', '2026-11-02', '2026-11-08'],
    ['a Wednesday', '2026-11-11', '2026-11-02', '2026-11-08'],
    ['a Sunday', '2026-11-08', '2026-10-26', '2026-11-01'],
    ['a week that crosses the new year', '2027-01-05', '2026-12-28', '2027-01-03'],
  ])('on %s (%s) the week is %s to %s', (_name, asOf, from, to) => {
    const week = weeklySummaryService.lastFullWeek(asOf);

    expect(week.from).toBe(from);
    expect(week.to).toBe(to);
  });

  it('also gives the week before, for the comparison', () => {
    expect(weeklySummaryService.lastFullWeek(MONDAY).previous).toEqual({
      from: '2026-10-26',
      to: '2026-11-01',
    });
  });
});

describe('sendAll', () => {
  it('sends a notification and an email with the numbers of the last full week', async () => {
    const ctx = await setup();
    await earn(ctx, '1000.00', '2026-11-04');
    await spend(ctx, ctx.food, '100.00', '2026-11-03');
    await spend(ctx, ctx.rent, '50.00', '2026-11-08');
    await spend(ctx, ctx.food, '80.00', '2026-10-28'); // the week before: 80 -> 150 = +87.5%
    await spend(ctx, ctx.food, '999.00', '2026-11-09'); // after the week: not counted

    const result = await weeklySummaryService.sendAll(MONDAY);

    expect(result).toEqual({
      week: { from: '2026-11-02', to: '2026-11-08' },
      users: 1,
      sent: 1,
      failed: 0,
    });
    const [notification] = await notificationsOf(ctx.token);
    expect(notification).toMatchObject({
      type: 'weekly_summary',
      title: 'Your week: Nov 2 - Nov 8, 2026',
      isRead: false,
    });
    expect(notification.message).toBe(
      'Income 1000.00 USD, expenses 150.00 USD, net 850.00 USD. ' +
        'Biggest category: Food (100.00). Spending is up 87.5% on the week before.',
    );
    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0][0]).toMatchObject({
      user: expect.objectContaining({ email: 'test@example.com' }),
      summary: {
        currency: 'USD',
        income: '1000.00',
        expense: '150.00',
        net: '850.00',
        topCategories: [
          { name: 'Food', total: '100.00', percent: 66.7 },
          { name: 'Rent', total: '50.00', percent: 33.3 },
        ],
      },
    });
  });

  it('is safe to run again: every week is sent once per user', async () => {
    const ctx = await setup();
    await spend(ctx, ctx.food, '10.00', '2026-11-03');

    const first = await weeklySummaryService.sendAll(MONDAY);
    const second = await weeklySummaryService.sendAll('2026-11-11'); // a Wednesday: same week

    expect(first.sent).toBe(1);
    expect(second).toMatchObject({ users: 0, sent: 0 });
    expect(await notificationsOf(ctx.token)).toHaveLength(1);
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  it('two runs at the same moment still send one summary', async () => {
    const ctx = await setup();
    await spend(ctx, ctx.food, '10.00', '2026-11-03');

    await Promise.all([weeklySummaryService.sendAll(MONDAY), weeklySummaryService.sendAll(MONDAY)]);

    expect(await notificationsOf(ctx.token)).toHaveLength(1);
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  it('sends the next week as a new summary', async () => {
    const ctx = await setup();
    await spend(ctx, ctx.food, '10.00', '2026-11-03');
    await spend(ctx, ctx.food, '20.00', '2026-11-10');

    await weeklySummaryService.sendAll(MONDAY);
    const next = await weeklySummaryService.sendAll('2026-11-16');

    expect(next.sent).toBe(1);
    const messages = (await notificationsOf(ctx.token)).map((n) => n.message);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('expenses 20.00 USD');
    expect(messages[1]).toContain('expenses 10.00 USD');
  });

  it('sends nothing to a user who had no income or expense that week', async () => {
    const ctx = await setup();
    await spend(ctx, ctx.food, '10.00', '2026-10-20'); // two weeks earlier

    const result = await weeklySummaryService.sendAll(MONDAY);

    expect(result).toMatchObject({ users: 1, sent: 0, failed: 0 });
    expect(await notificationsOf(ctx.token)).toHaveLength(0);
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it('skips accounts that did not verify their email', async () => {
    const ctx = await setup({ email: 'verified@example.com' });
    await spend(ctx, ctx.food, '10.00', '2026-11-03');
    await registerUnverified({ email: 'unverified@example.com' });

    const result = await weeklySummaryService.sendAll(MONDAY);

    expect(result).toMatchObject({ users: 1, sent: 1 });
  });

  it("keeps every user's numbers apart and uses the profile currency", async () => {
    const alice = await setup({ email: 'alice@example.com' });
    const bob = await registerUser({ email: 'bob@example.com' });
    await as(bob.accessToken, 'put', '/users/me', { currency: 'EUR' });
    const bobAccount = await makeAccount(bob.accessToken, { name: 'Euro wallet', balance: '500' });
    const bobFood = await categoryNamed(bob.accessToken, 'Food', 'expense');
    await spend(alice, alice.food, '10.00', '2026-11-03');
    await as(bob.accessToken, 'post', '/expenses', {
      accountId: bobAccount.id,
      categoryId: bobFood.id,
      amount: '25.00',
      date: '2026-11-03',
    });

    const result = await weeklySummaryService.sendAll(MONDAY);

    expect(result.sent).toBe(2);
    const [aliceNote] = await notificationsOf(alice.token);
    const [bobNote] = await notificationsOf(bob.accessToken);
    expect(aliceNote.message).toContain('expenses 10.00 USD');
    expect(bobNote.message).toContain('expenses 25.00 EUR');
  });

  it('still sends the notification when the email fails', async () => {
    const ctx = await setup();
    await spend(ctx, ctx.food, '10.00', '2026-11-03');
    emailSpy.mockRejectedValue(new Error('smtp down'));

    const result = await weeklySummaryService.sendAll(MONDAY);

    expect(result).toMatchObject({ sent: 1, failed: 0 });
    expect(await notificationsOf(ctx.token)).toHaveLength(1);
  });

  it('removes the sent marks together with the user', async () => {
    const ctx = await setup();
    await spend(ctx, ctx.food, '10.00', '2026-11-03');
    await weeklySummaryService.sendAll(MONDAY);
    expect((await db.query('SELECT 1 FROM weekly_summaries')).rowCount).toBe(1);

    await db.query('DELETE FROM users WHERE id = $1', [ctx.user.id]);

    expect((await db.query('SELECT 1 FROM weekly_summaries')).rowCount).toBe(0);
  });
});
