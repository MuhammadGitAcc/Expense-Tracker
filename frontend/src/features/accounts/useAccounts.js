import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveAccount,
  createAccount,
  createTransfer,
  deleteAccount,
  listAccounts,
  listTransfers,
  unarchiveAccount,
  updateAccount,
} from '@/api/accounts.api';

// Every key starts with 'accounts', so invalidating accountKeys.all refreshes the lists AND
// the transfer history. The expense, income and recurring screens must invalidate it too,
// because their changes move balances.
export const accountKeys = {
  all: ['accounts'],
  list: (includeArchived) => ['accounts', 'list', { includeArchived }],
  transfers: (page, limit) => ['accounts', 'transfers', { page, limit }],
};

// Defined outside the hooks so the result keeps the same identity between renders.
const selectAccounts = (body) => ({
  accounts: body.data.accounts,
  totalsByCurrency: body.meta?.totalsByCurrency ?? {},
});

const selectTransfers = (body) => ({
  transfers: body.data.transfers,
  meta: body.meta,
});

/**
 * The user's accounts. Returns the usual TanStack Query object;
 * data = { accounts, totalsByCurrency } (totals are exact strings per currency).
 * Archived accounts are left out unless includeArchived is true.
 * The expense, income and recurring forms use useAccounts() and read data?.accounts.
 */
export function useAccounts({ includeArchived = false, enabled = true } = {}) {
  return useQuery({
    queryKey: accountKeys.list(includeArchived),
    queryFn: () => listAccounts(includeArchived ? { includeArchived: true } : undefined),
    select: selectAccounts,
    enabled,
  });
}

/** One page of the transfer history. data = { transfers, meta }. */
export function useAccountTransfers({ page = 1, limit = 20, enabled = true } = {}) {
  return useQuery({
    queryKey: accountKeys.transfers(page, limit),
    queryFn: () => listTransfers({ page, limit }),
    select: selectTransfers,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateAccount(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

/** mutate({ id, archive: true | false }) */
export function useArchiveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archive }) => (archive ? archiveAccount(id) : unarchiveAccount(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTransfer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
