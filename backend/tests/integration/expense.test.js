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
afterAll(closeDatabase);

const as = (token, method, path, body) => {
  const req = api()[method](url(path)).set(authHeader(token));
  return body === undefined ? req : req.send(body);
};
const addExpense = (token, body) => as(token, 'post', '/expenses', body);
const getExpense = (token, id) => as(token, 'get', `/expenses/${id}`);
const putExpense = (token, id, body) => as(token, 'put', `/expenses/${id}`, body);
const delExpense = (token, id) => as(token, 'delete', `/expenses/${id}`);
const listExpenses = (token, query = '') => as(token, 'get', `/expenses${query}`);
const makeAccount = async (token, body) =>
  (await as(token, 'post', '/accounts', body)).body.data.account;
const balanceOf = async (token, id) =>
  (await as(token, 'get', `/accounts/${id}`)).body.data.account.balance;
const categoryNamed = async (token, name, type = 'expense') =>
  (await as(token, 'get', '/categories')).body.data.categories.find(
    (c) => c.name === name && c.type === type,
  );
const makeCategory = async (token, name, type = 'expense') =>
  (await as(token, 'post', '/categories', { name, type })).body.data.category;

/** A signed-up user with a Wallet of 1000.00 and the default Food (expense) category. */
async function setup(overrides) {
  const { accessToken: token, user } = await registerUser(overrides);
  const wallet = await makeAccount(token, { name: 'Wallet', balance: '1000' });
  const food = await categoryNamed(token, 'Food');
  return { token, user, wallet, food };
}

describe('authentication', () => {
  it('rejects every route without a token', async () => {
    expect((await api().get(url('/expenses'))).status).toBe(401);
    expect((await api().post(url('/expenses')).send({})).status).toBe(401);
  });
});

describe('POST /expenses', () => {
  it('records the expense with account and category details and lowers the balance', async () => {
    const { token, wallet, food } = await setup();

    const res = await addExpense(token, {
      accountId: wallet.id,
      categoryId: food.id,
      amount: 12.5,
      date: '2026-11-01',
      note: '  Lunch ',
      tags: [' Work ', 'work', 'TEAM'],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.expense).toMatchObject({
      amount: '12.50',
      date: '2026-11-01',
      note: 'Lunch',
      paymentMethod: 'cash',
      tags: ['work', 'team'],
      receiptUrl: null,
      account: { id: wallet.id, name: 'Wallet', currency: 'USD' },
      category: { id: food.id, name: 'Food' },
    });
    expect(res.body.data.accounts[0]).toMatchObject({ id: wallet.id, balance: '987.50' });
    expect(await balanceOf(token, wallet.id)).toBe('987.50');
  });

  it('defaults the date to today and stays exact with decimals (0.1 + 0.2)', async () => {
    const { token, wallet, food } = await setup();

    const first = await addExpense(token, {
      accountId: wallet.id,
      categoryId: food.id,
      amount: 0.1,
    });
    await addExpense(token, { accountId: wallet.id, categoryId: food.id, amount: 0.2 });

    expect(first.body.data.expense.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await balanceOf(token, wallet.id)).toBe('999.70');
  });

  it('accepts a custom expense category of the user', async () => {
    const { token, wallet } = await setup();
    const taxi = await makeCategory(token, 'Taxi');

    const res = await addExpense(token, { accountId: wallet.id, categoryId: taxi.id, amount: 5 });

    expect(res.status).toBe(201);
    expect(res.body.data.expense.category.name).toBe('Taxi');
  });

  it('rejects bad references and bad input, and changes nothing', async () => {
    const { token, wallet, food } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const archived = await makeAccount(token, { name: 'Old', balance: '50' });
    await as(token, 'post', `/accounts/${archived.id}/archive`);
    const salary = await categoryNamed(token, 'Salary', 'income');
    const theirCategory = await makeCategory(other.token, 'Secret');
    const base = { accountId: wallet.id, categoryId: food.id, amount: 10 };

    const cases = await Promise.all([
      addExpense(token, { ...base, categoryId: salary.id }), // income category: 400
      addExpense(token, { ...base, categoryId: UNKNOWN_ID }), // 404
      addExpense(token, { ...base, categoryId: theirCategory.id }), // other user's category: 404
      addExpense(token, { ...base, accountId: other.wallet.id }), // other user's account: 404
      addExpense(token, { ...base, accountId: archived.id }), // archived: 400
      addExpense(token, { ...base, amount: 0 }),
      addExpense(token, { ...base, amount: -5 }),
      addExpense(token, { ...base, amount: '1.234' }),
      addExpense(token, { ...base, date: '2026-02-31' }),
      addExpense(token, { ...base, paymentMethod: 'barter' }),
      addExpense(token, { ...base, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }),
      addExpense(token, { ...base, receiptUrl: '/x' }), // unknown field
    ]);

    expect(cases.map((res) => res.status)).toEqual([
      400, 404, 404, 404, 400, 400, 400, 400, 400, 400, 400, 400,
    ]);
    expect(await balanceOf(token, wallet.id)).toBe('1000.00');
    expect(await balanceOf(other.token, other.wallet.id)).toBe('1000.00');
    expect((await listExpenses(token)).body.meta.total).toBe(0);
  });

  it('loses no update when many expenses are added at the same time', async () => {
    const { token, wallet, food } = await setup();

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        addExpense(token, { accountId: wallet.id, categoryId: food.id, amount: 1 }),
      ),
    );

    results.forEach((res) => expect(res.status).toBe(201));
    expect(await balanceOf(token, wallet.id)).toBe('992.00');
  });
});

