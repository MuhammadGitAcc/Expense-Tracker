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
const addBudget = (token, body) => as(token, 'post', '/budgets', body);
const getBudget = (token, id) => as(token, 'get', `/budgets/${id}`);
const putBudget = (token, id, body) => as(token, 'put', `/budgets/${id}`, body);
const delBudget = (token, id) => as(token, 'delete', `/budgets/${id}`);
const listBudgets = (token, query = '') => as(token, 'get', `/budgets${query}`);
const addExpense = (token, body) => as(token, 'post', '/expenses', body);
const makeAccount = async (token, body) =>
  (await as(token, 'post', '/accounts', body)).body.data.account;
const categoryNamed = async (token, name, type = 'expense') =>
  (await as(token, 'get', '/categories')).body.data.categories.find(
    (c) => c.name === name && c.type === type,
  );
const makeCategory = async (token, name, type = 'expense') =>
  (await as(token, 'post', '/categories', { name, type })).body.data.category;

/** A signed-up user with a Wallet of 1000.00, the default Food category and a custom Commute category. */
async function setup(overrides) {
  const { accessToken: token, user } = await registerUser(overrides);
  const wallet = await makeAccount(token, { name: 'Wallet', balance: '1000' });
  const food = await categoryNamed(token, 'Food');
  const transport = await makeCategory(token, 'Commute');
  return { token, user, wallet, food, transport };
}

const NOV = { month: 11, year: 2026 };

describe('authentication', () => {
  it('rejects every route without a token', async () => {
    expect((await api().get(url('/budgets'))).status).toBe(401);
    expect((await api().post(url('/budgets')).send({})).status).toBe(401);
  });
});

describe('POST /budgets', () => {
  it('creates a category budget with the default alert level and nothing spent yet', async () => {
    const { token, food } = await setup();

    const res = await addBudget(token, { categoryId: food.id, amount: 300, ...NOV });

    expect(res.status).toBe(201);
    expect(res.body.data.budget).toMatchObject({
      category: { id: food.id, name: 'Food' },
      amount: '300.00',
      month: 11,
      year: 2026,
      alertThreshold: 80,
      spent: '0.00',
      remaining: '300.00',
      percentUsed: 0,
      status: 'ok',
    });
  });

  it('creates an overall budget with a custom alert level (categoryId left out or null)', async () => {
    const { token } = await setup();

    const left = await addBudget(token, { amount: '1800.50', alertThreshold: 90, ...NOV });
    const explicit = await addBudget(token, {
      categoryId: null,
      amount: 1000,
      month: 12,
      year: 2026,
    });

    expect(left.status).toBe(201);
    expect(left.body.data.budget).toMatchObject({
      category: null,
      amount: '1800.50',
      alertThreshold: 90,
    });
    expect(explicit.status).toBe(201);
    expect(explicit.body.data.budget.category).toBeNull();
  });

  it('accepts a custom expense category of the user', async () => {
    const { token } = await setup();
    const hobby = await makeCategory(token, 'Hobby');

    const res = await addBudget(token, { categoryId: hobby.id, amount: 50, ...NOV });

    expect(res.status).toBe(201);
    expect(res.body.data.budget.category.name).toBe('Hobby');
  });

  it('rejects bad references and bad input, and creates nothing', async () => {
    const { token, food } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const salary = await categoryNamed(token, 'Salary', 'income');
    const theirCategory = await makeCategory(other.token, 'Secret');
    const base = { categoryId: food.id, amount: 100, ...NOV };

    const cases = await Promise.all([
      addBudget(token, { ...base, categoryId: salary.id }), // income category: 400
      addBudget(token, { ...base, categoryId: UNKNOWN_ID }), // 404
      addBudget(token, { ...base, categoryId: theirCategory.id }), // other user's category: 404
      addBudget(token, { ...base, amount: 0 }),
      addBudget(token, { ...base, amount: -1 }),
      addBudget(token, { ...base, amount: '1.234' }),
      addBudget(token, { ...base, month: 0 }),
      addBudget(token, { ...base, month: 13 }),
      addBudget(token, { ...base, month: 1.5 }),
      addBudget(token, { ...base, year: 1999 }),
      addBudget(token, { ...base, alertThreshold: 0 }),
      addBudget(token, { ...base, alertThreshold: 101 }),
      addBudget(token, { ...base, userId: other.user.id }), // unknown field
      addBudget(token, { categoryId: food.id, ...NOV }), // amount missing
      addBudget(token, { categoryId: food.id, amount: 100 }), // month and year missing
    ]);

    expect(cases.map((res) => res.status)).toEqual([
      400, 404, 404, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400,
    ]);
    expect((await listBudgets(token, '?month=11&year=2026')).body.meta.total).toBe(0);
  });

  it('allows one budget per category and month, and one overall budget per month', async () => {
    const { token, food, transport } = await setup();
    const other = await setup({ email: 'other@example.com' });

    const first = await addBudget(token, { categoryId: food.id, amount: 300, ...NOV });
    const duplicate = await addBudget(token, { categoryId: food.id, amount: 999, ...NOV });
    const otherMonth = await addBudget(token, {
      categoryId: food.id,
      amount: 300,
      month: 12,
      year: 2026,
    });
    const otherCategory = await addBudget(token, { categoryId: transport.id, amount: 100, ...NOV });
    const overall = await addBudget(token, { amount: 1800, ...NOV });
    const secondOverall = await addBudget(token, { amount: 2000, ...NOV });
    const otherUser = await addBudget(other.token, {
      categoryId: other.food.id,
      amount: 300,
      ...NOV,
    });

    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toBe('A budget for this category and month already exists');
    expect(otherMonth.status).toBe(201);
    expect(otherCategory.status).toBe(201);
    expect(overall.status).toBe(201);
    expect(secondOverall.status).toBe(409);
    expect(secondOverall.body.message).toBe('An overall budget for this month already exists');
    expect(otherUser.status).toBe(201);
  });
});

