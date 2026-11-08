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

// A valid UUID that no row has.
const UNKNOWN_ID = '3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c';

beforeEach(async () => {
  await resetDatabase();
  await seedDefaultCategories();
});
afterAll(closeDatabase);

const signUp = async (overrides) => (await registerUser(overrides)).accessToken;
const list = (token, query = '') =>
  api()
    .get(url(`/categories${query}`))
    .set(authHeader(token));
const create = (token, body) => api().post(url('/categories')).set(authHeader(token)).send(body);
const update = (token, id, body) =>
  api()
    .put(url(`/categories/${id}`))
    .set(authHeader(token))
    .send(body);
const remove = (token, id) =>
  api()
    .delete(url(`/categories/${id}`))
    .set(authHeader(token));
const findByName = async (token, name) =>
  (await list(token)).body.data.categories.find((c) => c.name === name);

describe('authentication', () => {
  it('rejects every route without a token', async () => {
    expect((await api().get(url('/categories'))).status).toBe(401);
    expect((await api().post(url('/categories')).send({})).status).toBe(401);
  });
});

describe('GET /categories', () => {
  it('returns the defaults and the own categories, never those of another user', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    await create(token, { name: 'Coffee', type: 'expense' });
    await create(other, { name: 'Secret', type: 'expense' });

    const res = await list(token);
    const names = res.body.data.categories.map((c) => c.name);

    expect(res.status).toBe(200);
    expect(names).toEqual(expect.arrayContaining(['Food', 'Salary', 'Coffee']));
    expect(names).not.toContain('Secret');
    expect(res.body.meta.total).toBe(3);
    expect(res.body.data.categories[0]).not.toHaveProperty('userId');
  });

  it('filters by type', async () => {
    const token = await signUp();

    const res = await list(token, '?type=income');

    expect(res.body.data.categories.map((c) => c.name)).toEqual(['Salary']);
  });

  it('rejects an unknown type', async () => {
    const token = await signUp();

    expect((await list(token, '?type=other')).status).toBe(400);
  });
});

describe('POST /categories', () => {
  it('creates a custom category with default icon and color, color upper-cased', async () => {
    const token = await signUp();

    const plain = await create(token, { name: '  Coffee ', type: 'expense' });
    const styled = await create(token, {
      name: 'Pets',
      type: 'expense',
      icon: 'Paw-Print',
      color: '#aabbcc',
    });

    expect(plain.status).toBe(201);
    expect(plain.body.data.category).toMatchObject({
      name: 'Coffee',
      type: 'expense',
      icon: 'tag',
      color: '#6B7280',
      isDefault: false,
    });
    expect(styled.body.data.category).toMatchObject({ icon: 'paw-print', color: '#AABBCC' });
  });

  it('rejects a name that is taken: own, default, whatever the letter case', async () => {
    const token = await signUp();
    await create(token, { name: 'Coffee', type: 'expense' });

    const own = await create(token, { name: 'COFFEE', type: 'expense' });
    const defaultName = await create(token, { name: 'food', type: 'expense' });

    expect(own.status).toBe(409);
    expect(defaultName.status).toBe(409);
  });

  it('allows the same name for the other type and for another user', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    await create(token, { name: 'Coffee', type: 'expense' });

    const otherType = await create(token, { name: 'Coffee', type: 'income' });
    const otherUser = await create(other, { name: 'Coffee', type: 'expense' });

    expect(otherType.status).toBe(201);
    expect(otherUser.status).toBe(201);
  });

  it('rejects invalid input and unknown fields', async () => {
    const token = await signUp();

    const badColor = await create(token, { name: 'A', type: 'expense', color: 'red' });
    const noType = await create(token, { name: 'A' });
    const sneaky = await create(token, { name: 'A', type: 'expense', isDefault: true });
    const noName = await create(token, { name: '   ', type: 'expense' });

    expect(badColor.status).toBe(400);
    expect(noType.status).toBe(400);
    expect(sneaky.status).toBe(400);
    expect(noName.status).toBe(400);
  });
});

