'use strict';

jest.mock('../../src/config/db', () => ({ withTransaction: jest.fn() }));
jest.mock('../../src/repositories/account.repository');

const db = require('../../src/config/db');
const accountRepository = require('../../src/repositories/account.repository');
const accountService = require('../../src/services/account.service');

const CLIENT = { name: 'transaction-client' };
const USER = { id: 'user-1', currency: 'EUR' };
const A = { id: 'acc-a', name: 'Wallet', type: 'cash', balance: '100.00', currency: 'USD' };
const B = { id: 'acc-b', name: 'Bank', type: 'bank', balance: '0.00', currency: 'USD' };

beforeEach(() => {
  jest.resetAllMocks();
  db.withTransaction.mockImplementation((callback) => callback(CLIENT));
});

describe('create', () => {
  const input = { name: 'Wallet', type: 'cash', balance: '10', color: '#3B82F6' };

  it('rejects a name the user already has', async () => {
    accountRepository.nameExists.mockResolvedValue(true);

    await expect(accountService.create(USER, input)).rejects.toMatchObject({ statusCode: 409 });
    expect(accountRepository.create).not.toHaveBeenCalled();
  });

  it('falls back to the profile currency of the user', async () => {
    accountRepository.nameExists.mockResolvedValue(false);
    accountRepository.create.mockResolvedValue(A);

    await accountService.create(USER, input);

    expect(accountRepository.create).toHaveBeenCalledWith({
      userId: USER.id,
      ...input,
      currency: 'EUR',
    });
  });

  it('keeps an explicit currency', async () => {
    accountRepository.nameExists.mockResolvedValue(false);
    accountRepository.create.mockResolvedValue(A);

    await accountService.create(USER, { ...input, currency: 'GBP' });

    expect(accountRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'GBP' }),
    );
  });
});

describe('getById, update and archive', () => {
  it('answers 404 for an account of another user', async () => {
    accountRepository.findById.mockResolvedValue(null);

    await expect(accountService.getById(USER.id, 'x')).rejects.toMatchObject({ statusCode: 404 });
    await expect(accountService.update(USER.id, 'x', { name: 'N' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects a rename to a name that is taken, ignoring the account itself', async () => {
    accountRepository.findById.mockResolvedValue(A);
    accountRepository.nameExists.mockResolvedValue(true);

    await expect(accountService.update(USER.id, A.id, { name: 'Bank' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(accountRepository.nameExists).toHaveBeenCalledWith({
      userId: USER.id,
      name: 'Bank',
      excludeId: A.id,
    });
  });

  it('does nothing when the archive state is already right', async () => {
    accountRepository.findById.mockResolvedValue({ ...A, isArchived: true });

    await accountService.setArchived(USER.id, A.id, true);

    expect(accountRepository.setArchived).not.toHaveBeenCalled();
  });
});

describe('remove', () => {
  it('refuses to delete an account that still has records', async () => {
    accountRepository.findById.mockResolvedValue(A);
    accountRepository.countUsage.mockResolvedValue(4);

    await expect(accountService.remove(USER.id, A.id)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('4 record(s)'),
    });
    expect(accountRepository.deleteOwned).not.toHaveBeenCalled();
  });

  it('deletes an unused account', async () => {
    accountRepository.findById.mockResolvedValue(A);
    accountRepository.countUsage.mockResolvedValue(0);

    await accountService.remove(USER.id, A.id);

    expect(accountRepository.deleteOwned).toHaveBeenCalledWith(A.id, USER.id);
  });
});

describe('transfer', () => {
  const input = { fromAccountId: A.id, toAccountId: B.id, amount: '30.00' };

  it('locks both accounts, moves the money and records the transfer in one transaction', async () => {
    accountRepository.lockForUpdate.mockResolvedValue([A, B]);
    accountRepository.debit.mockResolvedValue({ ...A, balance: '70.00' });
    accountRepository.credit.mockResolvedValue({ ...B, balance: '30.00' });
    accountRepository.createTransfer.mockResolvedValue({ id: 't-1', amount: '30.00' });

    const result = await accountService.transfer(USER.id, input);

    expect(accountRepository.lockForUpdate).toHaveBeenCalledWith([A.id, B.id], USER.id, CLIENT);
    expect(accountRepository.debit).toHaveBeenCalledWith(A.id, USER.id, '30.00', CLIENT);
    expect(accountRepository.credit).toHaveBeenCalledWith(B.id, USER.id, '30.00', CLIENT);
    expect(accountRepository.createTransfer).toHaveBeenCalledWith(
      { userId: USER.id, ...input },
      CLIENT,
    );
    expect(result.accounts.from.balance).toBe('70.00');
    expect(result.accounts.to.balance).toBe('30.00');
  });

  it('answers 404 when one account is not the user own (it was not locked)', async () => {
    accountRepository.lockForUpdate.mockResolvedValue([A]);

    await expect(accountService.transfer(USER.id, input)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(accountRepository.debit).not.toHaveBeenCalled();
  });

  it('rejects an archived account', async () => {
    accountRepository.lockForUpdate.mockResolvedValue([A, { ...B, isArchived: true }]);

    await expect(accountService.transfer(USER.id, input)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(accountRepository.debit).not.toHaveBeenCalled();
  });

  it('rejects two different currencies', async () => {
    accountRepository.lockForUpdate.mockResolvedValue([A, { ...B, currency: 'EUR' }]);

    await expect(accountService.transfer(USER.id, input)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('same currency'),
    });
    expect(accountRepository.credit).not.toHaveBeenCalled();
  });
});

describe('listTransfers', () => {
  it('returns the page and its meta', async () => {
    accountRepository.listTransfers.mockResolvedValue([{ id: 't-1' }]);
    accountRepository.countTransfers.mockResolvedValue(45);

    const result = await accountService.listTransfers(USER.id, { page: 2, limit: 20 });

    expect(accountRepository.listTransfers).toHaveBeenCalledWith(USER.id, {
      limit: 20,
      offset: 20,
    });
    expect(result.meta).toMatchObject({ total: 45, page: 2, totalPages: 3, hasNext: true });
  });
});
