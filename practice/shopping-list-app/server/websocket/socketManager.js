const { Server } = require('socket.io');
const { createSocketAuthMiddleware } = require('./socketAuthMiddleware');

let io = null;

function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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
      console.log(`Socket ${socket.id} disconnected`);
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
