const { getIO } = require('./socketManager');

function emitNewNotification(userId, notification) {
  const io = getIO();
  io.to(`user:${userId}`).emit('notification:new', notification);
}

function emitNotificationRead(userId, notificationId) {
  const io = getIO();
  io.to(`user:${userId}`).emit('notification:read', { id: notificationId });
}

function emitAllNotificationsRead(userId) {
  const io = getIO();
  io.to(`user:${userId}`).emit('notification:read-all');
}

module.exports = {
  emitNewNotification,
  emitNotificationRead,
  emitAllNotificationsRead,
};
