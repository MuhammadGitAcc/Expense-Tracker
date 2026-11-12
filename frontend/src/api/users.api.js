import { axiosClient } from '@/api/axiosClient';

export const getMe = () => axiosClient.get('/users/me').then((response) => response.data);

export const updateMe = (payload) =>
  axiosClient.put('/users/me', payload).then((response) => response.data);

export const changePassword = ({ currentPassword, newPassword }) =>
  axiosClient
    .put('/users/me/password', { currentPassword, newPassword })
    .then((response) => response.data);

export const uploadAvatar = (file) => {
  const body = new FormData();
  body.append('avatar', file);
  return axiosClient.post('/users/me/avatar', body).then((response) => response.data);
};

export const deleteAccount = ({ password }) =>
  axiosClient.delete('/users/me', { data: { password } }).then((response) => response.data);
