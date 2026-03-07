const { Server } = require('socket.io');
const { createSocketAuthMiddleware } = require('./socketAuthMiddleware');

let io = null;

function initializeSocket(httpServer, corsOrigin) {
  const resolvedOrigin = corsOrigin || process.env.CORS_ORIGIN;
  if (!resolvedOrigin) {
    console.warn('[SECURITY] CORS_ORIGIN is not set. Falling back to http://localhost:3000. Set CORS_ORIGIN in production.');
  }
  io = new Server(httpServer, {
    cors: {
      origin: resolvedOrigin || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.use(createSocketAuthMiddleware());

  io.on('connection', (socket) => {
    const userId = socket.userId;
    const room = `user:${userId}`;
    socket.join(room);
    if (process.env.NODE_ENV === 'development') {
      console.log(`User ${userId} connected (socket: ${socket.id})`);
    }

    socket.on('disconnect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Socket ${socket.id} disconnected`);
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initializeSocket first.');
  }
  return io;
}

module.exports = { initializeSocket, getIO };
