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
const get = (token, path) => as(token, 'get', path);

const makeAccount = async (token, body) =>
  (await as(token, 'post', '/accounts', body)).body.data.account;
const categoryNamed = async (token, name, type = 'expense') =>
  (await get(token, '/categories')).body.data.categories.find(
    (c) => c.name === name && c.type === type,
  );
const makeCategory = async (token, name, type = 'expense') =>
  (await as(token, 'post', '/categories', { name, type })).body.data.category;

/**
 * Known data (USD wallet 1000.00 and a EUR account 500.00):
 *   2026-10-20  expense Food    100.00  (October, the month before)
 *   2026-10-25  income  Salary  1000.00
 *   2026-11-02  expense Food    30.10   wallet
 *   2026-11-02  expense Commute 20.00   wallet
 *   2026-11-05  expense Food    49.90   bank (USD, archived later in one test)
 *   2026-11-10  income  Salary  2000.00 wallet
 *   2026-11-12  expense Food    999.00  EUR account (must NOT mix into USD totals)
 * USD November: income 2000.00, expense 100.00, savings 1900.00 (95.0 %)
 */
async function setup() {
  const { accessToken: token, user } = await registerUser();
  const wallet = await makeAccount(token, { name: 'Wallet', balance: '1000', currency: 'USD' });
  const bank = await makeAccount(token, {
    name: 'Bank',
    type: 'bank',
    balance: '0',
    currency: 'USD',
  });
  const euro = await makeAccount(token, { name: 'Euro', balance: '500', currency: 'EUR' });
  const food = await categoryNamed(token, 'Food');
  const salary = await categoryNamed(token, 'Salary', 'income');
  const commute = await makeCategory(token, 'Commute');

  const expense = (account, category, amount, date) =>
    as(token, 'post', '/expenses', {
      accountId: account.id,
      categoryId: category.id,
      amount,
      date,
    });
  const income = (account, amount, date) =>
    as(token, 'post', '/incomes', {
      accountId: account.id,
      categoryId: salary.id,
      amount,
      date,
      source: 'ACME',
    });

  for (const res of [
    await expense(wallet, food, '100.00', '2026-10-20'),
    await income(wallet, '1000.00', '2026-10-25'),
    await expense(wallet, food, '30.10', '2026-11-02'),
    await expense(wallet, commute, '20.00', '2026-11-02'),
    await expense(bank, food, '49.90', '2026-11-05'),
    await income(wallet, '2000.00', '2026-11-10'),
    await expense(euro, food, '999.00', '2026-11-12'),
  ]) {
    if (res.status !== 201) throw new Error(`setup failed: ${JSON.stringify(res.body)}`);
  }
  return { token, user, wallet, bank, euro, food, salary, commute };
}

const NOVEMBER = 'period=custom&from=2026-11-01&to=2026-11-30';

describe('authentication', () => {
  it('rejects every insights route without a token', async () => {
    for (const path of [
      '/dashboard/summary',
      '/dashboard/trends',
      '/reports/monthly',
      '/reports/yearly',
      '/reports/by-category?from=2026-11-01&to=2026-11-30',
      '/reports/by-account?from=2026-11-01&to=2026-11-30',
    ]) {
      expect((await api().get(url(path))).status).toBe(401);
    }
  });
});

