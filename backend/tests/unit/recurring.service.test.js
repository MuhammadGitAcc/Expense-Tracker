'use strict';

jest.mock('../../src/repositories/recurring.repository');
jest.mock('../../src/repositories/account.repository');
jest.mock('../../src/repositories/category.repository');

const recurringRepository = require('../../src/repositories/recurring.repository');
const accountRepository = require('../../src/repositories/account.repository');
const categoryRepository = require('../../src/repositories/category.repository');
const recurringService = require('../../src/services/recurring.service');

const USER_ID = 'user-1';
const ACCOUNT = { id: 'acc-1', isArchived: false };
const FOOD = { id: 'cat-1', name: 'Food', type: 'expense' };
const SALARY = { id: 'cat-2', name: 'Salary', type: 'income' };
const TEMPLATE = {
  id: 'rec-1',
  type: 'expense',
  frequency: 'monthly',
  startDate: '2026-01-31',
  endDate: null,
  nextRunDate: '2026-11-30',
  isActive: true,
  account: { id: 'acc-1' },
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('nextRunOnOrAfter', () => {
  const { nextRunOnOrAfter } = recurringService;

  it('returns the start date when it is today or in the future', () => {
    expect(nextRunOnOrAfter('2026-11-09', 'daily', '2026-11-09')).toBe('2026-11-09');
    expect(nextRunOnOrAfter('2026-12-25', 'weekly', '2026-11-09')).toBe('2026-12-25');
  });

  it('skips past dates and lands on the first one on or after the given day', () => {
    expect(nextRunOnOrAfter('2026-11-01', 'daily', '2026-11-09')).toBe('2026-11-09');
    expect(nextRunOnOrAfter('2026-10-01', 'weekly', '2026-11-09')).toBe('2026-11-12');
    expect(nextRunOnOrAfter('2026-08-15', 'monthly', '2026-11-09')).toBe('2026-11-15');
  });

  it('keeps the original day for monthly schedules that start on the 31st', () => {
    expect(nextRunOnOrAfter('2026-01-31', 'monthly', '2026-02-10')).toBe('2026-02-28');
    expect(nextRunOnOrAfter('2026-01-31', 'monthly', '2026-03-01')).toBe('2026-03-31');
    expect(nextRunOnOrAfter('2026-01-31', 'monthly', '2026-11-09')).toBe('2026-11-30');
  });

  it('handles yearly schedules that start on February 29', () => {
    expect(nextRunOnOrAfter('2024-02-29', 'yearly', '2026-11-09')).toBe('2027-02-28');
    expect(nextRunOnOrAfter('2024-02-29', 'yearly', '2028-01-01')).toBe('2028-02-29');
  });
});

describe('create', () => {
  const input = {
    type: 'expense',
    amount: '12.00',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    frequency: 'weekly',
  };

  beforeEach(() => {
    accountRepository.findById.mockResolvedValue(ACCOUNT);
    categoryRepository.findAccessibleById.mockResolvedValue(FOOD);
    recurringRepository.create.mockResolvedValue('rec-1');
    recurringRepository.findById.mockResolvedValue(TEMPLATE);
  });

  it('starts today by default and stores the first run date', async () => {
    const result = await recurringService.create(USER_ID, input);

    expect(recurringRepository.create).toHaveBeenCalledWith({
      userId: USER_ID,
      ...input,
      startDate: '2026-11-09',
      endDate: null,
      nextRunDate: '2026-11-09',
    });
    expect(result).toEqual(TEMPLATE);
  });

  it('calculates the next run date for a start date in the past', async () => {
    await recurringService.create(USER_ID, {
      ...input,
      frequency: 'monthly',
      startDate: '2026-01-31',
    });

    expect(recurringRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-01-31', nextRunDate: '2026-11-30' }),
    );
  });

  it.each([
    ['an unknown account', () => accountRepository.findById.mockResolvedValue(null), 404],
    [
      'an archived account',
      () => accountRepository.findById.mockResolvedValue({ ...ACCOUNT, isArchived: true }),
      400,
    ],
    [
      'an unknown category',
      () => categoryRepository.findAccessibleById.mockResolvedValue(null),
      404,
    ],
    [
      'a category of the wrong type',
      () => categoryRepository.findAccessibleById.mockResolvedValue(SALARY),
      400,
    ],
  ])('rejects %s and creates nothing', async (_name, arrange, status) => {
    arrange();

    await expect(recurringService.create(USER_ID, input)).rejects.toMatchObject({
      statusCode: status,
    });
    expect(recurringRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a schedule that has already ended', async () => {
    await expect(
      recurringService.create(USER_ID, {
        ...input,
        frequency: 'daily',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'This schedule has already ended' });
    expect(recurringRepository.create).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  beforeEach(() => {
    recurringRepository.findById.mockResolvedValue(TEMPLATE);
    recurringRepository.update.mockResolvedValue(true);
    accountRepository.findById.mockResolvedValue(ACCOUNT);
    categoryRepository.findAccessibleById.mockResolvedValue(FOOD);
  });

  it('answers 404 for a template that is not the user own', async () => {
    recurringRepository.findById.mockResolvedValue(null);

    await expect(recurringService.update(USER_ID, 'x', { note: 'n' })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(recurringRepository.update).not.toHaveBeenCalled();
  });

  it('updates plain fields without looking at accounts or categories', async () => {
    await recurringService.update(USER_ID, 'rec-1', { amount: '20.00', note: 'Rent share' });

    expect(recurringRepository.update).toHaveBeenCalledWith('rec-1', USER_ID, {
      amount: '20.00',
      note: 'Rent share',
    });
    expect(accountRepository.findById).not.toHaveBeenCalled();
    expect(categoryRepository.findAccessibleById).not.toHaveBeenCalled();
  });

  it('checks the new account and requires the same category type as the template', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue(SALARY);

    await expect(
      recurringService.update(USER_ID, 'rec-1', { categoryId: 'cat-2' }),
    ).rejects.toMatchObject({ statusCode: 400 });

    accountRepository.findById.mockResolvedValue({ ...ACCOUNT, isArchived: true });
    await expect(
      recurringService.update(USER_ID, 'rec-1', { accountId: 'acc-9' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(recurringRepository.update).not.toHaveBeenCalled();
  });

  it('rejects an end date before the next run date', async () => {
    await expect(
      recurringService.update(USER_ID, 'rec-1', { endDate: '2026-11-10' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(recurringRepository.update).not.toHaveBeenCalled();
  });

  it('accepts an end date on the next run date, and null to clear it', async () => {
    await recurringService.update(USER_ID, 'rec-1', { endDate: '2026-11-30' });
    await recurringService.update(USER_ID, 'rec-1', { endDate: null });

    expect(recurringRepository.update).toHaveBeenCalledTimes(2);
  });
});

describe('setActive', () => {
  beforeEach(() => {
    recurringRepository.setActive.mockResolvedValue(true);
  });

  it('answers 404 for a template that is not the user own', async () => {
    recurringRepository.findById.mockResolvedValue(null);

    await expect(recurringService.setActive(USER_ID, 'x', false)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('pauses without touching the next run date', async () => {
    recurringRepository.findById.mockResolvedValue(TEMPLATE);

    await recurringService.setActive(USER_ID, 'rec-1', false);

    expect(recurringRepository.setActive).toHaveBeenCalledWith('rec-1', USER_ID, false, null);
  });

  it('keeps the next run date on resume when it is still today or later', async () => {
    recurringRepository.findById.mockResolvedValue({ ...TEMPLATE, isActive: false });

    await recurringService.setActive(USER_ID, 'rec-1', true);

    expect(recurringRepository.setActive).toHaveBeenCalledWith('rec-1', USER_ID, true, null);
  });

  it('moves a stale next run date forward on resume (no burst of old runs)', async () => {
    recurringRepository.findById.mockResolvedValue({
      ...TEMPLATE,
      isActive: false,
      frequency: 'weekly',
      startDate: '2026-10-01',
      nextRunDate: '2026-10-15',
    });

    await recurringService.setActive(USER_ID, 'rec-1', true);

    expect(recurringRepository.setActive).toHaveBeenCalledWith(
      'rec-1',
      USER_ID,
      true,
      '2026-11-12',
    );
  });

  it('refuses to resume a schedule that has already ended', async () => {
    recurringRepository.findById.mockResolvedValue({
      ...TEMPLATE,
      isActive: false,
      frequency: 'weekly',
      startDate: '2026-10-01',
      nextRunDate: '2026-10-15',
      endDate: '2026-11-01',
    });

    await expect(recurringService.setActive(USER_ID, 'rec-1', true)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(recurringRepository.setActive).not.toHaveBeenCalled();
  });
});

describe('list, getById and remove', () => {
  it('passes the filters on', async () => {
    recurringRepository.list.mockResolvedValue([TEMPLATE]);

    const result = await recurringService.list(USER_ID, { type: 'expense', isActive: true });

    expect(recurringRepository.list).toHaveBeenCalledWith(USER_ID, {
      type: 'expense',
      isActive: true,
    });
    expect(result.recurringTransactions).toEqual([TEMPLATE]);
  });

  it('getById returns the template, or answers 404', async () => {
    recurringRepository.findById.mockResolvedValueOnce(TEMPLATE);
    expect(await recurringService.getById(USER_ID, 'rec-1')).toEqual(TEMPLATE);

    recurringRepository.findById.mockResolvedValueOnce(null);
    await expect(recurringService.getById(USER_ID, 'x')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('remove deletes the template, or answers 404', async () => {
    recurringRepository.deleteById.mockResolvedValueOnce(true);
    await recurringService.remove(USER_ID, 'rec-1');
    expect(recurringRepository.deleteById).toHaveBeenCalledWith('rec-1', USER_ID);

    recurringRepository.deleteById.mockResolvedValueOnce(false);
    await expect(recurringService.remove(USER_ID, 'x')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
