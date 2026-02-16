import { io } from 'socket.io-client';
import { TOKEN_KEY } from './authApi';

const SOCKET_URL = 'http://localhost:3001';

let socket = null;

export function connect() {
  if (socket) {
    socket.disconnect();
  }

  const token = localStorage.getItem(TOKEN_KEY);

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    if (err.message.includes('token') || err.message.includes('Authentication')) {
      socket.disconnect();
    }
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
