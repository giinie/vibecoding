const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const supertest = require('supertest');
const { createSocketAuthMiddleware } = require('../../server/websocket/socketAuthMiddleware');

function createTestServer() {
  const app = express();
  const server = http.createServer(app);

  // Initialize Socket.io for tests
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Wire up Socket.io so that the socketManager module returns our test IO
  const socketManager = require('../../server/websocket/socketManager');
  socketManager.getIO = () => io;

  io.use(createSocketAuthMiddleware());

  io.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);

    // Token expiration auto-disconnect (mirrors socketManager.js)
    if (socket.tokenExp) {
      const remainingMs = (socket.tokenExp * 1000) - Date.now();
      if (remainingMs > 0) {
        socket.expirationTimer = setTimeout(() => {
          socket.disconnect(true);
        }, remainingMs);
      }
    }

    socket.on('disconnect', () => {
      if (socket.expirationTimer) {
        clearTimeout(socket.expirationTimer);
      }
    });
  });

  // Middleware
  app.use(express.json());

  // Routes - require fresh after DB mock is in place
  const authRoutes = require('../../server/routes/auth');
  const notificationRoutes = require('../../server/routes/notifications');
  const shoppingItemRoutes = require('../../server/routes/shoppingItems');
  const recommendationRoutes = require('../../server/routes/recommendations');
  app.use('/api/auth', authRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/shopping-items', shoppingItemRoutes);
  app.use('/api/recommendations', recommendationRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  const agent = supertest(app);

  return { app, server, io, agent };
}

function startTestServer(server) {
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve(port);
    });
  });
}

function stopTestServer(server) {
  return new Promise((resolve) => {
    if (server && server.listening) {
      server.close(resolve);
    } else {
      resolve();
    }
  });
}

module.exports = { createTestServer, startTestServer, stopTestServer };
