'use strict';

const db = require('../../src/config/db');
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

const signUp = async (overrides) => (await registerUser(overrides)).accessToken;
const list = (token, query = '') =>
  api()
    .get(url(`/accounts${query}`))
    .set(authHeader(token));
const get = (token, id) =>
  api()
    .get(url(`/accounts/${id}`))
    .set(authHeader(token));
const create = (token, body) => api().post(url('/accounts')).set(authHeader(token)).send(body);
const update = (token, id, body) =>
  api()
    .put(url(`/accounts/${id}`))
    .set(authHeader(token))
    .send(body);
const post = (token, path) => api().post(url(path)).set(authHeader(token));
const remove = (token, id) =>
  api()
    .delete(url(`/accounts/${id}`))
    .set(authHeader(token));
const transfer = (token, body) =>
  api().post(url('/accounts/transfers')).set(authHeader(token)).send(body);
const makeAccount = async (token, body) => (await create(token, body)).body.data.account;
const balanceOf = async (token, id) => (await get(token, id)).body.data.account.balance;

describe('authentication', () => {
  it('rejects every route without a token', async () => {
    expect((await api().get(url('/accounts'))).status).toBe(401);
    expect((await api().post(url('/accounts/transfers')).send({})).status).toBe(401);
  });
});

describe('POST /accounts', () => {
  it('creates an account with defaults: cash, balance 0, profile currency, default color', async () => {
    const token = await signUp();

    const res = await create(token, { name: '  Wallet ' });

    expect(res.status).toBe(201);
    expect(res.body.data.account).toMatchObject({
      name: 'Wallet',
      type: 'cash',
      balance: '0.00',
      currency: 'USD',
      color: '#3B82F6',
      isArchived: false,
    });
  });

  it('accepts an opening balance (also negative), a currency and a color', async () => {
    const token = await signUp();

    const bank = await create(token, {
      name: 'Bank',
      type: 'bank',
      balance: 100.5,
      currency: 'eur',
      color: '#aabbcc',
    });
    const card = await create(token, { name: 'Card', type: 'card', balance: '-250.75' });

    expect(bank.body.data.account).toMatchObject({
      balance: '100.50',
      currency: 'EUR',
      color: '#AABBCC',
    });
    expect(card.body.data.account.balance).toBe('-250.75');
  });

  it('rejects invalid input and unknown fields', async () => {
    const token = await signUp();

    const results = await Promise.all([
      create(token, { name: 'A', balance: '10.123' }),
      create(token, { name: 'A', balance: 'abc' }),
      create(token, { name: 'A', type: 'piggy' }),
      create(token, { name: 'A', currency: 'US' }),
      create(token, { name: 'A', isArchived: true }),
      create(token, { name: '  ' }),
    ]);

    results.forEach((res) => expect(res.status).toBe(400));
  });

  it('rejects a name the user has, ignoring case, but allows it for another user', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    await create(token, { name: 'Wallet' });

    const duplicate = await create(token, { name: 'WALLET' });
    const otherUser = await create(other, { name: 'Wallet' });

    expect(duplicate.status).toBe(409);
    expect(otherUser.status).toBe(201);
  });
});

describe('GET /accounts', () => {
  it('lists only the own accounts and hides archived ones by default', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    await create(token, { name: 'Wallet' });
    const old = await makeAccount(token, { name: 'Old' });
    await create(other, { name: 'Secret' });
    await post(token, `/accounts/${old.id}/archive`);

    const normal = await list(token);
    const all = await list(token, '?includeArchived=true');

    expect(normal.body.data.accounts.map((a) => a.name)).toEqual(['Wallet']);
    expect(all.body.data.accounts.map((a) => a.name)).toEqual(['Wallet', 'Old']);
  });

  it('adds exact totals per currency', async () => {
    const token = await signUp();
    await create(token, { name: 'A', balance: '100.10' });
    await create(token, { name: 'B', balance: '50.20' });
    await create(token, { name: 'C', balance: '10', currency: 'EUR' });

    const res = await list(token);

    expect(res.body.meta.total).toBe(3);
    expect(res.body.meta.totalsByCurrency).toEqual({ EUR: '10.00', USD: '150.30' });
  });
});

describe('GET /accounts/:id', () => {
  it('answers 404 for another user or an unknown id, and 400 for a malformed id', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    const theirs = await makeAccount(other, { name: 'Secret' });

    expect((await get(token, theirs.id)).status).toBe(404);
    expect((await get(token, UNKNOWN_ID)).status).toBe(404);
    expect((await get(token, 'not-a-uuid')).status).toBe(400);
  });
});

