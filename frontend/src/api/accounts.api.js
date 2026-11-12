import { axiosClient } from '@/api/axiosClient';

// Every function returns response.data: the body { success, message, data, meta }.

/**
 * params: { includeArchived?: true }.
 * Answers { data: { accounts }, meta: { total, totalsByCurrency: { USD: "150.50" } } }.
 */
export const listAccounts = (params) =>
  axiosClient.get('/accounts', { params }).then((response) => response.data);

export const getAccount = (id) =>
  axiosClient.get(`/accounts/${id}`).then((response) => response.data);

/** payload: { name, type?, balance?, currency?, color? }. Answers { data: { account } }. */
export const createAccount = (payload) =>
  axiosClient.post('/accounts', payload).then((response) => response.data);

/** payload: { name?, type?, color? }. Balance and currency can never be changed here. */
export const updateAccount = (id, payload) =>
  axiosClient.put(`/accounts/${id}`, payload).then((response) => response.data);

export const archiveAccount = (id) =>
  axiosClient.post(`/accounts/${id}/archive`).then((response) => response.data);

export const unarchiveAccount = (id) =>
  axiosClient.post(`/accounts/${id}/unarchive`).then((response) => response.data);

/** Answers 409 when the account still has transactions, recurring items or transfers. */
export const deleteAccount = (id) =>
  axiosClient.delete(`/accounts/${id}`).then((response) => response.data);

/**
 * payload: { fromAccountId, toAccountId, amount, date?, note? }. Same currency only.
 * Answers { data: { transfer, accounts: { from, to } } }.
 */
export const createTransfer = (payload) =>
  axiosClient.post('/accounts/transfers', payload).then((response) => response.data);

/** params: { page?, limit? }. Answers { data: { transfers }, meta: pagination fields }. */
export const listTransfers = (params) =>
  axiosClient.get('/accounts/transfers', { params }).then((response) => response.data);
