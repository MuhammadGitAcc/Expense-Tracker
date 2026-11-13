import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createExpense,
  deleteExpense,
  fetchReceipt,
  listExpenses,
  removeReceipt,
  updateExpense,
  uploadReceipt,
} from '@/api/expenses.api';
import { invalidateMoneyData } from '@/app/invalidate';

// Every key starts with 'expenses' (see app/invalidate.js).
export const expenseKeys = {
  all: ['expenses'],
  list: (params) => ['expenses', 'list', params],
  receipt: (id) => ['expenses', 'receipt', id],
};

// Defined outside the hook so the result keeps the same identity between renders.
const selectExpenses = (body) => ({ expenses: body.data.expenses, meta: body.meta });

/**
 * One page of expenses for the given filters. data = { expenses, meta }.
 * The previous page stays on screen while the next one loads (isPlaceholderData is true then).
 */
export function useExpenses(params) {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: () => listExpenses(params),
    select: selectExpenses,
    placeholderData: keepPreviousData,
  });
}

/** The receipt file as a Blob. Not kept in the cache after the viewer closes. */
export function useReceipt(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: expenseKeys.receipt(id),
    queryFn: () => fetchReceipt(id),
    enabled,
    gcTime: 0,
    staleTime: 0,
  });
}

// Every change refreshes balances, budgets, dashboard, reports and notifications (see invalidate.js).
function useMoneyMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateMoneyData(queryClient) });
}

export const useCreateExpense = () => useMoneyMutation(createExpense);
/** mutate({ id, ...changedFields }) */
export const useUpdateExpense = () =>
  useMoneyMutation(({ id, ...payload }) => updateExpense(id, payload));
export const useDeleteExpense = () => useMoneyMutation(deleteExpense);
/** mutate({ id, file }) */
export const useUploadReceipt = () => useMoneyMutation(({ id, file }) => uploadReceipt(id, file));
export const useRemoveReceipt = () => useMoneyMutation(removeReceipt);
