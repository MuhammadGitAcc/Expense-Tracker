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
const addIncome = (token, body) => as(token, 'post', '/incomes', body);
const getIncome = (token, id) => as(token, 'get', `/incomes/${id}`);
const putIncome = (token, id, body) => as(token, 'put', `/incomes/${id}`, body);
const delIncome = (token, id) => as(token, 'delete', `/incomes/${id}`);
const listIncomes = (token, query = '') => as(token, 'get', `/incomes${query}`);
const makeAccount = async (token, body) =>
  (await as(token, 'post', '/accounts', body)).body.data.account;
const balanceOf = async (token, id) =>
  (await as(token, 'get', `/accounts/${id}`)).body.data.account.balance;
const categoryNamed = async (token, name, type = 'income') =>
  (await as(token, 'get', '/categories')).body.data.categories.find(
    (c) => c.name === name && c.type === type,
  );
const makeCategory = async (token, name, type = 'income') =>
  (await as(token, 'post', '/categories', { name, type })).body.data.category;

/** A signed-up user with a Wallet of 1000.00 and the default Salary (income) category. */
async function setup(overrides) {
  const { accessToken: token, user } = await registerUser(overrides);
  const wallet = await makeAccount(token, { name: 'Wallet', balance: '1000' });
  const salary = await categoryNamed(token, 'Salary');
  return { token, user, wallet, salary };
}

describe('authentication', () => {
  it('rejects every route without a token', async () => {
    expect((await api().get(url('/incomes'))).status).toBe(401);
    expect((await api().post(url('/incomes')).send({})).status).toBe(401);
  });
});

describe('POST /incomes', () => {
  it('records the income with account and category details and raises the balance', async () => {
    const { token, wallet, salary } = await setup();

    const res = await addIncome(token, {
      accountId: wallet.id,
      categoryId: salary.id,
      amount: 12.5,
      date: '2026-11-01',
      source: '  Employer ',
      note: ' October pay ',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.income).toMatchObject({
      amount: '12.50',
      date: '2026-11-01',
      source: 'Employer',
      note: 'October pay',
      recurringId: null,
      account: { id: wallet.id, name: 'Wallet', currency: 'USD' },
      category: { id: salary.id, name: 'Salary' },
    });
    expect(res.body.data.accounts[0]).toMatchObject({ id: wallet.id, balance: '1012.50' });
    expect(await balanceOf(token, wallet.id)).toBe('1012.50');
  });

  it('defaults the date to today and stays exact with decimals (0.1 + 0.2)', async () => {
    const { token, wallet, salary } = await setup();

    const first = await addIncome(token, {
      accountId: wallet.id,
      categoryId: salary.id,
      amount: 0.1,
    });
    await addIncome(token, { accountId: wallet.id, categoryId: salary.id, amount: 0.2 });

    expect(first.body.data.income.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.body.data.income.source).toBeNull();
    expect(await balanceOf(token, wallet.id)).toBe('1000.30');
  });

  it('accepts a custom income category of the user', async () => {
    const { token, wallet } = await setup();
    const freelance = await makeCategory(token, 'Freelance');

    const res = await addIncome(token, {
      accountId: wallet.id,
      categoryId: freelance.id,
      amount: 5,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.income.category.name).toBe('Freelance');
  });

  it('rejects bad references and bad input, and changes nothing', async () => {
    const { token, wallet, salary } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const archived = await makeAccount(token, { name: 'Old', balance: '50' });
    await as(token, 'post', `/accounts/${archived.id}/archive`);
    const food = await categoryNamed(token, 'Food', 'expense');
    const theirCategory = await makeCategory(other.token, 'Secret');
    const base = { accountId: wallet.id, categoryId: salary.id, amount: 10 };

    const cases = await Promise.all([
      addIncome(token, { ...base, categoryId: food.id }), // expense category: 400
      addIncome(token, { ...base, categoryId: UNKNOWN_ID }), // 404
      addIncome(token, { ...base, categoryId: theirCategory.id }), // other user's category: 404
      addIncome(token, { ...base, accountId: other.wallet.id }), // other user's account: 404
      addIncome(token, { ...base, accountId: archived.id }), // archived: 400
      addIncome(token, { ...base, amount: 0 }),
      addIncome(token, { ...base, amount: -5 }),
      addIncome(token, { ...base, amount: '1.234' }),
      addIncome(token, { ...base, date: '2026-02-31' }),
      addIncome(token, { ...base, source: 'x'.repeat(151) }),
      addIncome(token, { ...base, recurringId: UNKNOWN_ID }), // unknown field
    ]);

    expect(cases.map((res) => res.status)).toEqual([
      400, 404, 404, 404, 400, 400, 400, 400, 400, 400, 400,
    ]);
    expect(await balanceOf(token, wallet.id)).toBe('1000.00');
    expect(await balanceOf(other.token, other.wallet.id)).toBe('1000.00');
    expect((await listIncomes(token)).body.meta.total).toBe(0);
  });

  it('loses no update when many incomes are added at the same time', async () => {
    const { token, wallet, salary } = await setup();

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        addIncome(token, { accountId: wallet.id, categoryId: salary.id, amount: 1 }),
      ),
    );

    results.forEach((res) => expect(res.status).toBe(201));
    expect(await balanceOf(token, wallet.id)).toBe('1008.00');
  });
});

