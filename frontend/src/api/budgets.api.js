import { axiosClient } from '@/api/axiosClient';

// Every function returns response.data: the body { success, message, data, meta }.

/**
 * params: { month (1-12), year } (each falls back to the current one on the server).
 * Answers { data: { budgets }, meta: { month, year, total } }. The overall budget comes first,
 * then the categories by name. Every budget has spent, remaining, percentUsed and status
 * (ok | warning | exceeded), all calculated by the database.
 */
export const listBudgets = (params) =>
  axiosClient.get('/budgets', { params }).then((response) => response.data);

export const getBudget = (id) =>
  axiosClient.get(`/budgets/${id}`).then((response) => response.data);

/**
 * payload: { categoryId (an expense category, null or left out = overall budget), amount,
 *            month, year, alertThreshold? (1-100, default 80) }.
 * A second budget for the same category and month answers 409.
 */
export const createBudget = (payload) =>
  axiosClient.post('/budgets', payload).then((response) => response.data);

/** payload: { amount?, alertThreshold? }. Month, year and category cannot change. */
export const updateBudget = (id, payload) =>
  axiosClient.put(`/budgets/${id}`, payload).then((response) => response.data);

export const deleteBudget = (id) =>
  axiosClient.delete(`/budgets/${id}`).then((response) => response.data);