describe('GET /dashboard/summary', () => {
  it('returns exact totals for one period in the profile currency only', async () => {
    const { token } = await setup();

    const res = await get(token, `/dashboard/summary?${NOVEMBER}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      currency: 'USD',
      period: { key: 'custom', from: '2026-11-01', to: '2026-11-30' },
      income: '2000.00',
      expense: '100.00',
      savings: '1900.00',
      savingsRate: 95,
      transactionCount: 4,
    });
    expect(res.body.meta.availableCurrencies).toEqual(['EUR', 'USD']);
  });

  it('compares with the previous period', async () => {
    const { token } = await setup();

    const res = await get(token, `/dashboard/summary?${NOVEMBER}`);

    // previous = the 30 days before 2026-11-01 = 2026-10-02 .. 2026-10-31
    expect(res.body.data.previous).toMatchObject({
      from: '2026-10-02',
      to: '2026-10-31',
      income: '1000.00',
      expense: '100.00',
      savings: '900.00',
    });
    expect(res.body.data.change).toEqual({ income: 100, expense: 0 });
  });

  it('sums the balance of active accounts of the currency and lists recent transactions', async () => {
    const { token, bank } = await setup();
    // wallet: 1000 -100 +1000 -30.10 -20 +2000 = 3849.90 ; bank: 0 -49.90 = -49.90 ; total 3800.00
    let res = await get(token, '/dashboard/summary?period=this_year');
    expect(res.body.data.balance).toEqual({ total: '3800.00', accountCount: 2 });

    await as(token, 'post', `/accounts/${bank.id}/archive`);
    res = await get(token, '/dashboard/summary?period=this_year');
    expect(res.body.data.balance).toEqual({ total: '3849.90', accountCount: 1 });

    const recent = res.body.data.recentTransactions;
    expect(recent).toHaveLength(5);
    expect(recent[0]).toMatchObject({
      type: 'income',
      amount: '2000.00',
      date: '2026-11-10',
      source: 'ACME',
    });
    expect(recent.every((t) => t.account.name !== 'Euro')).toBe(true);
  });

  it('shows another currency when asked', async () => {
    const { token } = await setup();

    const res = await get(token, `/dashboard/summary?${NOVEMBER}&currency=eur`);

    expect(res.body.data).toMatchObject({
      currency: 'EUR',
      income: '0.00',
      expense: '999.00',
      savings: '-999.00',
      savingsRate: null,
    });
    expect(res.body.data.balance).toEqual({ total: '-499.00', accountCount: 1 });
  });

  it('uses zeros for a brand new user and ignores other users data', async () => {
    await setup();
    const { accessToken } = await registerUser({ email: 'other@example.com' });

    const res = await get(accessToken, '/dashboard/summary');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      income: '0.00',
      expense: '0.00',
      savings: '0.00',
      savingsRate: null,
      balance: { total: '0.00', accountCount: 0 },
      recentTransactions: [],
      change: { income: null, expense: null },
    });
  });

  it('leaves transfers out of income and expense', async () => {
    const { token, wallet, bank } = await setup();
    await as(token, 'post', '/accounts/transfers', {
      fromAccountId: wallet.id,
      toAccountId: bank.id,
      amount: '250.00',
      date: '2026-11-15',
    });

    const res = await get(token, `/dashboard/summary?${NOVEMBER}`);

    expect(res.body.data).toMatchObject({ income: '2000.00', expense: '100.00' });
  });

  it('validates the query', async () => {
    const { token } = await setup();
    for (const query of [
      'period=forever',
      'period=custom',
      'period=custom&from=2026-11-01',
      'from=2026-11-30&to=2026-11-01',
      'period=this_month&from=2026-11-01&to=2026-11-30',
      'from=2026-02-31&to=2026-03-01',
      'currency=EURO',
      'from=2000-01-01&to=2026-11-01',
    ]) {
      const res = await get(token, `/dashboard/summary?${query}`);
      expect([query, res.status]).toEqual([query, 400]);
    }
  });
});

describe('GET /dashboard/trends', () => {
  it('returns one point per day with empty days filled', async () => {
    const { token } = await setup();

    const res = await get(token, `/dashboard/trends?${NOVEMBER}`);

    expect(res.status).toBe(200);
    expect(res.body.data.granularity).toBe('day');
    const { series } = res.body.data;
    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({
      period: '2026-11-01',
      income: '0.00',
      expense: '0.00',
      net: '0.00',
    });
    expect(series[1]).toEqual({
      period: '2026-11-02',
      income: '0.00',
      expense: '50.10',
      net: '-50.10',
    });
    expect(series[9]).toEqual({
      period: '2026-11-10',
      income: '2000.00',
      expense: '0.00',
      net: '2000.00',
    });
  });

  it('returns one point per month for a year', async () => {
    const { token } = await setup();

    const res = await get(token, '/dashboard/trends?period=custom&from=2026-01-01&to=2026-12-31');

    expect(res.body.data.granularity).toBe('month');
    const { series } = res.body.data;
    expect(series).toHaveLength(12);
    expect(series[9]).toEqual({
      period: '2026-10',
      income: '1000.00',
      expense: '100.00',
      net: '900.00',
    });
    expect(series[10]).toEqual({
      period: '2026-11',
      income: '2000.00',
      expense: '100.00',
      net: '1900.00',
    });
    expect(series[0]).toMatchObject({ period: '2026-01', income: '0.00' });
  });

  it('refuses daily points for more than 366 days', async () => {
    const { token } = await setup();

    const res = await get(
      token,
      '/dashboard/trends?period=custom&from=2025-01-01&to=2026-12-31&granularity=day',
    );

    expect(res.status).toBe(400);
  });
});

describe('GET /reports/monthly', () => {
  it('returns totals, comparison, daily series and category breakdowns', async () => {
    const { token } = await setup();

    const res = await get(token, '/reports/monthly?year=2026&month=11');

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toMatchObject({
      currency: 'USD',
      year: 2026,
      month: 11,
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(d.totals).toMatchObject({
      income: '2000.00',
      expense: '100.00',
      savings: '1900.00',
      savingsRate: 95,
      incomeCount: 1,
      expenseCount: 3,
    });
    expect(d.previous).toMatchObject({
      year: 2026,
      month: 10,
      income: '1000.00',
      expense: '100.00',
    });
    expect(d.change).toEqual({ income: 100, expense: 0 });
    expect(d.daily).toHaveLength(30);
    expect(d.expenseByCategory).toEqual([
      expect.objectContaining({
        category: expect.objectContaining({ name: 'Food' }),
        total: '80.00',
        count: 2,
        percent: 80,
      }),
      expect.objectContaining({
        category: expect.objectContaining({ name: 'Commute' }),
        total: '20.00',
        count: 1,
        percent: 20,
      }),
    ]);
    expect(d.incomeByCategory).toHaveLength(1);
    expect(d.incomeByCategory[0]).toMatchObject({ total: '2000.00', percent: 100 });
  });

  it('wraps January to December of the year before and validates input', async () => {
    const { token } = await setup();

    const res = await get(token, '/reports/monthly?year=2026&month=1');
    expect(res.body.data.previous).toMatchObject({ year: 2025, month: 12 });

    for (const query of ['month=13', 'month=0', 'year=1999', 'year=abc']) {
      expect((await get(token, `/reports/monthly?${query}`)).status).toBe(400);
    }
  });

  it('defaults to the current month', async () => {
    const { token } = await setup();
    const res = await get(token, '/reports/monthly');
    expect(res.status).toBe(200);
    expect(res.body.data.daily.length).toBeGreaterThanOrEqual(28);
  });
});

describe('GET /reports/yearly', () => {
  it('returns 12 months, totals and breakdowns', async () => {
    const { token } = await setup();

    const res = await get(token, '/reports/yearly?year=2026');

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.totals).toMatchObject({ income: '3000.00', expense: '200.00', savings: '2800.00' });
    expect(d.monthly).toHaveLength(12);
    expect(d.monthly[10]).toMatchObject({
      period: '2026-11',
      income: '2000.00',
      expense: '100.00',
    });
    expect(d.expenseByCategory[0]).toMatchObject({ total: '180.00', count: 3 });
    expect(d.previous).toMatchObject({ year: 2025, income: '0.00' });
    expect(d.change.income).toBeNull();
  });
});

describe('GET /reports/by-category', () => {
  it('lists expense categories for a range, biggest first', async () => {
    const { token } = await setup();

    const res = await get(token, '/reports/by-category?from=2026-10-01&to=2026-11-30');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ currency: 'USD', type: 'expense', total: '200.00' });
    expect(res.body.data.categories.map((c) => [c.category.name, c.total, c.percent])).toEqual([
      ['Food', '180.00', 90],
      ['Commute', '20.00', 10],
    ]);
  });

  it('can list income and other currencies, and needs from and to', async () => {
    const { token } = await setup();

    const income = await get(
      token,
      '/reports/by-category?from=2026-10-01&to=2026-11-30&type=income',
    );
    expect(income.body.data.categories).toHaveLength(1);
    expect(income.body.data.total).toBe('3000.00');

    const euro = await get(
      token,
      '/reports/by-category?from=2026-11-01&to=2026-11-30&currency=EUR',
    );
    expect(euro.body.data.categories[0]).toMatchObject({ total: '999.00', percent: 100 });

    const empty = await get(token, '/reports/by-category?from=2020-01-01&to=2020-01-31');
    expect(empty.body.data).toMatchObject({ total: '0.00', categories: [] });

    for (const query of [
      '',
      'from=2026-11-01',
      'from=2026-11-30&to=2026-11-01&type=x',
      'from=2026-11-01&to=2026-11-30&type=transfer',
    ]) {
      expect((await get(token, `/reports/by-category?${query}`)).status).toBe(400);
    }
  });
});

describe('GET /reports/by-account', () => {
  it('shows income and expense per account of the currency', async () => {
    const { token } = await setup();

    const res = await get(token, '/reports/by-account?from=2026-11-01&to=2026-11-30');

    expect(res.status).toBe(200);
    expect(res.body.data.totals).toEqual({
      income: '2000.00',
      expense: '100.00',
      savings: '1900.00',
    });
    expect(res.body.data.accounts.map((a) => [a.account.name, a.income, a.expense, a.net])).toEqual(
      [
        ['Bank', '0.00', '49.90', '-49.90'],
        ['Wallet', '2000.00', '50.10', '1949.90'],
      ],
    );
  });

  it('keeps an archived account only when it had activity in the range', async () => {
    const { token, bank } = await setup();
    await as(token, 'post', `/accounts/${bank.id}/archive`);

    const busy = await get(token, '/reports/by-account?from=2026-11-01&to=2026-11-30');
    expect(busy.body.data.accounts.map((a) => a.account.name)).toEqual(['Wallet', 'Bank']);

    const quiet = await get(token, '/reports/by-account?from=2026-01-01&to=2026-01-31');
    expect(quiet.body.data.accounts.map((a) => a.account.name)).toEqual(['Wallet']);
  });
});

describe('data isolation', () => {
  it('never includes another users money', async () => {
    await setup();
    const { accessToken } = await registerUser({ email: 'other@example.com' });

    for (const path of [
      `/dashboard/summary?${NOVEMBER}`,
      '/reports/yearly?year=2026',
      '/reports/monthly?year=2026&month=11',
    ]) {
      const res = await get(accessToken, path);
      const totals = res.body.data.totals ?? res.body.data;
      expect(totals.income).toBe('0.00');
      expect(totals.expense).toBe('0.00');
    }
    const byCat = await get(accessToken, '/reports/by-category?from=2026-01-01&to=2026-12-31');
    expect(byCat.body.data.categories).toEqual([]);
  });
});
