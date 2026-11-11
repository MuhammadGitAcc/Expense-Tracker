'use strict';

jest.mock('../../src/repositories/budget.repository');
jest.mock('../../src/repositories/category.repository');
jest.mock('../../src/services/budgetAlert.service');

const budgetRepository = require('../../src/repositories/budget.repository');
const categoryRepository = require('../../src/repositories/category.repository');
const budgetService = require('../../src/services/budget.service');

const USER_ID = 'user-1';
const FOOD = { id: 'cat-1', name: 'Food', type: 'expense' };
const BUDGET = { id: 'bud-1', amount: '300.00', spent: '0.00' };

beforeEach(() => {
  jest.resetAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('list', () => {
  it('lists the month that was asked for', async () => {
    budgetRepository.list.mockResolvedValue([BUDGET]);

    const result = await budgetService.list(USER_ID, { month: 3, year: 2026 });

    expect(budgetRepository.list).toHaveBeenCalledWith(USER_ID, { month: 3, year: 2026 });
    expect(result).toEqual({ budgets: [BUDGET], month: 3, year: 2026 });
  });

  it('falls back to the current month and year', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-15T12:00:00Z'));
    budgetRepository.list.mockResolvedValue([]);

    const result = await budgetService.list(USER_ID, {});

    expect(budgetRepository.list).toHaveBeenCalledWith(USER_ID, { month: 11, year: 2026 });
    expect(result).toMatchObject({ month: 11, year: 2026 });
  });
});

describe('getById', () => {
  it('returns the budget, or answers 404', async () => {
    budgetRepository.findById.mockResolvedValueOnce(BUDGET);
    expect(await budgetService.getById(USER_ID, 'bud-1')).toEqual(BUDGET);

    budgetRepository.findById.mockResolvedValueOnce(null);
    await expect(budgetService.getById(USER_ID, 'x')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('create', () => {
  const input = { categoryId: 'cat-1', amount: '300.00', month: 11, year: 2026 };

  it('creates a category budget for an expense category', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(FOOD);
    budgetRepository.create.mockResolvedValue('bud-1');
    budgetRepository.findById.mockResolvedValue(BUDGET);

    const result = await budgetService.create(USER_ID, input);

    expect(categoryRepository.findAccessibleById).toHaveBeenCalledWith('cat-1', USER_ID);
    expect(budgetRepository.create).toHaveBeenCalledWith({ userId: USER_ID, ...input });
    expect(result).toEqual(BUDGET);
  });

  it('creates an overall budget without looking at any category', async () => {
    budgetRepository.create.mockResolvedValue('bud-1');
    budgetRepository.findById.mockResolvedValue(BUDGET);

    await budgetService.create(USER_ID, {
      categoryId: null,
      amount: '1800.00',
      month: 11,
      year: 2026,
    });

    expect(categoryRepository.findAccessibleById).not.toHaveBeenCalled();
    expect(budgetRepository.create).toHaveBeenCalled();
  });

  it.each([
    ['an unknown category', null, 404],
    ['an income category', { ...FOOD, type: 'income' }, 400],
  ])('rejects %s and creates nothing', async (_name, category, status) => {
    categoryRepository.findAccessibleById.mockResolvedValue(category);

    await expect(budgetService.create(USER_ID, input)).rejects.toMatchObject({
      statusCode: status,
    });
    expect(budgetRepository.create).not.toHaveBeenCalled();
  });

  it('answers 409 for a second budget of the same category and month', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(FOOD);
    budgetRepository.create.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));

    await expect(budgetService.create(USER_ID, input)).rejects.toMatchObject({
      statusCode: 409,
      message: 'A budget for this category and month already exists',
    });
  });

  it('answers 409 for a second overall budget of the same month', async () => {
    budgetRepository.create.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));

    await expect(
      budgetService.create(USER_ID, { amount: '1800.00', month: 11, year: 2026 }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'An overall budget for this month already exists',
    });
  });

  it('passes other database errors on unchanged', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(FOOD);
    const boom = new Error('connection lost');
    budgetRepository.create.mockRejectedValue(boom);

    await expect(budgetService.create(USER_ID, input)).rejects.toBe(boom);
  });
});

describe('update', () => {
  it('updates the budget and returns it with fresh numbers', async () => {
    budgetRepository.update.mockResolvedValue(true);
    budgetRepository.findById.mockResolvedValue(BUDGET);

    const result = await budgetService.update(USER_ID, 'bud-1', { amount: '400.00' });

    expect(budgetRepository.update).toHaveBeenCalledWith('bud-1', USER_ID, { amount: '400.00' });
    expect(result).toEqual(BUDGET);
  });

  it('answers 404 for a budget that is not the user own', async () => {
    budgetRepository.update.mockResolvedValue(false);

    await expect(budgetService.update(USER_ID, 'x', { alertThreshold: 90 })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(budgetRepository.findById).not.toHaveBeenCalled();
  });
});

describe('remove', () => {
  it('deletes the budget', async () => {
    budgetRepository.deleteById.mockResolvedValue(true);

    await budgetService.remove(USER_ID, 'bud-1');

    expect(budgetRepository.deleteById).toHaveBeenCalledWith('bud-1', USER_ID);
  });

  it('answers 404 for a budget that is not the user own', async () => {
    budgetRepository.deleteById.mockResolvedValue(false);

    await expect(budgetService.remove(USER_ID, 'x')).rejects.toMatchObject({ statusCode: 404 });
  });
});
