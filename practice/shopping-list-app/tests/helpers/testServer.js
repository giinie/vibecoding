const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const supertest = require('supertest');

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

  io.use((socket, next) => {
    const userId = socket.handshake.query.userId;
    if (!userId) {
      return next(new Error('Authentication required'));
    }
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    socket.join(`user:${userId}`);
    socket.on('disconnect', () => {});
  });

  // Middleware
  app.use(express.json());

  // Routes - require fresh after DB mock is in place
  const authRoutes = require('../../server/routes/auth');
  const notificationRoutes = require('../../server/routes/notifications');
  app.use('/api/auth', authRoutes);
  app.use('/api/notifications', notificationRoutes);

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
