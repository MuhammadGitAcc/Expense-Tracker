import { axiosClient } from '@/api/axiosClient';

// Every function returns response.data: the body { success, message, data, meta }.

export const register = (payload) =>
  axiosClient.post('/auth/register', payload).then((response) => response.data);

export const verifyEmail = ({ email, code }) =>
  axiosClient.post('/auth/verify-email', { email, code }).then((response) => response.data);

export const resendVerification = ({ email }) =>
  axiosClient.post('/auth/resend-verification', { email }).then((response) => response.data);

export const login = ({ email, password }) =>
  axiosClient.post('/auth/login', { email, password }).then((response) => response.data);

export const logout = () => axiosClient.post('/auth/logout').then((response) => response.data);

export const forgotPassword = ({ email }) =>
  axiosClient.post('/auth/forgot-password', { email }).then((response) => response.data);

export const resetPassword = ({ token, password }) =>
  axiosClient.post('/auth/reset-password', { token, password }).then((response) => response.data);
