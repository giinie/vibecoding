const { Server } = require('socket.io');

let io = null;

function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const userId = socket.handshake.query.userId;
    if (!userId) {
      return next(new Error('Authentication required'));
    }
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    const room = `user:${userId}`;
    socket.join(room);
    console.log(`User ${userId} connected (socket: ${socket.id})`);

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
