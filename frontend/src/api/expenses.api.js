import { axiosClient } from '@/api/axiosClient';

// Every function returns response.data: the body { success, message, data, meta }.

/**
 * params: { page, limit, search, from, to, categoryId, accountId, minAmount, maxAmount, tag,
 *           paymentMethod, sortBy: date|amount|createdAt, sortOrder: asc|desc }.
 * Answers { data: { expenses }, meta: { total, page, limit, totalPages, hasNext, hasPrev, totalAmount } }.
 * meta.totalAmount is the exact sum of the WHOLE filtered set, added up across currencies
 * (nothing is converted), so it only means something when one currency is involved.
 */
export const listExpenses = (params) =>
  axiosClient.get('/expenses', { params }).then((response) => response.data);

export const getExpense = (id) =>
  axiosClient.get(`/expenses/${id}`).then((response) => response.data);

/**
 * payload: { accountId, categoryId, amount, date?, note?, paymentMethod?, tags? }.
 * Answers { data: { expense, accounts } } (accounts = the new balances).
 */
export const createExpense = (payload) =>
  axiosClient.post('/expenses', payload).then((response) => response.data);

/** payload: any of the create fields (partial). note: null clears it. */
export const updateExpense = (id, payload) =>
  axiosClient.put(`/expenses/${id}`, payload).then((response) => response.data);

export const deleteExpense = (id) =>
  axiosClient.delete(`/expenses/${id}`).then((response) => response.data);

/** Attach or replace the receipt (multipart field "receipt": JPEG, PNG, WebP or PDF). */
export const uploadReceipt = (id, file) => {
  const body = new FormData();
  body.append('receipt', file);
  return axiosClient.post(`/expenses/${id}/receipt`, body).then((response) => response.data);
};

export const removeReceipt = (id) =>
  axiosClient.delete(`/expenses/${id}/receipt`).then((response) => response.data);

/**
 * Receipts are PRIVATE: a plain <img src> would carry no Authorization header. This loads the
 * file through the API client and answers a Blob (show it from an object URL).
 */
export const fetchReceipt = (id) =>
  axiosClient
    .get(`/expenses/${id}/receipt`, { responseType: 'blob' })
    .then((response) => response.data);