describe('spent versus limit', () => {
  it('counts only the expenses of its month and category (the overall budget counts all)', async () => {
    const { token, wallet, food, transport } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const spend = (categoryId, amount, date) =>
      addExpense(token, { accountId: wallet.id, categoryId, amount, date });

    await spend(food.id, 100, '2026-11-02');
    await spend(food.id, 50.5, '2026-11-30');
    await spend(food.id, 70, '2026-10-31'); // previous month: not counted
    await spend(food.id, 20, '2026-12-01'); // next month: not counted
    await spend(transport.id, 40, '2026-11-10'); // other category: counts only for overall
    await addExpense(other.token, {
      accountId: other.wallet.id,
      categoryId: other.food.id,
      amount: 500,
      date: '2026-11-05',
    }); // another user: never counted

    const foodBudget = (await addBudget(token, { categoryId: food.id, amount: 300, ...NOV })).body
      .data.budget;
    const overall = (await addBudget(token, { amount: 1000, ...NOV })).body.data.budget;

    expect(foodBudget).toMatchObject({
      spent: '150.50',
      remaining: '149.50',
      percentUsed: 50.2,
      status: 'ok',
    });
    expect(overall).toMatchObject({ spent: '190.50', remaining: '809.50', percentUsed: 19.1 });
  });

  it('moves from ok to warning to exceeded and follows edits and deletes of expenses', async () => {
    const { token, wallet, food } = await setup();
    const budget = (
      await addBudget(token, { categoryId: food.id, amount: 100, alertThreshold: 80, ...NOV })
    ).body.data.budget;
    const spend = async (amount) =>
      (
        await addExpense(token, {
          accountId: wallet.id,
          categoryId: food.id,
          amount,
          date: '2026-11-15',
        })
      ).body.data.expense;
    const read = async () => (await getBudget(token, budget.id)).body.data.budget;

    await spend(79.99);
    expect(await read()).toMatchObject({ spent: '79.99', status: 'ok' });

    await spend(0.01); // exactly 80%: the alert level is reached
    expect(await read()).toMatchObject({ spent: '80.00', status: 'warning' });

    await spend(20); // exactly 100%: used up, but not over the limit
    expect(await read()).toMatchObject({ spent: '100.00', percentUsed: 100, status: 'warning' });

    const last = await spend(0.01);
    expect(await read()).toMatchObject({ spent: '100.01', remaining: '-0.01', status: 'exceeded' });

    await as(token, 'delete', `/expenses/${last.id}`);
    expect(await read()).toMatchObject({ spent: '100.00', status: 'warning' });
  });
});

describe('GET /budgets', () => {
  it('lists the overall budget first, then categories by name, for the month asked', async () => {
    const { token, food, transport } = await setup();
    await addBudget(token, { categoryId: transport.id, amount: 100, ...NOV });
    await addBudget(token, { categoryId: food.id, amount: 300, ...NOV });
    await addBudget(token, { amount: 1800, ...NOV });
    await addBudget(token, { categoryId: food.id, amount: 250, month: 12, year: 2026 });

    const res = await listBudgets(token, '?month=11&year=2026');

    expect(res.status).toBe(200);
    expect(res.body.data.budgets.map((b) => b.category?.name ?? 'overall')).toEqual([
      'overall',
      'Commute',
      'Food',
    ]);
    expect(res.body.meta).toMatchObject({ month: 11, year: 2026, total: 3 });
  });

  it('shows the current month when month and year are left out', async () => {
    const { token, food } = await setup();
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    await addBudget(token, { categoryId: food.id, amount: 300, month, year });
    await addBudget(token, { categoryId: food.id, amount: 300, month: 1, year: 2030 });

    const res = await listBudgets(token);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ month, year, total: 1 });
  });

  it('rejects invalid query values', async () => {
    const { token } = await setup();

    const bad = await Promise.all([
      listBudgets(token, '?month=13'),
      listBudgets(token, '?month=0'),
      listBudgets(token, '?year=1999'),
      listBudgets(token, '?month=abc'),
    ]);

    bad.forEach((res) => expect(res.status).toBe(400));
  });

  it('never shows the budgets of another user', async () => {
    const { token, food } = await setup();
    const other = await setup({ email: 'other@example.com' });
    await addBudget(token, { categoryId: food.id, amount: 300, ...NOV });
    await addBudget(other.token, { amount: 999, ...NOV });

    const mine = await listBudgets(token, '?month=11&year=2026');
    const theirs = await listBudgets(other.token, '?month=11&year=2026');

    expect(mine.body.data.budgets.map((b) => b.amount)).toEqual(['300.00']);
    expect(theirs.body.data.budgets.map((b) => b.amount)).toEqual(['999.00']);
  });
});

