import { axiosClient } from '@/api/axiosClient';

// Every function returns response.data: the body { success, message, data, meta }.
// The backend route is /incomes (plural).

/**
 * params: { page, limit, search, from, to, categoryId, accountId, minAmount, maxAmount,
 *           sortBy: date|amount|createdAt, sortOrder: asc|desc }.
 * search looks in the source, the note and the category name.
 * Answers { data: { incomes }, meta: { total, page, limit, totalPages, hasNext, hasPrev, totalAmount } }.
 * meta.totalAmount is the exact sum of the WHOLE filtered set, added up across currencies
 * (nothing is converted), so it only means something when one currency is involved.
 */
export const listIncomes = (params) =>
  axiosClient.get('/incomes', { params }).then((response) => response.data);

export const getIncome = (id) =>
  axiosClient.get(`/incomes/${id}`).then((response) => response.data);

/**
 * payload: { accountId, categoryId, amount, date?, source?, note? }.
 * Answers { data: { income, accounts } } (accounts = the new balances).
 */
export const createIncome = (payload) =>
  axiosClient.post('/incomes', payload).then((response) => response.data);

/** payload: any of the create fields (partial). source and note: null clears them. */
export const updateIncome = (id, payload) =>
  axiosClient.put(`/incomes/${id}`, payload).then((response) => response.data);

export const deleteIncome = (id) =>
  axiosClient.delete(`/incomes/${id}`).then((response) => response.data);
