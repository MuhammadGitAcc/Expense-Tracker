'use strict';

jest.mock('../../src/config/db', () => ({ withTransaction: jest.fn() }));
jest.mock('../../src/repositories/expense.repository');
jest.mock('../../src/repositories/account.repository');
jest.mock('../../src/repositories/category.repository');
jest.mock('../../src/services/upload.service');

const db = require('../../src/config/db');
const expenseRepository = require('../../src/repositories/expense.repository');
const accountRepository = require('../../src/repositories/account.repository');
const categoryRepository = require('../../src/repositories/category.repository');
const uploadService = require('../../src/services/upload.service');
const expenseService = require('../../src/services/expense.service');

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
const FOOD = { id: 'cat-1', name: 'Food', type: 'expense' };
const EXPENSE = { id: 'exp-1', amount: '30.00' };
const CURRENT = { id: 'exp-1', accountId: 'acc-1', categoryId: 'cat-1', amount: '30.00' };

beforeEach(() => {
  jest.resetAllMocks();
  db.withTransaction.mockImplementation((callback) => callback(CLIENT));
});

describe('create', () => {
  const input = {
    accountId: 'acc-1',
    categoryId: 'cat-1',
    amount: '12.50',
    paymentMethod: 'cash',
    tags: [],
  };

  it('records the expense and takes the amount from the account in one transaction', async () => {
    accountRepository.lockForUpdate.mockResolvedValue([ACCOUNT]);
    categoryRepository.findAccessibleById.mockResolvedValue(FOOD);
    expenseRepository.create.mockResolvedValue('exp-1');
    expenseRepository.findById.mockResolvedValue(EXPENSE);
    accountRepository.debit.mockResolvedValue({ ...ACCOUNT, balance: '87.50' });

    const result = await expenseService.create(USER_ID, input);

    expect(accountRepository.lockForUpdate).toHaveBeenCalledWith(['acc-1'], USER_ID, CLIENT);
    expect(expenseRepository.create).toHaveBeenCalledWith({ userId: USER_ID, ...input }, CLIENT);
    expect(accountRepository.debit).toHaveBeenCalledWith('acc-1', USER_ID, '12.50', CLIENT);
    expect(result).toEqual({
      expense: EXPENSE,
      accounts: [{ ...ACCOUNT, balance: '87.50' }],
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
      'an income category',
      () => {
        accountRepository.lockForUpdate.mockResolvedValue([ACCOUNT]);
        categoryRepository.findAccessibleById.mockResolvedValue({ ...FOOD, type: 'income' });
      },
      400,
    ],
  ])('rejects %s and changes nothing', async (_name, arrange, status) => {
    arrange();

    await expect(expenseService.create(USER_ID, input)).rejects.toMatchObject({
      statusCode: status,
    });
    expect(expenseRepository.create).not.toHaveBeenCalled();
    expect(accountRepository.debit).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  beforeEach(() => {
    expenseRepository.lockById.mockResolvedValue(CURRENT);
    expenseRepository.update.mockResolvedValue(true);
    expenseRepository.findById.mockResolvedValue(EXPENSE);
    accountRepository.lockForUpdate.mockResolvedValue([ACCOUNT, ACCOUNT_2]);
    accountRepository.credit.mockImplementation(async (id) => ({
      ...ACCOUNT,
      id,
      balance: '130.00',
    }));
    accountRepository.debit.mockImplementation(async (id) => ({
      ...ACCOUNT,
      id,
      balance: '50.00',
    }));
  });

  it('answers 404 for an expense that is not the user own', async () => {
    expenseRepository.lockById.mockResolvedValue(null);

    await expect(expenseService.update(USER_ID, 'x', { note: 'n' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('gives the old amount back and takes the new one when the amount changes', async () => {
    const result = await expenseService.update(USER_ID, 'exp-1', { amount: '50.00' });

    expect(accountRepository.credit).toHaveBeenCalledWith('acc-1', USER_ID, '30.00', CLIENT);
    expect(accountRepository.debit).toHaveBeenCalledWith('acc-1', USER_ID, '50.00', CLIENT);
    expect(result.accounts).toHaveLength(1);
  });

  it('moves the amount from the old account to the new one', async () => {
    const result = await expenseService.update(USER_ID, 'exp-1', { accountId: 'acc-2' });

    expect(accountRepository.lockForUpdate).toHaveBeenCalledWith(
      ['acc-1', 'acc-2'],
      USER_ID,
      CLIENT,
    );
    expect(accountRepository.credit).toHaveBeenCalledWith('acc-1', USER_ID, '30.00', CLIENT);
    expect(accountRepository.debit).toHaveBeenCalledWith('acc-2', USER_ID, '30.00', CLIENT);
    expect(result.accounts.map((a) => a.id)).toEqual(['acc-1', 'acc-2']);
  });

  it('refuses to move an expense into an archived account', async () => {
    accountRepository.lockForUpdate.mockResolvedValue([
      ACCOUNT,
      { ...ACCOUNT_2, isArchived: true },
    ]);

    await expect(
      expenseService.update(USER_ID, 'exp-1', { accountId: 'acc-2' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(expenseRepository.update).not.toHaveBeenCalled();
    expect(accountRepository.debit).not.toHaveBeenCalled();
  });

  it('touches no balance when only the note changes', async () => {
    const result = await expenseService.update(USER_ID, 'exp-1', { note: 'Lunch' });

    expect(expenseRepository.update).toHaveBeenCalledWith(
      'exp-1',
      USER_ID,
      { note: 'Lunch' },
      CLIENT,
    );
    expect(accountRepository.lockForUpdate).not.toHaveBeenCalled();
    expect(accountRepository.credit).not.toHaveBeenCalled();
    expect(accountRepository.debit).not.toHaveBeenCalled();
    expect(result.accounts).toEqual([]);
  });

  it('requires an expense category when the category changes', async () => {
    categoryRepository.findAccessibleById.mockResolvedValue({ ...FOOD, type: 'income' });

    await expect(
      expenseService.update(USER_ID, 'exp-1', { categoryId: 'cat-9' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(expenseRepository.update).not.toHaveBeenCalled();
  });
});

describe('remove', () => {
  it('answers 404 for an expense that is not the user own', async () => {
    expenseRepository.lockById.mockResolvedValue(null);

    await expect(expenseService.remove(USER_ID, 'x')).rejects.toMatchObject({ statusCode: 404 });
    expect(expenseRepository.deleteById).not.toHaveBeenCalled();
  });

  it('gives the amount back to the account and deletes the expense', async () => {
    expenseRepository.lockById.mockResolvedValue(CURRENT);
    accountRepository.lockForUpdate.mockResolvedValue([ACCOUNT]);
    accountRepository.credit.mockResolvedValue({ ...ACCOUNT, balance: '130.00' });

    const result = await expenseService.remove(USER_ID, 'exp-1');

    expect(accountRepository.credit).toHaveBeenCalledWith('acc-1', USER_ID, '30.00', CLIENT);
    expect(expenseRepository.deleteById).toHaveBeenCalledWith('exp-1', USER_ID, CLIENT);
    expect(result.accounts[0].balance).toBe('130.00');
  });
});

describe('receipts', () => {
  const FILE = { buffer: Buffer.from('x') };

  it('refuses a request without a file', async () => {
    await expect(expenseService.attachReceipt(USER_ID, 'exp-1', undefined)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(uploadService.saveReceipt).not.toHaveBeenCalled();
  });

  it('answers 404 before any file is written when the expense is not the user own', async () => {
    expenseRepository.findById.mockResolvedValue(null);

    await expect(expenseService.attachReceipt(USER_ID, 'x', FILE)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(uploadService.saveReceipt).not.toHaveBeenCalled();
  });

  it('saves the new file, stores its name and deletes the previous file', async () => {
    expenseRepository.findById.mockResolvedValue(EXPENSE);
    uploadService.saveReceipt.mockResolvedValue('new.png');
    expenseRepository.getReceiptFile.mockResolvedValue('old.png');
    expenseRepository.setReceiptFile.mockResolvedValue(true);

    const result = await expenseService.attachReceipt(USER_ID, 'exp-1', FILE);

    expect(uploadService.saveReceipt).toHaveBeenCalledWith(USER_ID, FILE);
    expect(expenseRepository.setReceiptFile).toHaveBeenCalledWith('exp-1', USER_ID, 'new.png');
    expect(uploadService.deleteReceiptFile).toHaveBeenCalledWith('old.png');
    expect(uploadService.deleteReceiptFile).not.toHaveBeenCalledWith('new.png');
    expect(result).toEqual(EXPENSE);
  });

  it('deletes the new file again when the database update fails (no orphan file)', async () => {
    expenseRepository.findById.mockResolvedValue(EXPENSE);
    uploadService.saveReceipt.mockResolvedValue('new.png');
    expenseRepository.getReceiptFile.mockResolvedValue(null);
    expenseRepository.setReceiptFile.mockRejectedValue(new Error('db down'));

    await expect(expenseService.attachReceipt(USER_ID, 'exp-1', FILE)).rejects.toThrow('db down');
    expect(uploadService.deleteReceiptFile).toHaveBeenCalledWith('new.png');
  });

  it('answers 404 and deletes the new file when the expense vanished meanwhile', async () => {
    expenseRepository.findById.mockResolvedValue(EXPENSE);
    uploadService.saveReceipt.mockResolvedValue('new.png');
    expenseRepository.getReceiptFile.mockResolvedValue(null);
    expenseRepository.setReceiptFile.mockResolvedValue(false);

    await expect(expenseService.attachReceipt(USER_ID, 'exp-1', FILE)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(uploadService.deleteReceiptFile).toHaveBeenCalledWith('new.png');
  });

  it('removes a receipt: clears the column, then deletes the file', async () => {
    expenseRepository.getReceiptFile.mockResolvedValue('a.png');
    expenseRepository.setReceiptFile.mockResolvedValue(true);
    expenseRepository.findById.mockResolvedValue(EXPENSE);

    await expenseService.removeReceipt(USER_ID, 'exp-1');

    expect(expenseRepository.setReceiptFile).toHaveBeenCalledWith('exp-1', USER_ID, null);
    expect(uploadService.deleteReceiptFile).toHaveBeenCalledWith('a.png');
  });

  it('answers 404 when removing a receipt of an unknown expense or one without a receipt', async () => {
    expenseRepository.getReceiptFile.mockResolvedValueOnce(undefined);
    await expect(expenseService.removeReceipt(USER_ID, 'x')).rejects.toMatchObject({
      statusCode: 404,
    });

    expenseRepository.getReceiptFile.mockResolvedValueOnce(null);
    await expect(expenseService.removeReceipt(USER_ID, 'exp-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('resolves the path of the own receipt and answers 404 when it is missing', async () => {
    expenseRepository.getReceiptFile.mockResolvedValue('a.png');
    uploadService.resolveReceiptFile.mockResolvedValueOnce('/data/receipts/a.png');
    expect(await expenseService.getReceiptPath(USER_ID, 'exp-1')).toBe('/data/receipts/a.png');

    uploadService.resolveReceiptFile.mockResolvedValueOnce(null);
    await expect(expenseService.getReceiptPath(USER_ID, 'exp-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('deletes the receipt file after the expense is deleted', async () => {
    expenseRepository.lockById.mockResolvedValue({ ...CURRENT, receiptFile: 'a.png' });
    accountRepository.lockForUpdate.mockResolvedValue([ACCOUNT]);
    accountRepository.credit.mockResolvedValue(ACCOUNT);

    const result = await expenseService.remove(USER_ID, 'exp-1');

    expect(expenseRepository.deleteById).toHaveBeenCalled();
    expect(uploadService.deleteReceiptFile).toHaveBeenCalledWith('a.png');
    expect(result).toEqual({ accounts: [ACCOUNT] });
  });
});

describe('list', () => {
  it('passes filters and sorting on and adds the exact total to the pagination meta', async () => {
    expenseRepository.list.mockResolvedValue([EXPENSE]);
    expenseRepository.summary.mockResolvedValue({ total: 45, totalAmount: '600.00' });

    const result = await expenseService.list(USER_ID, {
      page: 2,
      limit: 20,
      search: 'cafe',
      sortBy: 'amount',
      sortOrder: 'asc',
    });

    expect(expenseRepository.list).toHaveBeenCalledWith(
      USER_ID,
      { search: 'cafe' },
      { sortBy: 'amount', sortOrder: 'asc', limit: 20, offset: 20 },
    );
    expect(expenseRepository.summary).toHaveBeenCalledWith(USER_ID, { search: 'cafe' });
    expect(result.meta).toMatchObject({ total: 45, page: 2, totalPages: 3, totalAmount: '600.00' });
  });
});