describe('PUT /accounts/:id', () => {
  it('changes name, type and color but never balance or currency', async () => {
    const token = await signUp();
    const account = await makeAccount(token, { name: 'Wallet', balance: '10' });

    const ok = await update(token, account.id, { name: 'Purse', type: 'bank', color: '#112233' });
    const balance = await update(token, account.id, { balance: '999' });
    const currency = await update(token, account.id, { currency: 'EUR' });
    const empty = await update(token, account.id, {});

    expect(ok.status).toBe(200);
    expect(ok.body.data.account).toMatchObject({
      name: 'Purse',
      type: 'bank',
      color: '#112233',
      balance: '10.00',
      currency: 'USD',
    });
    expect(balance.status).toBe(400);
    expect(currency.status).toBe(400);
    expect(empty.status).toBe(400);
  });

  it('rejects a rename to a taken name, allows a change of letter case only', async () => {
    const token = await signUp();
    const wallet = await makeAccount(token, { name: 'Wallet' });
    await create(token, { name: 'Bank' });

    const taken = await update(token, wallet.id, { name: 'bank' });
    const sameName = await update(token, wallet.id, { name: 'WALLET' });

    expect(taken.status).toBe(409);
    expect(sameName.status).toBe(200);
  });

  it('answers 404 for an account of another user', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    const theirs = await makeAccount(other, { name: 'Secret' });

    const res = await update(token, theirs.id, { name: 'Mine now' });

    expect(res.status).toBe(404);
    expect((await get(other, theirs.id)).body.data.account.name).toBe('Secret');
  });
});

describe('archive and unarchive', () => {
  it('archives and restores an account, and both are repeatable', async () => {
    const token = await signUp();
    const account = await makeAccount(token, { name: 'Wallet' });

    const archived = await post(token, `/accounts/${account.id}/archive`);
    const again = await post(token, `/accounts/${account.id}/archive`);
    const restored = await post(token, `/accounts/${account.id}/unarchive`);

    expect(archived.body.data.account.isArchived).toBe(true);
    expect(again.status).toBe(200);
    expect(restored.body.data.account.isArchived).toBe(false);
  });

  it('answers 404 for another user', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    const theirs = await makeAccount(other, { name: 'Secret' });

    expect((await post(token, `/accounts/${theirs.id}/archive`)).status).toBe(404);
  });
});

describe('DELETE /accounts/:id', () => {
  it('deletes an unused account', async () => {
    const token = await signUp();
    const account = await makeAccount(token, { name: 'Wallet' });

    const res = await remove(token, account.id);

    expect(res.status).toBe(200);
    expect((await get(token, account.id)).status).toBe(404);
  });

  it('refuses to delete an account that an expense uses', async () => {
    const { accessToken, user } = await registerUser();
    const account = await makeAccount(accessToken, { name: 'Wallet' });
    const { rows } = await db.query('SELECT id FROM categories LIMIT 1');
    await db.query(
      'INSERT INTO expenses (user_id, account_id, category_id, amount) VALUES ($1, $2, $3, 5)',
      [user.id, account.id, rows[0].id],
    );

    const res = await remove(accessToken, account.id);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Archive it instead/);
    expect((await get(accessToken, account.id)).status).toBe(200);
  });

  it('refuses to delete an account that has a transfer, and 404 for another user', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    const a = await makeAccount(token, { name: 'A', balance: '10' });
    const b = await makeAccount(token, { name: 'B' });
    const theirs = await makeAccount(other, { name: 'Secret' });
    await transfer(token, { fromAccountId: a.id, toAccountId: b.id, amount: 5 });

    expect((await remove(token, b.id)).status).toBe(409);
    expect((await remove(token, theirs.id)).status).toBe(404);
  });
});