describe('GET /budgets/:id', () => {
  it('returns an own budget, 404 for another user, 400 for a malformed id', async () => {
    const { token, food } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const mine = (await addBudget(token, { categoryId: food.id, amount: 300, ...NOV })).body.data
      .budget;

    expect((await getBudget(token, mine.id)).status).toBe(200);
    expect((await getBudget(other.token, mine.id)).status).toBe(404);
    expect((await getBudget(token, UNKNOWN_ID)).status).toBe(404);
    expect((await getBudget(token, 'not-a-uuid')).status).toBe(400);
  });
});

describe('PUT /budgets/:id', () => {
  it('changes the limit and the alert level and recalculates the numbers', async () => {
    const { token, wallet, food } = await setup();
    const budget = (await addBudget(token, { categoryId: food.id, amount: 100, ...NOV })).body.data
      .budget;
    await addExpense(token, {
      accountId: wallet.id,
      categoryId: food.id,
      amount: 60,
      date: '2026-11-10',
    });

    const res = await putBudget(token, budget.id, { amount: '200.00', alertThreshold: 25 });

    expect(res.status).toBe(200);
    expect(res.body.data.budget).toMatchObject({
      amount: '200.00',
      alertThreshold: 25,
      spent: '60.00',
      remaining: '140.00',
      percentUsed: 30,
      status: 'warning',
    });
  });

  it('changes only the fields that are sent', async () => {
    const { token, food } = await setup();
    const budget = (
      await addBudget(token, { categoryId: food.id, amount: 100, alertThreshold: 70, ...NOV })
    ).body.data.budget;

    const res = await putBudget(token, budget.id, { amount: 150 });

    expect(res.body.data.budget).toMatchObject({ amount: '150.00', alertThreshold: 70 });
  });

  it('rejects bad updates and changes nothing', async () => {
    const { token, food, transport } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const budget = (await addBudget(token, { categoryId: food.id, amount: 100, ...NOV })).body.data
      .budget;

    const cases = await Promise.all([
      putBudget(token, budget.id, {}), // 400
      putBudget(token, budget.id, { month: 12 }), // month cannot change: 400
      putBudget(token, budget.id, { categoryId: transport.id }), // category cannot change: 400
      putBudget(token, budget.id, { amount: 0 }), // 400
      putBudget(token, budget.id, { alertThreshold: 101 }), // 400
      putBudget(other.token, budget.id, { amount: 1 }), // not theirs: 404
      putBudget(token, UNKNOWN_ID, { amount: 1 }), // 404
    ]);

    expect(cases.map((res) => res.status)).toEqual([400, 400, 400, 400, 400, 404, 404]);
    expect((await getBudget(token, budget.id)).body.data.budget.amount).toBe('100.00');
  });
});

describe('DELETE /budgets/:id', () => {
  it('deletes an own budget', async () => {
    const { token, food } = await setup();
    const budget = (await addBudget(token, { categoryId: food.id, amount: 100, ...NOV })).body.data
      .budget;

    const res = await delBudget(token, budget.id);

    expect(res.status).toBe(200);
    expect((await getBudget(token, budget.id)).status).toBe(404);
    expect((await delBudget(token, budget.id)).status).toBe(404);
  });

  it('answers 404 for another user and leaves their budget alone', async () => {
    const { token, food } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const budget = (await addBudget(token, { categoryId: food.id, amount: 100, ...NOV })).body.data
      .budget;

    const res = await delBudget(other.token, budget.id);

    expect(res.status).toBe(404);
    expect((await getBudget(token, budget.id)).status).toBe(200);
  });

  it('is removed together with its category when that category is deleted', async () => {
    const { token } = await setup();
    const hobby = await makeCategory(token, 'Hobby');
    const budget = (await addBudget(token, { categoryId: hobby.id, amount: 50, ...NOV })).body.data
      .budget;

    const removed = await as(token, 'delete', `/categories/${hobby.id}`);

    expect(removed.status).toBe(200);
    expect((await getBudget(token, budget.id)).status).toBe(404);
  });
});
