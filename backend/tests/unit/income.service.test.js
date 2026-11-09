'use strict';

jest.mock('../../src/config/db', () => ({ withTransaction: jest.fn() }));
jest.mock('../../src/repositories/income.repository');
jest.mock('../../src/repositories/account.repository');
jest.mock('../../src/repositories/category.repository');

const db = require('../../src/config/db');
const incomeRepository = require('../../src/repositories/income.repository');
const accountRepository = require('../../src/repositories/account.repository');
const categoryRepository = require('../../src/repositories/category.repository');
const incomeService = require('../../src/services/income.service');

const CLIENT = { name: 'transaction-client' };
const USER_ID = 'user-1';
const ACCOUNT = {
  id: 'acc-1',
  name: 'Wallet',
  balance: '100.00',
  currency: 'USD',
  isArchived: false,
};
const ACCOUNT_2 = { ...ACCOUNT, id: 'acc-2', name: 'Bank' };
const SALARY = { id: 'cat-1', name: 'Salary', type: 'income' };
const INCOME = { id: 'inc-1', amount: '30.00' };
const CURRENT = { id: 'inc-1', accountId: 'acc-1', categoryId: 'cat-1', amount: '30.00' };

beforeEach(() => {
  jest.resetAllMocks();
  db.withTransaction.mockImplementation((callback) => callback(CLIENT));
});