describe('GET /incomes/:id', () => {
  it('returns an own income, 404 for another user, 400 for a malformed id', async () => {
    const { token, wallet, salary } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const mine = (
      await addIncome(token, { accountId: wallet.id, categoryId: salary.id, amount: 5 })
    ).body.data.income;

    expect((await getIncome(token, mine.id)).status).toBe(200);
    expect((await getIncome(other.token, mine.id)).status).toBe(404);
    expect((await getIncome(token, UNKNOWN_ID)).status).toBe(404);
    expect((await getIncome(token, 'not-a-uuid')).status).toBe(400);
  });
});

describe('PUT /incomes/:id', () => {
  it('keeps the balance right when the amount changes', async () => {
    const { token, wallet, salary } = await setup();
    const { income } = (
      await addIncome(token, { accountId: wallet.id, categoryId: salary.id, amount: 30 })
    ).body.data;

    const raise = await putIncome(token, income.id, { amount: 50 });
    expect(await balanceOf(token, wallet.id)).toBe('1050.00');
    await putIncome(token, income.id, { amount: 10.25 });

    expect(raise.status).toBe(200);
    expect(raise.body.data.income.amount).toBe('50.00');
    expect(raise.body.data.accounts[0].balance).toBe('1050.00');
    expect(await balanceOf(token, wallet.id)).toBe('1010.25');
  });

  it('moves the money when the account changes', async () => {
    const { token, wallet, salary } = await setup();
    const bank = await makeAccount(token, { name: 'Bank', balance: '500' });
    const { income } = (
      await addIncome(token, { accountId: wallet.id, categoryId: salary.id, amount: 30 })
    ).body.data;

    const res = await putIncome(token, income.id, { accountId: bank.id });

    expect(res.status).toBe(200);
    expect(res.body.data.income.account.id).toBe(bank.id);
    expect(res.body.data.accounts).toHaveLength(2);
    expect(await balanceOf(token, wallet.id)).toBe('1000.00');
    expect(await balanceOf(token, bank.id)).toBe('530.00');
  });

  it('changes source, note, category and date without touching balances', async () => {
    const { token, wallet, salary } = await setup();
    const freelance = await makeCategory(token, 'Freelance');
    const { income } = (
      await addIncome(token, {
        accountId: wallet.id,
        categoryId: salary.id,
        amount: 30,
        source: 'Old source',
        note: 'Old note',
      })
    ).body.data;

    const res = await putIncome(token, income.id, {
      categoryId: freelance.id,
      source: null,
      note: '',
      date: '2026-10-10',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.income).toMatchObject({
      source: null,
      note: null,
      date: '2026-10-10',
      category: { name: 'Freelance' },
    });
    expect(res.body.data.accounts).toEqual([]);
    expect(await balanceOf(token, wallet.id)).toBe('1030.00');
  });

  it('rejects bad updates and changes nothing', async () => {
    const { token, wallet, salary } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const archived = await makeAccount(token, { name: 'Old' });
    await as(token, 'post', `/accounts/${archived.id}/archive`);
    const food = await categoryNamed(token, 'Food', 'expense');
    const { income } = (
      await addIncome(token, { accountId: wallet.id, categoryId: salary.id, amount: 30 })
    ).body.data;

    const cases = await Promise.all([
      putIncome(token, income.id, { categoryId: food.id }), // 400
      putIncome(token, income.id, { accountId: archived.id }), // 400
      putIncome(token, income.id, { accountId: other.wallet.id }), // 404
      putIncome(token, income.id, { amount: 0 }), // 400
      putIncome(token, income.id, {}), // 400
      putIncome(token, income.id, { userId: other.user.id }), // 400
      putIncome(other.token, income.id, { amount: 1 }), // 404: not theirs
    ]);

    expect(cases.map((res) => res.status)).toEqual([400, 400, 404, 400, 400, 400, 404]);
    expect(await balanceOf(token, wallet.id)).toBe('1030.00');
    expect((await getIncome(token, income.id)).body.data.income.amount).toBe('30.00');
  });

  it('keeps balance and amount consistent when the same income is edited at the same time', async () => {
    const { token, wallet, salary } = await setup();
    const { income } = (
      await addIncome(token, { accountId: wallet.id, categoryId: salary.id, amount: 10 })
    ).body.data;

    const results = await Promise.all(
      [11, 12, 13, 14, 15].map((amount) => putIncome(token, income.id, { amount })),
    );

    results.forEach((res) => expect(res.status).toBe(200));
    const finalAmount = Number((await getIncome(token, income.id)).body.data.income.amount);
    expect(Number(await balanceOf(token, wallet.id))).toBe(1000 + finalAmount);
  });
});

describe('DELETE /incomes/:id', () => {
  it('takes the amount back from the account', async () => {
    const { token, wallet, salary } = await setup();
    const { income } = (
      await addIncome(token, { accountId: wallet.id, categoryId: salary.id, amount: 30 })
    ).body.data;

    const res = await delIncome(token, income.id);

    expect(res.status).toBe(200);
    expect(res.body.data.accounts[0].balance).toBe('1000.00');
    expect(await balanceOf(token, wallet.id)).toBe('1000.00');
    expect((await getIncome(token, income.id)).status).toBe(404);
  });

  it('answers 404 for another user and leaves their income and balance alone', async () => {
    const { token, wallet, salary } = await setup();
    const other = await setup({ email: 'other@example.com' });
    const { income } = (
      await addIncome(token, { accountId: wallet.id, categoryId: salary.id, amount: 30 })
    ).body.data;

    const res = await delIncome(other.token, income.id);

    expect(res.status).toBe(404);
    expect((await getIncome(token, income.id)).status).toBe(200);
    expect(await balanceOf(token, wallet.id)).toBe('1030.00');
  });
});

describe('accounts and categories that have incomes', () => {
  it('cannot be deleted while an income uses them', async () => {
    const { token, wallet } = await setup();
    const freelance = await makeCategory(token, 'Freelance');
    await addIncome(token, { accountId: wallet.id, categoryId: freelance.id, amount: 30 });

    const deleteAccount = await as(token, 'delete', `/accounts/${wallet.id}`);
    const deleteCategory = await as(token, 'delete', `/categories/${freelance.id}`);

    expect(deleteAccount.status).toBe(409);
    expect(deleteCategory.status).toBe(409);
  });
});

describe('GET /incomes (filters, search, sorting, pagination)', () => {
  // Four incomes, total 100.50: dates, amounts, categories, accounts, sources and notes differ.
  async function seedIncomes() {
    const { token, wallet, salary } = await setup();
    const bank = await makeAccount(token, { name: 'Bank', balance: '500' });
    const freelance = await makeCategory(token, 'Freelance');
    const add = (body) => addIncome(token, body);

    await add({
      accountId: wallet.id,
      categoryId: salary.id,
      amount: 10,
      date: '2026-10-01',
      source: 'Employer',
      note: 'October pay',
    });
    await add({
      accountId: wallet.id,
      categoryId: salary.id,
      amount: 20,
      date: '2026-10-15',
      source: '50% bonus',
    });
    await add({
      accountId: wallet.id,
      categoryId: freelance.id,
      amount: 30.5,
      date: '2026-11-01',
      source: 'Client A',
      note: 'Logo',
    });
    await add({
      accountId: bank.id,
      categoryId: salary.id,
      amount: 40,
      date: '2026-11-05',
      source: 'Employer',
    });
    return { token, wallet, bank, salary, freelance };
  }
  const amountsOf = (res) => res.body.data.incomes.map((i) => i.amount);

  it('returns everything, newest date first, with the exact total of the whole set', async () => {
    const { token } = await seedIncomes();

    const res = await listIncomes(token);

    expect(res.status).toBe(200);
    expect(amountsOf(res)).toEqual(['40.00', '30.50', '20.00', '10.00']);
    expect(res.body.meta).toMatchObject({
      total: 4,
      page: 1,
      totalPages: 1,
      totalAmount: '100.50',
    });
  });

  it('filters by date range (inclusive), category, account and amount range', async () => {
    const { token, wallet, bank, salary } = await seedIncomes();

    const dates = await listIncomes(token, '?from=2026-10-15&to=2026-11-01');
    const category = await listIncomes(token, `?categoryId=${salary.id}`);
    const account = await listIncomes(token, `?accountId=${bank.id}`);
    const range = await listIncomes(token, '?minAmount=20&maxAmount=30.5');
    const walletOnly = await listIncomes(token, `?accountId=${wallet.id}`);

    expect(amountsOf(dates)).toEqual(['30.50', '20.00']);
    expect(category.body.meta.total).toBe(3);
    expect(amountsOf(account)).toEqual(['40.00']);
    expect(amountsOf(range)).toEqual(['30.50', '20.00']);
    expect(walletOnly.body.meta.totalAmount).toBe('60.50');
  });

  it('searches source, note and category name, ignoring case, and treats % as a normal character', async () => {
    const { token } = await seedIncomes();

    const source = await listIncomes(token, '?search=EMPLOYER');
    const note = await listIncomes(token, '?search=logo');
    const categoryName = await listIncomes(token, '?search=salary');
    const percent = await listIncomes(token, '?search=%25');
    const none = await listIncomes(token, '?search=nothing-like-this');

    expect(amountsOf(source)).toEqual(['40.00', '10.00']);
    expect(amountsOf(note)).toEqual(['30.50']);
    expect(categoryName.body.meta.total).toBe(3);
    expect(amountsOf(percent)).toEqual(['20.00']);
    expect(none.body.meta).toMatchObject({ total: 0, totalAmount: '0.00' });
  });

  it('sorts by amount and by date in both directions', async () => {
    const { token } = await seedIncomes();

    const amountAsc = await listIncomes(token, '?sortBy=amount&sortOrder=asc');
    const amountDesc = await listIncomes(token, '?sortBy=amount&sortOrder=desc');
    const dateAsc = await listIncomes(token, '?sortOrder=asc');

    expect(amountsOf(amountAsc)).toEqual(['10.00', '20.00', '30.50', '40.00']);
    expect(amountsOf(amountDesc)).toEqual(['40.00', '30.50', '20.00', '10.00']);
    expect(amountsOf(dateAsc)).toEqual(['10.00', '20.00', '30.50', '40.00']);
  });

  it('paginates, and the total covers the whole filtered set, not only the page', async () => {
    const { token } = await seedIncomes();

    const page2 = await listIncomes(token, '?limit=2&page=2');

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
    const { token } = await seedIncomes();

    const bad = await Promise.all([
      listIncomes(token, '?sortBy=password'),
      listIncomes(token, '?from=2026-12-01&to=2026-01-01'),
      listIncomes(token, '?minAmount=50&maxAmount=10'),
      listIncomes(token, '?limit=1000'),
      listIncomes(token, '?categoryId=not-a-uuid'),
      listIncomes(token, '?from=yesterday'),
    ]);

    bad.forEach((res) => expect(res.status).toBe(400));
  });

  it('never shows the incomes of another user', async () => {
    const { token } = await seedIncomes();
    const other = await setup({ email: 'other@example.com' });
    await addIncome(other.token, {
      accountId: other.wallet.id,
      categoryId: other.salary.id,
      amount: 999,
    });

    const mine = await listIncomes(token);
    const theirs = await listIncomes(token === other.token ? '' : other.token);

    expect(mine.body.meta.total).toBe(4);
    expect(amountsOf(theirs)).toEqual(['999.00']);
  });
});