describe('GET /expenses/:id', () => {
  it('returns an own expense, 404 for another user, 400 for a malformed id', async () => {
    const { token, wallet, food } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const mine = (await addExpense(token, { accountId: wallet.id, categoryId: food.id, amount: 5 }))
      .body.data.expense;

    expect((await getExpense(token, mine.id)).status).toBe(200);
    expect((await getExpense(other.token, mine.id)).status).toBe(404);
    expect((await getExpense(token, UNKNOWN_ID)).status).toBe(404);
    expect((await getExpense(token, 'not-a-uuid')).status).toBe(400);
  });
});

describe('PUT /expenses/:id', () => {
  it('keeps the balance right when the amount changes', async () => {
    const { token, wallet, food } = await setup();
    const { expense } = (
      await addExpense(token, { accountId: wallet.id, categoryId: food.id, amount: 30 })
    ).body.data;

    const raise = await putExpense(token, expense.id, { amount: 50 });
    expect(await balanceOf(token, wallet.id)).toBe('950.00');
    await putExpense(token, expense.id, { amount: 10.25 });

    expect(raise.status).toBe(200);
    expect(raise.body.data.expense.amount).toBe('50.00');
    expect(raise.body.data.accounts[0].balance).toBe('950.00');
    expect(await balanceOf(token, wallet.id)).toBe('989.75');
  });

  it('moves the money when the account changes', async () => {
    const { token, wallet, food } = await setup();
    const bank = await makeAccount(token, { name: 'Bank', balance: '500' });
    const { expense } = (
      await addExpense(token, { accountId: wallet.id, categoryId: food.id, amount: 30 })
    ).body.data;

    const res = await putExpense(token, expense.id, { accountId: bank.id });

    expect(res.status).toBe(200);
    expect(res.body.data.expense.account.id).toBe(bank.id);
    expect(res.body.data.accounts).toHaveLength(2);
    expect(await balanceOf(token, wallet.id)).toBe('1000.00');
    expect(await balanceOf(token, bank.id)).toBe('470.00');
  });

  it('changes note, category, date, tags and payment method without touching balances', async () => {
    const { token, wallet, food } = await setup();
    const taxi = await makeCategory(token, 'Taxi');
    const { expense } = (
      await addExpense(token, {
        accountId: wallet.id,
        categoryId: food.id,
        amount: 30,
        note: 'Old note',
      })
    ).body.data;

    const res = await putExpense(token, expense.id, {
      categoryId: taxi.id,
      note: null,
      date: '2026-10-10',
      tags: ['trip'],
      paymentMethod: 'card',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.expense).toMatchObject({
      note: null,
      date: '2026-10-10',
      tags: ['trip'],
      paymentMethod: 'card',
      category: { name: 'Taxi' },
    });
    expect(res.body.data.accounts).toEqual([]);
    expect(await balanceOf(token, wallet.id)).toBe('970.00');
  });

  it('rejects bad updates and changes nothing', async () => {
    const { token, wallet, food } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const archived = await makeAccount(token, { name: 'Old' });
    await as(token, 'post', `/accounts/${archived.id}/archive`);
    const salary = await categoryNamed(token, 'Salary', 'income');
    const { expense } = (
      await addExpense(token, { accountId: wallet.id, categoryId: food.id, amount: 30 })
    ).body.data;

    const cases = await Promise.all([
      putExpense(token, expense.id, { categoryId: salary.id }), // 400
      putExpense(token, expense.id, { accountId: archived.id }), // 400
      putExpense(token, expense.id, { accountId: other.wallet.id }), // 404
      putExpense(token, expense.id, { amount: 0 }), // 400
      putExpense(token, expense.id, {}), // 400
      putExpense(token, expense.id, { userId: other.user.id }), // 400
      putExpense(other.token, expense.id, { amount: 1 }), // 404: not theirs
    ]);

    expect(cases.map((res) => res.status)).toEqual([400, 400, 404, 400, 400, 400, 404]);
    expect(await balanceOf(token, wallet.id)).toBe('970.00');
    expect((await getExpense(token, expense.id)).body.data.expense.amount).toBe('30.00');
  });

  it('keeps balance and amount consistent when the same expense is edited at the same time', async () => {
    const { token, wallet, food } = await setup();
    const { expense } = (
      await addExpense(token, { accountId: wallet.id, categoryId: food.id, amount: 10 })
    ).body.data;

    const results = await Promise.all(
      [11, 12, 13, 14, 15].map((amount) => putExpense(token, expense.id, { amount })),
    );

    results.forEach((res) => expect(res.status).toBe(200));
    const finalAmount = Number((await getExpense(token, expense.id)).body.data.expense.amount);
    expect(Number(await balanceOf(token, wallet.id))).toBe(1000 - finalAmount);
  });
});

describe('DELETE /expenses/:id', () => {
  it('gives the amount back to the account', async () => {
    const { token, wallet, food } = await setup();
    const { expense } = (
      await addExpense(token, { accountId: wallet.id, categoryId: food.id, amount: 30 })
    ).body.data;

    const res = await delExpense(token, expense.id);

    expect(res.status).toBe(200);
    expect(res.body.data.accounts[0].balance).toBe('1000.00');
    expect(await balanceOf(token, wallet.id)).toBe('1000.00');
    expect((await getExpense(token, expense.id)).status).toBe(404);
  });

  it('answers 404 for another user and leaves their expense and balance alone', async () => {
    const { token, wallet, food } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const { expense } = (
      await addExpense(token, { accountId: wallet.id, categoryId: food.id, amount: 30 })
    ).body.data;

    const res = await delExpense(other.token, expense.id);

    expect(res.status).toBe(404);
    expect((await getExpense(token, expense.id)).status).toBe(200);
    expect(await balanceOf(token, wallet.id)).toBe('970.00');
  });
});

describe('GET /expenses (filters, search, sorting, pagination)', () => {
  // Four expenses, total 100.50: dates, amounts, categories, accounts, tags and notes differ.
  async function seedExpenses() {
    const { token, wallet, food } = await setup();
    const bank = await makeAccount(token, { name: 'Bank', balance: '500' });
    const transport = await makeCategory(token, 'Transport');
    const add = (body) => addExpense(token, body);

    await add({
      accountId: wallet.id,
      categoryId: food.id,
      amount: 10,
      date: '2026-10-01',
      note: 'Lunch at cafe',
      tags: ['work'],
    });
    await add({
      accountId: wallet.id,
      categoryId: food.id,
      amount: 20,
      date: '2026-10-15',
      note: '50% off sale',
      paymentMethod: 'card',
    });
    await add({
      accountId: wallet.id,
      categoryId: transport.id,
      amount: 30.5,
      date: '2026-11-01',
      note: 'Taxi',
      tags: ['work', 'trip'],
    });
    await add({
      accountId: bank.id,
      categoryId: food.id,
      amount: 40,
      date: '2026-11-05',
      paymentMethod: 'bank_transfer',
    });
    return { token, wallet, bank, food, transport };
  }
  const amountsOf = (res) => res.body.data.expenses.map((e) => e.amount);

  it('returns everything, newest date first, with the exact total of the whole set', async () => {
    const { token } = await seedExpenses();

    const res = await listExpenses(token);

    expect(res.status).toBe(200);
    expect(amountsOf(res)).toEqual(['40.00', '30.50', '20.00', '10.00']);
    expect(res.body.meta).toMatchObject({
      total: 4,
      page: 1,
      totalPages: 1,
      totalAmount: '100.50',
    });
  });

  it('filters by date range (inclusive), category, account, amount range, tag and payment method', async () => {
    const { token, wallet, bank, food } = await seedExpenses();

    const dates = await listExpenses(token, '?from=2026-10-15&to=2026-11-01');
    const category = await listExpenses(token, `?categoryId=${food.id}`);
    const account = await listExpenses(token, `?accountId=${bank.id}`);
    const range = await listExpenses(token, '?minAmount=20&maxAmount=30.5');
    const work = await listExpenses(token, '?tag=work');
    const trip = await listExpenses(token, '?tag=TRIP');
    const card = await listExpenses(token, '?paymentMethod=card');
    const walletOnly = await listExpenses(token, `?accountId=${wallet.id}`);

    expect(amountsOf(dates)).toEqual(['30.50', '20.00']);
    expect(category.body.meta.total).toBe(3);
    expect(amountsOf(account)).toEqual(['40.00']);
    expect(amountsOf(range)).toEqual(['30.50', '20.00']);
    expect(work.body.meta.total).toBe(2);
    expect(amountsOf(trip)).toEqual(['30.50']);
    expect(amountsOf(card)).toEqual(['20.00']);
    expect(walletOnly.body.meta.totalAmount).toBe('60.50');
  });

  it('searches note and category name, ignoring case, and treats % as a normal character', async () => {
    const { token } = await seedExpenses();

    const note = await listExpenses(token, '?search=LUNCH');
    const categoryName = await listExpenses(token, '?search=food');
    const percent = await listExpenses(token, '?search=%25');
    const none = await listExpenses(token, '?search=nothing-like-this');

    expect(amountsOf(note)).toEqual(['10.00']);
    expect(categoryName.body.meta.total).toBe(3);
    expect(amountsOf(percent)).toEqual(['20.00']);
    expect(none.body.meta).toMatchObject({ total: 0, totalAmount: '0.00' });
  });

  it('sorts by amount and by date in both directions', async () => {
    const { token } = await seedExpenses();

    const amountAsc = await listExpenses(token, '?sortBy=amount&sortOrder=asc');
    const amountDesc = await listExpenses(token, '?sortBy=amount&sortOrder=desc');
    const dateAsc = await listExpenses(token, '?sortOrder=asc');

    expect(amountsOf(amountAsc)).toEqual(['10.00', '20.00', '30.50', '40.00']);
    expect(amountsOf(amountDesc)).toEqual(['40.00', '30.50', '20.00', '10.00']);
    expect(amountsOf(dateAsc)).toEqual(['10.00', '20.00', '30.50', '40.00']);
  });

  it('paginates, and the total covers the whole filtered set, not only the page', async () => {
    const { token } = await seedExpenses();

    const page2 = await listExpenses(token, '?limit=2&page=2');

    expect(amountsOf(page2)).toEqual(['20.00', '10.00']);
    expect(page2.body.meta).toMatchObject({
      total: 4,
      page: 2,
      limit: 2,
      totalPages: 2,
      hasNext: false,
      hasPrev: true,
      totalAmount: '100.50',
    });
  });

  it('rejects invalid query values', async () => {
    const { token } = await seedExpenses();

    const bad = await Promise.all([
      listExpenses(token, '?sortBy=password'),
      listExpenses(token, '?from=2026-12-01&to=2026-01-01'),
      listExpenses(token, '?minAmount=50&maxAmount=10'),
      listExpenses(token, '?limit=1000'),
      listExpenses(token, '?categoryId=not-a-uuid'),
      listExpenses(token, '?from=yesterday'),
    ]);

    bad.forEach((res) => expect(res.status).toBe(400));
  });

  it('never shows the expenses of another user', async () => {
    const { token } = await seedExpenses();
    const other = await setup({ email: 'other@example.com' });
    await addExpense(other.token, {
      accountId: other.wallet.id,
      categoryId: other.food.id,
      amount: 999,
    });

    const mine = await listExpenses(token);
    const theirs = await listExpenses(other.token);

    expect(mine.body.meta.total).toBe(4);
    expect(amountsOf(theirs)).toEqual(['999.00']);
  });
});
