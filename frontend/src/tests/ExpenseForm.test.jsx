import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import '@/i18n';
import * as expensesApi from '@/api/expenses.api';
import { store } from '@/app/store';
import { EXPENSE_FORM_ID, ExpenseForm } from '@/features/expenses/ExpenseForm';

vi.mock('@/api/expenses.api');

const accounts = [
  { id: 'acc-1', name: 'Wallet', currency: 'USD' },
  { id: 'acc-2', name: 'Bank', currency: 'USD' },
];
const categories = [{ id: 'cat-1', name: 'Food', type: 'expense' }];

const existing = {
  id: 'exp-1',
  amount: '12.50',
  date: '2026-11-01',
  account: accounts[0],
  category: categories[0],
  paymentMethod: 'cash',
  tags: ['lunch'],
  note: 'Pizza',
  receiptUrl: null,
};

function renderForm(props = {}) {
  const onSaved = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ExpenseForm accounts={accounts} categories={categories} onSaved={onSaved} {...props} />
        {/* In the app the Save button lives in the Modal footer and points at the form. */}
        <button type="submit" form={EXPENSE_FORM_ID}>
          Save
        </button>
      </QueryClientProvider>
    </Provider>,
  );
  return { onSaved, user: userEvent.setup() };
}

const save = (user) => user.click(screen.getByRole('button', { name: 'Save' }));

beforeEach(() => {
  vi.resetAllMocks();
  expensesApi.createExpense.mockResolvedValue({ data: { expense: { ...existing } } });
  expensesApi.updateExpense.mockResolvedValue({ data: { expense: { ...existing } } });
  expensesApi.uploadReceipt.mockResolvedValue({ data: {} });
  expensesApi.removeReceipt.mockResolvedValue({ data: {} });
});

describe('ExpenseForm', () => {
  it('sends a clean payload when creating (tags parsed, empty note left out)', async () => {
    const { user, onSaved } = renderForm();

    await user.type(screen.getByLabelText(/^Amount/), '12.50');
    await user.selectOptions(screen.getByLabelText(/^Category/), 'cat-1');
    await user.type(screen.getByLabelText(/^Tags/), ' Food, Lunch,food ');
    await save(user);

    await waitFor(() => expect(expensesApi.createExpense).toHaveBeenCalledTimes(1));
    const payload = expensesApi.createExpense.mock.calls[0][0];
    expect(payload).toMatchObject({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      amount: '12.50',
      paymentMethod: 'cash',
      tags: ['food', 'lunch'],
    });
    expect(payload).not.toHaveProperty('note');
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('refuses a missing category and sends nothing', async () => {
    const { user, onSaved } = renderForm();

    await user.type(screen.getByLabelText(/^Amount/), '5');
    await save(user);

    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(expensesApi.createExpense).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('refuses an amount of 0 and sends nothing', async () => {
    const { user } = renderForm();

    await user.type(screen.getByLabelText(/^Amount/), '0');
    await user.selectOptions(screen.getByLabelText(/^Category/), 'cat-1');
    await save(user);

    expect(await screen.findByText('The amount must be greater than zero')).toBeInTheDocument();
    expect(expensesApi.createExpense).not.toHaveBeenCalled();
  });

  it('sends only the changed field when editing', async () => {
    const { user } = renderForm({ expense: existing });

    const amount = screen.getByLabelText(/^Amount/);
    await user.clear(amount);
    await user.type(amount, '20');
    await save(user);

    await waitFor(() => expect(expensesApi.updateExpense).toHaveBeenCalledTimes(1));
    expect(expensesApi.updateExpense).toHaveBeenCalledWith('exp-1', { amount: '20' });
  });

  it('sends nothing and closes when nothing changed', async () => {
    const { user, onSaved } = renderForm({ expense: existing });

    await save(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(expensesApi.updateExpense).not.toHaveBeenCalled();
    expect(expensesApi.uploadReceipt).not.toHaveBeenCalled();
  });

  it('keeps the expense and still closes when only the receipt upload fails', async () => {
    expensesApi.uploadReceipt.mockRejectedValue(new Error('upload failed'));
    const { user, onSaved } = renderForm();

    await user.type(screen.getByLabelText(/^Amount/), '8');
    await user.selectOptions(screen.getByLabelText(/^Category/), 'cat-1');
    const receipt = new File(['x'], 'receipt.png', { type: 'image/png' });
    await user.upload(document.querySelector('input[type="file"]'), receipt);
    await save(user);

    await waitFor(() => expect(expensesApi.uploadReceipt).toHaveBeenCalledTimes(1));
    expect(expensesApi.createExpense).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('shows the server message in the form when the save is refused', async () => {
    expensesApi.createExpense.mockRejectedValue({
      response: { status: 400, data: { message: 'Account is archived' } },
    });
    const { user, onSaved } = renderForm();

    await user.type(screen.getByLabelText(/^Amount/), '8');
    await user.selectOptions(screen.getByLabelText(/^Category/), 'cat-1');
    await save(user);

    expect(await screen.findByText('Account is archived')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
