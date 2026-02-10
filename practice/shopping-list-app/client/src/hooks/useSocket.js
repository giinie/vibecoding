import { useEffect, useCallback } from 'react';
import { useSocketContext } from '../context/SocketContext';

export default function useSocket() {
  const socket = useSocketContext();

  const onNewNotification = useCallback((callback) => {
    if (!socket) return () => {};

    socket.on('notification:new', callback);
    return () => socket.off('notification:new', callback);
  }, [socket]);

  const onNotificationRead = useCallback((callback) => {
    if (!socket) return () => {};

    socket.on('notification:read', callback);
    return () => socket.off('notification:read', callback);
  }, [socket]);

  const onAllNotificationsRead = useCallback((callback) => {
    if (!socket) return () => {};

    socket.on('notification:read-all', callback);
    return () => socket.off('notification:read-all', callback);
  }, [socket]);

  return {
    socket,
    connected: socket?.connected ?? false,
    onNewNotification,
    onNotificationRead,
    onAllNotificationsRead,
  };
}
