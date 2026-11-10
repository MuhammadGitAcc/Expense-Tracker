'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const notificationService = require('../services/notification.service');

const list = asyncHandler(async (req, res) => {
  const { notifications, meta } = await notificationService.list(req.user.id, req.validatedQuery);
  return ApiResponse.paginated(res, { data: { notifications }, meta });
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id);
  return ApiResponse.success(res, { data: { unreadCount: count } });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.user.id, req.params.id);
  return ApiResponse.success(res, {
    message: 'Notification marked as read',
    data: { notification },
  });
});

const markAllRead = asyncHandler(async (req, res) => {
  const updated = await notificationService.markAllRead(req.user.id);
  return ApiResponse.success(res, {
    message: 'All notifications marked as read',
    data: { updated },
  });
});

module.exports = { list, unreadCount, markRead, markAllRead };
