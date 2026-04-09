require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { migrate } = require('./db/migrate');
const { initializeSocket } = require('./websocket/socketManager');
const { closeDatabase } = require('./db/connection');
const authRoutes = require('./routes/auth');
const notificationRoutes = require('./routes/notifications');
const shoppingItemRoutes = require('./routes/shoppingItems');
const recommendationRoutes = require('./routes/recommendations');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Initialize Socket.io
initializeSocket(server, CORS_ORIGIN);

// Trust proxy for rate limiter behind reverse proxy
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

// Security middleware
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '10kb' }));

// Rate limiters
const rateLimitDefaults = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
};

const authLimiter = rateLimit({ ...rateLimitDefaults, max: 20 });
const apiLimiter = rateLimit({ ...rateLimitDefaults, max: 100 });

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/notifications', apiLimiter, notificationRoutes);
app.use('/api/shopping-items', apiLimiter, shoppingItemRoutes);
app.use('/api/recommendations', apiLimiter, recommendationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error',
  });
});

// Run migration on startup
migrate();

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

module.exports = { app, server };
