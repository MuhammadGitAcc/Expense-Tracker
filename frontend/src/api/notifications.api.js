import { axiosClient } from '@/api/axiosClient';

// Every function returns response.data: the body { success, message, data, meta }.

/**
 * params: { page?, limit? (1-100), isRead?: 'true' | 'false', type? }.
 * Answers data { notifications: [{ id, type, title, message, isRead, createdAt }] } and
 * meta { total, page, limit, totalPages, hasNext, ..., unreadCount }. unreadCount ignores the
 * filters, so it always matches the bell.
 */
export const listNotifications = (params) =>
  axiosClient.get('/notifications', { params }).then((response) => response.data);

/** Answers data { unreadCount }. Made for the 60 second polling of the bell. */
export const getUnreadCount = () =>
  axiosClient.get('/notifications/unread-count').then((response) => response.data);

/** Idempotent. Answers data { notification }. */
export const markNotificationRead = (id) =>
  axiosClient.put(`/notifications/${id}/read`).then((response) => response.data);

/** Answers data { updated: n }. */
export const markAllNotificationsRead = () =>
  axiosClient.put('/notifications/read-all').then((response) => response.data);
