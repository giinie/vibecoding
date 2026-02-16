import { useState, useEffect, useCallback } from 'react';
import useSocket from './useSocket';
import * as api from '../services/notificationApi';

const ITEMS_PER_PAGE = 5;

export default function useNotifications(userId = 'user-1') {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const { onNewNotification, onNotificationRead, onAllNotificationsRead } = useSocket();

  const loadNotifications = useCallback(async (pageNum = 1, append = false) => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.fetchNotifications(userId, {
        offset: (pageNum - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      });

      setNotifications(prev =>
        append ? [...prev, ...data.notifications] : data.notifications
      );
      setUnreadCount(data.unread_count);
      setHasMore(pageNum * ITEMS_PER_PAGE < data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadNotifications(nextPage, true);
  }, [page, loadNotifications]);

  const markAsRead = useCallback(async (id) => {
    try {
      await api.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => {
          if (n.id === id && !n.isRead) {
            setUnreadCount(c => Math.max(0, c - 1));
            return { ...n, isRead: true };
          }
          return n;
        })
      );
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllAsRead(userId);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err.message);
    }
  }, [userId]);

  const removeNotification = useCallback(async (id) => {
    try {
      await api.deleteNotification(id);
      setNotifications(prev => {
        const target = prev.find(n => n.id === id);
        if (target && !target.isRead) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.filter(n => n.id !== id);
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const addNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev]);
  }, []);

  // Initial load
  useEffect(() => {
    loadNotifications(1);
  }, [loadNotifications]);

  // Real-time WebSocket event listeners
  useEffect(() => {
    const unsubNew = onNewNotification((notification) => {
      addNotification(api.transformNotification(notification));
      setUnreadCount(prev => prev + 1);
    });

    const unsubRead = onNotificationRead(({ id }) => {
      setNotifications(prev =>
        prev.map(n => {
          if (n.id === id && !n.isRead) {
            setUnreadCount(c => Math.max(0, c - 1));
            return { ...n, isRead: true };
          }
          return n;
        })
      );
    });

    const unsubReadAll = onAllNotificationsRead(() => {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });

    return () => {
      unsubNew();
      unsubRead();
      unsubReadAll();
    };
  }, [onNewNotification, onNotificationRead, onAllNotificationsRead, addNotification]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    removeNotification,
    addNotification,
    refresh: () => {
      setPage(1);
      loadNotifications(1);
    },
  };
}
