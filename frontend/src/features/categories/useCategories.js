import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '@/api/categories.api';

export const categoryKeys = {
  all: ['categories'],
};

/**
 * All categories of the user (the defaults plus the custom ones), cached once.
 * Pass { type } to get only 'expense' or 'income' (filtered in the browser, no new request).
 * Returns the usual TanStack Query object; `data` is the array of categories.
 * The expense and income forms of later steps use the same hook.
 */
export function useCategories({ type } = {}) {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: () => listCategories(),
    select: (body) => {
      const categories = body.data.categories;
      return type ? categories.filter((category) => category.type === type) : categories;
    },
    // Categories rarely change: keep them fresh for 5 minutes.
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateCategory(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}