describe('POST /accounts/transfers', () => {
  it('moves the money, records the transfer and returns both new balances', async () => {
    const token = await signUp();
    const a = await makeAccount(token, { name: 'A', balance: '100' });
    const b = await makeAccount(token, { name: 'B' });

    const res = await transfer(token, {
      fromAccountId: a.id,
      toAccountId: b.id,
      amount: '30',
      date: '2026-11-01',
      note: 'Savings',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.transfer).toMatchObject({
      fromAccountId: a.id,
      toAccountId: b.id,
      amount: '30.00',
      date: '2026-11-01',
      note: 'Savings',
    });
    expect(res.body.data.accounts.from.balance).toBe('70.00');
    expect(res.body.data.accounts.to.balance).toBe('30.00');
    expect(await balanceOf(token, a.id)).toBe('70.00');
    expect(await balanceOf(token, b.id)).toBe('30.00');
  });

  it('defaults the date to today and stays exact with decimals (0.1 + 0.2)', async () => {
    const token = await signUp();
    const a = await makeAccount(token, { name: 'A', balance: '1' });
    const b = await makeAccount(token, { name: 'B' });

    const first = await transfer(token, { fromAccountId: a.id, toAccountId: b.id, amount: 0.1 });
    await transfer(token, { fromAccountId: a.id, toAccountId: b.id, amount: 0.2 });

    expect(first.body.data.transfer.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await balanceOf(token, a.id)).toBe('0.70');
    expect(await balanceOf(token, b.id)).toBe('0.30');
  });

  it('rejects bad input and changes nothing', async () => {
    const token = await signUp();
    const a = await makeAccount(token, { name: 'A', balance: '100' });
    const b = await makeAccount(token, { name: 'B' });
    const base = { fromAccountId: a.id, toAccountId: b.id, amount: 10 };

    const results = await Promise.all([
      transfer(token, { ...base, toAccountId: a.id }),
      transfer(token, { ...base, amount: 0 }),
      transfer(token, { ...base, amount: -5 }),
      transfer(token, { ...base, amount: '1.234' }),
      transfer(token, { ...base, date: '2026-02-31' }),
      transfer(token, { ...base, extra: true }),
    ]);

    results.forEach((res) => expect(res.status).toBe(400));
    expect(await balanceOf(token, a.id)).toBe('100.00');
    expect(await balanceOf(token, b.id)).toBe('0.00');
  });

  it('answers 404 when an account belongs to another user, and changes nothing', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    const mine = await makeAccount(token, { name: 'Mine', balance: '100' });
    const theirs = await makeAccount(other, { name: 'Theirs', balance: '100' });

    const out = await transfer(token, {
      fromAccountId: mine.id,
      toAccountId: theirs.id,
      amount: 10,
    });
    const steal = await transfer(token, {
      fromAccountId: theirs.id,
      toAccountId: mine.id,
      amount: 10,
    });

    expect(out.status).toBe(404);
    expect(steal.status).toBe(404);
    expect(await balanceOf(token, mine.id)).toBe('100.00');
    expect(await balanceOf(other, theirs.id)).toBe('100.00');
  });

  it('rejects archived accounts and different currencies', async () => {
    const token = await signUp();
    const a = await makeAccount(token, { name: 'A', balance: '100' });
    const b = await makeAccount(token, { name: 'B' });
    const euro = await makeAccount(token, { name: 'Euro', currency: 'EUR' });
    await post(token, `/accounts/${b.id}/archive`);

    const archived = await transfer(token, { fromAccountId: a.id, toAccountId: b.id, amount: 10 });
    const currency = await transfer(token, {
      fromAccountId: a.id,
      toAccountId: euro.id,
      amount: 10,
    });

    expect(archived.status).toBe(400);
    expect(currency.status).toBe(400);
    expect(currency.body.message).toMatch(/same currency/);
    expect(await balanceOf(token, a.id)).toBe('100.00');
  });

  it('loses no update when many transfers run at the same time', async () => {
    const token = await signUp();
    const a = await makeAccount(token, { name: 'A', balance: '100' });
    const b = await makeAccount(token, { name: 'B' });

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        transfer(token, { fromAccountId: a.id, toAccountId: b.id, amount: 1 }),
      ),
    );

    results.forEach((res) => expect(res.status).toBe(201));
    expect(await balanceOf(token, a.id)).toBe('92.00');
    expect(await balanceOf(token, b.id)).toBe('8.00');
  });

  it('does not deadlock when transfers run in opposite directions at the same time', async () => {
    const token = await signUp();
    const a = await makeAccount(token, { name: 'A', balance: '100' });
    const b = await makeAccount(token, { name: 'B', balance: '100' });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        i % 2 === 0
          ? transfer(token, { fromAccountId: a.id, toAccountId: b.id, amount: 10 })
          : transfer(token, { fromAccountId: b.id, toAccountId: a.id, amount: 10 }),
      ),
    );

    results.forEach((res) => expect(res.status).toBe(201));
    expect(await balanceOf(token, a.id)).toBe('100.00');
    expect(await balanceOf(token, b.id)).toBe('100.00');
  });
});

describe('GET /accounts/transfers', () => {
  it('lists the own transfers, newest first, with pagination meta', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    const a = await makeAccount(token, { name: 'A', balance: '100' });
    const b = await makeAccount(token, { name: 'B' });
    const x = await makeAccount(other, { name: 'X', balance: '100' });
    const y = await makeAccount(other, { name: 'Y' });
    await transfer(token, {
      fromAccountId: a.id,
      toAccountId: b.id,
      amount: 1,
      date: '2026-10-01',
    });
    await transfer(token, {
      fromAccountId: a.id,
      toAccountId: b.id,
      amount: 2,
      date: '2026-11-01',
    });
    await transfer(other, { fromAccountId: x.id, toAccountId: y.id, amount: 3 });

    const res = await api().get(url('/accounts/transfers?limit=1')).set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.transfers).toHaveLength(1);
    expect(res.body.data.transfers[0]).toMatchObject({ amount: '2.00', date: '2026-11-01' });
    expect(res.body.meta).toMatchObject({
      total: 2,
      page: 1,
      limit: 1,
      totalPages: 2,
      hasNext: true,
    });
  });
});
