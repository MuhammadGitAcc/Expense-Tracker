import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBudget, deleteBudget, listBudgets, updateBudget } from '@/api/budgets.api';
import { invalidateMoneyData } from '@/app/invalidate';

// Every key starts with 'budgets' (see app/invalidate.js).
export const budgetKeys = {
  all: ['budgets'],
  list: (month, year) => ['budgets', 'list', year, month],
};

// Defined outside the hook so the result keeps the same identity between renders.
const selectBudgets = (body) => ({ budgets: body.data.budgets, meta: body.meta });

/** Budgets of one month. data = { budgets, meta }. The previous month stays while the next loads. */
export function useBudgets({ month, year }) {
  return useQuery({
    queryKey: budgetKeys.list(month, year),
    queryFn: () => listBudgets({ month, year }),
    select: selectBudgets,
    placeholderData: keepPreviousData,
  });
}

// A budget change can create a budget alert on the server, so notifications are refreshed too.
function useBudgetMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateMoneyData(queryClient) });
}

export const useCreateBudget = () => useBudgetMutation(createBudget);
/** mutate({ id, amount?, alertThreshold? }) */
export const useUpdateBudget = () =>
  useBudgetMutation(({ id, ...payload }) => updateBudget(id, payload));
export const useDeleteBudget = () => useBudgetMutation(deleteBudget);
