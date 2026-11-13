import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createIncome, deleteIncome, listIncomes, updateIncome } from '@/api/income.api';
import { invalidateMoneyData } from '@/app/invalidate';

// Every key starts with 'incomes' (see app/invalidate.js).
export const incomeKeys = {
  all: ['incomes'],
  list: (params) => ['incomes', 'list', params],
};

// Defined outside the hook so the result keeps the same identity between renders.
const selectIncomes = (body) => ({ incomes: body.data.incomes, meta: body.meta });

/**
 * One page of income records for the given filters. data = { incomes, meta }.
 * The previous page stays on screen while the next one loads (isPlaceholderData is true then).
 */
export function useIncomes(params) {
  return useQuery({
    queryKey: incomeKeys.list(params),
    queryFn: () => listIncomes(params),
    select: selectIncomes,
    placeholderData: keepPreviousData,
  });
}

// Every change moves a balance, so balances, dashboard, reports and the rest are refreshed too.
function useMoneyMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateMoneyData(queryClient) });
}

export const useCreateIncome = () => useMoneyMutation(createIncome);
/** mutate({ id, ...changedFields }) */
export const useUpdateIncome = () =>
  useMoneyMutation(({ id, ...payload }) => updateIncome(id, payload));
export const useDeleteIncome = () => useMoneyMutation(deleteIncome);