describe('create', () => {
  const input = {
    accountId: 'acc-1',
    categoryId: 'cat-1',
    amount: '12.50',
  };

  it('records the income and adds the amount to the account in one transaction', async () => {
    accountRepository.lockForUpdate.mockResolvedValue([ACCOUNT]);
    categoryRepository.findAccessibleById.mockResolvedValue(SALARY);
    incomeRepository.create.mockResolvedValue('inc-1');
    incomeRepository.findById.mockResolvedValue(INCOME);
    accountRepository.credit.mockResolvedValue({ ...ACCOUNT, balance: '112.50' });

    const result = await incomeService.create(USER_ID, input);

    expect(accountRepository.lockForUpdate).toHaveBeenCalledWith(['acc-1'], USER_ID, CLIENT);
    expect(incomeRepository.create).toHaveBeenCalledWith({ userId: USER_ID, ...input }, CLIENT);
    expect(accountRepository.credit).toHaveBeenCalledWith('acc-1', USER_ID, '12.50', CLIENT);
    expect(accountRepository.debit).not.toHaveBeenCalled();
    expect(result).toEqual({
      income: INCOME,
      accounts: [{ ...ACCOUNT, balance: '112.50' }],
    });
  });

  it.each([
    ['an unknown account', () => accountRepository.lockForUpdate.mockResolvedValue([]), 404],
    [
      'an archived account',
      () => accountRepository.lockForUpdate.mockResolvedValue([{ ...ACCOUNT, isArchived: true }]),
      400,
    ],
    [
      'an unknown category',
      () => {
        accountRepository.lockForUpdate.mockResolvedValue([ACCOUNT]);
        categoryRepository.findAccessibleById.mockResolvedValue(null);
      },
      404,
    ],
    [
      'an expense category',
      () => {
        accountRepository.lockForUpdate.mockResolvedValue([ACCOUNT]);
        categoryRepository.findAccessibleById.mockResolvedValue({ ...SALARY, type: 'expense' });
      },
      400,
    ],
  ])('rejects %s and changes nothing', async (_name, arrange, status) => {
    arrange();

    await expect(incomeService.create(USER_ID, input)).rejects.toMatchObject({
      statusCode: status,
    });
    expect(incomeRepository.create).not.toHaveBeenCalled();
    expect(accountRepository.credit).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  beforeEach(() => {
    incomeRepository.lockById.mockResolvedValue(CURRENT);
    incomeRepository.update.mockResolvedValue(true);
    incomeRepository.findById.mockResolvedValue(INCOME);
    accountRepository.lockForUpdate.mockResolvedValue([ACCOUNT, ACCOUNT_2]);
    accountRepository.debit.mockImplementation(async (id) => ({
      ...ACCOUNT,
      id,
      balance: '70.00',
    }));
    accountRepository.credit.mockImplementation(async (id) => ({
      ...ACCOUNT,
      id,
      balance: '150.00',
    }));
  });

  it('answers 404 for an income that is not the user own', async () => {
    incomeRepository.lockById.mockResolvedValue(null);

    await expect(incomeService.update(USER_ID, 'x', { note: 'n' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('takes the old amount back and adds the new one when the amount changes', async () => {
    const result = await incomeService.update(USER_ID, 'inc-1', { amount: '50.00' });

    expect(accountRepository.debit).toHaveBeenCalledWith('acc-1', USER_ID, '30.00', CLIENT);
    expect(accountRepository.credit).toHaveBeenCalledWith('acc-1', USER_ID, '50.00', CLIENT);
    expect(result.accounts).toHaveLength(1);
  });

  it('moves the amount from the old account to the new one', async () => {
    const result = await incomeService.update(USER_ID, 'inc-1', { accountId: 'acc-2' });

    expect(accountRepository.lockForUpdate).toHaveBeenCalledWith(
      ['acc-1', 'acc-2'],
      USER_ID,
      CLIENT,
    );
    expect(accountRepository.debit).toHaveBeenCalledWith('acc-1', USER_ID, '30.00', CLIENT);
    expect(accountRepository.credit).toHaveBeenCalledWith('acc-2', USER_ID, '30.00', CLIENT);
    expect(result.accounts.map((a) => a.id)).toEqual(['acc-1', 'acc-2']);
  });

  it('refuses to move an income into an archived account', async () => {
    accountRepository.lockForUpdate.mockResolvedValue([
      ACCOUNT,
      { ...ACCOUNT_2, isArchived: true },
    ]);

    await expect(
      incomeService.update(USER_ID, 'inc-1', { accountId: 'acc-2' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(incomeRepository.update).not.toHaveBeenCalled();
    expect(accountRepository.credit).not.toHaveBeenCalled();
  });

  it('touches no balance when only the source or note changes', async () => {
    const result = await incomeService.update(USER_ID, 'inc-1', { source: 'Employer' });

    expect(incomeRepository.update).toHaveBeenCalledWith(
      'inc-1',
      USER_ID,
      { source: 'Employer' },
      CLIENT,
    );
    expect(accountRepository.lockForUpdate).not.toHaveBeenCalled();
    expect(accountRepository.debit).not.toHaveBeenCalled();
    expect(accountRepository.credit).not.toHaveBeenCalled();
    expect(result.accounts).toEqual([]);
  });

  it('requires an income category when the category changes', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue({ ...SALARY, type: 'expense' });

    await expect(
      incomeService.update(USER_ID, 'inc-1', { categoryId: 'cat-9' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(incomeRepository.update).not.toHaveBeenCalled();
  });
});

describe('remove', () => {
  it('answers 404 for an income that is not the user own', async () => {
    incomeRepository.lockById.mockResolvedValue(null);

    await expect(incomeService.remove(USER_ID, 'x')).rejects.toMatchObject({ statusCode: 404 });
    expect(incomeRepository.deleteById).not.toHaveBeenCalled();
  });

  it('takes the amount back from the account and deletes the income', async () => {
    incomeRepository.lockById.mockResolvedValue(CURRENT);
    accountRepository.lockForUpdate.mockResolvedValue([ACCOUNT]);
    accountRepository.debit.mockResolvedValue({ ...ACCOUNT, balance: '70.00' });

    const result = await incomeService.remove(USER_ID, 'inc-1');

    expect(accountRepository.debit).toHaveBeenCalledWith('acc-1', USER_ID, '30.00', CLIENT);
    expect(incomeRepository.deleteById).toHaveBeenCalledWith('inc-1', USER_ID, CLIENT);
    expect(result.accounts[0].balance).toBe('70.00');
  });
});

describe('getById', () => {
  it('returns the income, or answers 404', async () => {
    incomeRepository.findById.mockResolvedValueOnce(INCOME);
    expect(await incomeService.getById(USER_ID, 'inc-1')).toEqual(INCOME);

    incomeRepository.findById.mockResolvedValueOnce(null);
    await expect(incomeService.getById(USER_ID, 'x')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('list', () => {
  it('passes filters and sorting on and adds the exact total to the pagination meta', async () => {
    incomeRepository.list.mockResolvedValue([INCOME]);
    incomeRepository.summary.mockResolvedValue({ total: 45, totalAmount: '600.00' });

    const result = await incomeService.list(USER_ID, {
      page: 2,
      limit: 20,
      search: 'employer',
      sortBy: 'amount',
      sortOrder: 'asc',
    });

    expect(incomeRepository.list).toHaveBeenCalledWith(
      USER_ID,
      { search: 'employer' },
      { sortBy: 'amount', sortOrder: 'asc', limit: 20, offset: 20 },
    );
    expect(incomeRepository.summary).toHaveBeenCalledWith(USER_ID, { search: 'employer' });
    expect(result.incomes).toEqual([INCOME]);
    expect(result.meta).toMatchObject({ total: 45, page: 2, totalPages: 3, totalAmount: '600.00' });
  });
});
