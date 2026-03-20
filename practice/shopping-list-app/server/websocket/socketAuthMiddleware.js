const jwt = require('jsonwebtoken');

const SOCKET_AUTH_ERRORS = {
  MISSING_TOKEN: 'MISSING_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
};

function createSocketAuthMiddleware() {
  return (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      const err = new Error('Authentication required');
      err.data = { code: 401, type: SOCKET_AUTH_ERRORS.MISSING_TOKEN };
      return next(err);
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      socket.userId = decoded.userId;
      socket.tokenExp = decoded.exp;
      next();
    } catch (err) {
      const error = new Error('Invalid or expired token');
      error.data = {
        code: 401,
        type: err.name === 'TokenExpiredError'
          ? SOCKET_AUTH_ERRORS.TOKEN_EXPIRED
          : SOCKET_AUTH_ERRORS.INVALID_TOKEN,
      };
      return next(error);
    }
  };
}

module.exports = { createSocketAuthMiddleware, SOCKET_AUTH_ERRORS };
