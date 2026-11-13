import { axiosClient } from '@/api/axiosClient';

// Every function returns response.data: the body { success, message, data, meta }.
// Recurring items are TEMPLATES: they move no money. The server job creates the transactions.

/**
 * params: { type: 'expense' | 'income', isActive: true | false } (both optional).
 * Answers { data: { recurringTransactions }, meta: { total } }, the next to run first.
 */
export const listRecurring = (params) =>
  axiosClient.get('/recurring', { params }).then((response) => response.data);

export const getRecurring = (id) =>
  axiosClient.get(`/recurring/${id}`).then((response) => response.data);

/**
 * payload: { type, amount, accountId, categoryId (same type as the template), frequency
 *            (daily|weekly|monthly|yearly), startDate?, endDate?, note? }.
 * Answers { data: { recurring } }.
 */
export const createRecurring = (payload) =>
  axiosClient.post('/recurring', payload).then((response) => response.data);

/**
 * payload: any of { amount, accountId, categoryId, endDate (null clears), note (null clears) }.
 * Type, frequency and start date cannot change (delete and recreate).
 */
export const updateRecurring = (id, payload) =>
  axiosClient.put(`/recurring/${id}`, payload).then((response) => response.data);

/** Both answer { data: { recurring } }. Resuming an ended schedule answers 400. */
export const pauseRecurring = (id) =>
  axiosClient.post(`/recurring/${id}/pause`).then((response) => response.data);

export const resumeRecurring = (id) =>
  axiosClient.post(`/recurring/${id}/resume`).then((response) => response.data);

export const deleteRecurring = (id) =>
  axiosClient.delete(`/recurring/${id}`).then((response) => response.data);
