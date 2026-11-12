import { axiosClient } from '@/api/axiosClient';

// Every function returns response.data: the body { success, message, data, meta }.

/** params: { type?: 'income' | 'expense' }. Answers { data: { categories } }. */
export const listCategories = (params) =>
  axiosClient.get('/categories', { params }).then((response) => response.data);

export const getCategory = (id) =>
  axiosClient.get(`/categories/${id}`).then((response) => response.data);

/** payload: { name, type, icon?, color? } */
export const createCategory = (payload) =>
  axiosClient.post('/categories', payload).then((response) => response.data);

/** payload: { name?, icon?, color? }. The type cannot be changed. */
export const updateCategory = (id, payload) =>
  axiosClient.put(`/categories/${id}`, payload).then((response) => response.data);

export const deleteCategory = (id) =>
  axiosClient.delete(`/categories/${id}`).then((response) => response.data);
