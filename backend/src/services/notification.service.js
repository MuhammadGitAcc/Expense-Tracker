'use strict';

const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const notificationRepository = require('../repositories/notification.repository');

/** One page of notifications plus the pagination block and the unread count for the bell. */
async function list(userId, query = {}) {
  const { page, limit, offset } = getPagination(query);
  const [{ items, total }, unreadCount] = await Promise.all([
    notificationRepository.list(
      userId,
      { isRead: query.isRead, type: query.type },
      { limit, offset },
    ),
    notificationRepository.countUnread(userId),
  ]);
  return { notifications: items, meta: { ...buildMeta({ total, page, limit }), unreadCount } };
}

async function getUnreadCount(userId) {
  return notificationRepository.countUnread(userId);
}

/** Mark one notification as read. Another user's notification answers 404. */
async function markRead(userId, id) {
  const notification = await notificationRepository.markRead(id, userId);
  if (!notification) throw ApiError.notFound('Notification not found');
  return notification;
}

/** Mark all as read. Resolves how many were changed. */
async function markAllRead(userId) {
  return notificationRepository.markAllRead(userId);
}

/**
 * Create a notification for a user. Used by the jobs (5.2 recurring, 5.3 budget alerts,
 * 5.4 weekly summary), not by an endpoint.
 */
async function notify(userId, { type, title, message }, client) {
  return notificationRepository.create({ userId, type, title, message }, client);
}

module.exports = { list, getUnreadCount, markRead, markAllRead, notify };
