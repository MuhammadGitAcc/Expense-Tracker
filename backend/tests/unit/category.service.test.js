'use strict';

jest.mock('../../src/config/db', () => ({}));
jest.mock('../../src/repositories/category.repository');

const categoryRepository = require('../../src/repositories/category.repository');
const categoryService = require('../../src/services/category.service');

const USER_ID = 'user-1';
const DEFAULT_CATEGORY = {
  id: 'cat-default',
  name: 'Food',
  type: 'expense',
  icon: 'utensils',
  color: '#F97316',
  isDefault: true,
};
const CUSTOM = {
  id: 'cat-1',
  name: 'Coffee',
  type: 'expense',
  icon: 'coffee',
  color: '#8B5E3C',
  isDefault: false,
};

beforeEach(() => jest.resetAllMocks());

describe('list', () => {
  it('passes the type filter to the repository', async () => {
    categoryRepository.listForUser.mockResolvedValue([CUSTOM]);

    const result = await categoryService.list(USER_ID, { type: 'expense' });

    expect(categoryRepository.listForUser).toHaveBeenCalledWith(USER_ID, { type: 'expense' });
    expect(result).toEqual([CUSTOM]);
  });
});

describe('getById', () => {
  it('answers 404 for a category the user cannot see', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(null);

    await expect(categoryService.getById(USER_ID, 'cat-x')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('create', () => {
  const input = { name: 'Coffee', type: 'expense', icon: 'coffee', color: '#8B5E3C' };

  it('rejects a name that already exists (a default or the user own)', async () => {
    categoryRepository.nameExists.mockResolvedValue(true);

    await expect(categoryService.create(USER_ID, input)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(categoryRepository.create).not.toHaveBeenCalled();
  });

  it('creates a custom category', async () => {
    categoryRepository.nameExists.mockResolvedValue(false);
    categoryRepository.create.mockResolvedValue(CUSTOM);

    const result = await categoryService.create(USER_ID, input);

    expect(categoryRepository.nameExists).toHaveBeenCalledWith({
      userId: USER_ID,
      type: 'expense',
      name: 'Coffee',
    });
    expect(categoryRepository.create).toHaveBeenCalledWith({ userId: USER_ID, ...input });
    expect(result).toEqual(CUSTOM);
  });

  it('turns a unique-index violation (two requests at once) into a 409', async () => {
    categoryRepository.nameExists.mockResolvedValue(false);
    categoryRepository.create.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));

    await expect(categoryService.create(USER_ID, input)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('update', () => {
  it('refuses to change a default category', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(DEFAULT_CATEGORY);

    await expect(
      categoryService.update(USER_ID, DEFAULT_CATEGORY.id, { name: 'X' }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(categoryRepository.update).not.toHaveBeenCalled();
  });

  it('answers 404 for a category of another user', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(null);

    await expect(categoryService.update(USER_ID, 'cat-x', { name: 'X' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects a rename to a name that is taken, ignoring the category itself', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(CUSTOM);
    categoryRepository.nameExists.mockResolvedValue(true);

    await expect(
      categoryService.update(USER_ID, CUSTOM.id, { name: 'Food' }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(categoryRepository.nameExists).toHaveBeenCalledWith({
      userId: USER_ID,
      type: 'expense',
      name: 'Food',
      excludeId: CUSTOM.id,
    });
  });

  it('updates the allowed fields', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(CUSTOM);
    categoryRepository.nameExists.mockResolvedValue(false);
    categoryRepository.update.mockResolvedValue({ ...CUSTOM, name: 'Tea' });

    const result = await categoryService.update(USER_ID, CUSTOM.id, { name: 'Tea' });

    expect(categoryRepository.update).toHaveBeenCalledWith(CUSTOM.id, USER_ID, { name: 'Tea' });
    expect(result.name).toBe('Tea');
  });
});

describe('remove', () => {
  it('refuses to delete a default category', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(DEFAULT_CATEGORY);

    await expect(categoryService.remove(USER_ID, DEFAULT_CATEGORY.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(categoryRepository.deleteOwned).not.toHaveBeenCalled();
  });

  it('refuses to delete a category that transactions still use', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(CUSTOM);
    categoryRepository.countUsage.mockResolvedValue(3);

    await expect(categoryService.remove(USER_ID, CUSTOM.id)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('3 transaction(s)'),
    });
    expect(categoryRepository.deleteOwned).not.toHaveBeenCalled();
  });

  it('deletes an unused custom category', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(CUSTOM);
    categoryRepository.countUsage.mockResolvedValue(0);

    await categoryService.remove(USER_ID, CUSTOM.id);

    expect(categoryRepository.deleteOwned).toHaveBeenCalledWith(CUSTOM.id, USER_ID);
  });
});
