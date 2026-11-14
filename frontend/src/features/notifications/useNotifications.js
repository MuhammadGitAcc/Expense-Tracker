import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications.api';

// Every key starts with 'notifications', so invalidateMoneyData (app/invalidate.js) refreshes the
// bell and the list after an expense or a budget change (a budget alert may have been created).
export const notificationKeys = {
  all: ['notifications'],
  list: (params) => ['notifications', 'list', params],
  unreadCount: ['notifications', 'unread-count'],
};

export const UNREAD_POLL_MS = 60_000;

// Defined outside the hooks so the results keep the same identity between renders.
const selectNotifications = (body) => ({ notifications: body.data.notifications, meta: body.meta });
const selectUnreadCount = (body) => body.data.unreadCount;

/** One page of notifications. data = { notifications, meta }. The previous page stays while the next loads. */
export function useNotifications(params) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => listNotifications(params),
    select: selectNotifications,
    placeholderData: keepPreviousData,
  });
}

/** The number on the bell. Asks the server every 60 seconds while the tab is visible. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: getUnreadCount,
    select: selectUnreadCount,
    refetchInterval: UNREAD_POLL_MS,
  });
}

// Marking as read moves no money, so only the notifications root is refreshed (list + bell).
function useNotificationMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/** mutate(id) */
export const useMarkRead = () => useNotificationMutation(markNotificationRead);
/** mutate() answers body.data.updated */
export const useMarkAllRead = () => useNotificationMutation(markAllNotificationsRead);
