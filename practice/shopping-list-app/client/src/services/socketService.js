import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

let socket = null;

export function connect(userId) {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    query: { userId },
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
