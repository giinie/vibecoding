import { io } from 'socket.io-client';
import { getToken, refreshAccessToken, isTokenExpired } from './authApi';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

let socket = null;

export function connect(onAuthFailure) {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: async (cb) => {
      let token = getToken();
      if (isTokenExpired(token)) {
        token = await refreshAccessToken();
      }
      cb({ token: token || '' });
    },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Socket connected:', socket.id);
    }
  });

  socket.on('disconnect', (reason) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Socket disconnected:', reason);
    }
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    const errorType = err?.data?.type;
    if (errorType === 'MISSING_TOKEN' || errorType === 'INVALID_TOKEN') {
      socket.disconnect();
      onAuthFailure?.();
    }
    // TOKEN_EXPIRED: let Socket.io auto-reconnect (auth function will refresh)
  });

  return socket;
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