describe('GET /categories/:id', () => {
  it('returns a default and an own category', async () => {
    const token = await signUp();
    const food = await findByName(token, 'Food');
    const mine = (await create(token, { name: 'Coffee', type: 'expense' })).body.data.category;

    const a = await api()
      .get(url(`/categories/${food.id}`))
      .set(authHeader(token));
    const b = await api()
      .get(url(`/categories/${mine.id}`))
      .set(authHeader(token));

    expect(a.status).toBe(200);
    expect(a.body.data.category.isDefault).toBe(true);
    expect(b.status).toBe(200);
  });

  it('answers 404 for another user, 404 for an unknown id and 400 for a malformed id', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    const theirs = (await create(other, { name: 'Secret', type: 'expense' })).body.data.category;

    const foreign = await api()
      .get(url(`/categories/${theirs.id}`))
      .set(authHeader(token));
    const unknown = await api()
      .get(url(`/categories/${UNKNOWN_ID}`))
      .set(authHeader(token));
    const malformed = await api().get(url('/categories/not-a-uuid')).set(authHeader(token));

    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(400);
  });
});

describe('PUT /categories/:id', () => {
  it('changes name, icon and color', async () => {
    const token = await signUp();
    const mine = (await create(token, { name: 'Coffee', type: 'expense' })).body.data.category;

    const res = await update(token, mine.id, { name: 'Tea', icon: 'cup', color: '#112233' });

    expect(res.status).toBe(200);
    expect(res.body.data.category).toMatchObject({
      id: mine.id,
      name: 'Tea',
      icon: 'cup',
      color: '#112233',
      type: 'expense',
    });
  });

  it('lets a category change only the letter case of its own name', async () => {
    const token = await signUp();
    const mine = (await create(token, { name: 'Coffee', type: 'expense' })).body.data.category;

    const res = await update(token, mine.id, { name: 'COFFEE' });

    expect(res.status).toBe(200);
    expect(res.body.data.category.name).toBe('COFFEE');
  });

  it('rejects a rename to a name that is taken', async () => {
    const token = await signUp();
    const mine = (await create(token, { name: 'Coffee', type: 'expense' })).body.data.category;

    const res = await update(token, mine.id, { name: 'Food' });

    expect(res.status).toBe(409);
  });

  it('never changes the type, and rejects an empty update', async () => {
    const token = await signUp();
    const mine = (await create(token, { name: 'Coffee', type: 'expense' })).body.data.category;

    const type = await update(token, mine.id, { type: 'income' });
    const empty = await update(token, mine.id, {});

    expect(type.status).toBe(400);
    expect(empty.status).toBe(400);
  });

  it('answers 403 for a default category and 404 for another user', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    const food = await findByName(token, 'Food');
    const theirs = (await create(other, { name: 'Secret', type: 'expense' })).body.data.category;

    const asDefault = await update(token, food.id, { name: 'Meals' });
    const foreign = await update(token, theirs.id, { name: 'Mine now' });

    expect(asDefault.status).toBe(403);
    expect(foreign.status).toBe(404);
    expect((await findByName(other, 'Secret')).name).toBe('Secret');
  });
});

describe('DELETE /categories/:id', () => {
  it('deletes an unused own category', async () => {
    const token = await signUp();
    const mine = (await create(token, { name: 'Coffee', type: 'expense' })).body.data.category;

    const res = await remove(token, mine.id);

    expect(res.status).toBe(200);
    expect(await findByName(token, 'Coffee')).toBeUndefined();
  });

  it('refuses to delete a category that an expense uses', async () => {
    const { accessToken, user } = await registerUser();
    const mine = (await create(accessToken, { name: 'Coffee', type: 'expense' })).body.data
      .category;
    const account = await db.query(
      "INSERT INTO accounts (user_id, name) VALUES ($1, 'Wallet') RETURNING id",
      [user.id],
    );
    await db.query(
      'INSERT INTO expenses (user_id, account_id, category_id, amount) VALUES ($1, $2, $3, 10)',
      [user.id, account.rows[0].id, mine.id],
    );

    const res = await remove(accessToken, mine.id);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/1 transaction/);
    expect(await findByName(accessToken, 'Coffee')).toBeDefined();
  });

  it('answers 403 for a default category and 404 for another user', async () => {
    const token = await signUp();
    const other = await signUp({ email: 'other@example.com' });
    const food = await findByName(token, 'Food');
    const theirs = (await create(other, { name: 'Secret', type: 'expense' })).body.data.category;

    const asDefault = await remove(token, food.id);
    const foreign = await remove(token, theirs.id);

    expect(asDefault.status).toBe(403);
    expect(foreign.status).toBe(404);
    expect(await findByName(other, 'Secret')).toBeDefined();
  });
});
