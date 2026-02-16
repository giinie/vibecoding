require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { migrate } = require('./db/migrate');
const { initializeSocket } = require('./websocket/socketManager');
const authRoutes = require('./routes/auth');
const notificationRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Socket.io
initializeSocket(server);

// Middleware
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Run migration on startup
migrate();

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app, server };
