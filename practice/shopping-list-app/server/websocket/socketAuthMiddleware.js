const jwt = require('jsonwebtoken');

function createSocketAuthMiddleware() {
  return (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  };
}

module.exports = { createSocketAuthMiddleware };
