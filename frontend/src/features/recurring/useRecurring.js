import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRecurring,
  deleteRecurring,
  listRecurring,
  pauseRecurring,
  resumeRecurring,
  updateRecurring,
} from '@/api/recurring.api';

// Every key starts with 'recurring'. Templates move no money, so only this root is refreshed.
export const recurringKeys = {
  all: ['recurring'],
  list: (params) => ['recurring', 'list', params],
};

// Defined outside the hook so the result keeps the same identity between renders.
const selectRecurring = (body) => ({ items: body.data.recurringTransactions, meta: body.meta });

/** Recurring templates for the filters { type?, isActive? }. data = { items, meta }. */
export function useRecurringList(params) {
  return useQuery({
    queryKey: recurringKeys.list(params),
    queryFn: () => listRecurring(params),
    select: selectRecurring,
    placeholderData: keepPreviousData,
  });
}

function useRecurringMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recurringKeys.all }),
  });
}

export const useCreateRecurring = () => useRecurringMutation(createRecurring);
/** mutate({ id, ...changedFields }) */
export const useUpdateRecurring = () =>
  useRecurringMutation(({ id, ...payload }) => updateRecurring(id, payload));
export const usePauseRecurring = () => useRecurringMutation(pauseRecurring);
export const useResumeRecurring = () => useRecurringMutation(resumeRecurring);
export const useDeleteRecurring = () => useRecurringMutation(deleteRecurring);
