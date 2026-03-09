const { getIO } = require('./socketManager');

function emitNewShoppingItem(userId, item) {
  const io = getIO();
  io.to(`user:${userId}`).emit('shoppingItem:new', item);
}

function emitShoppingItemToggled(userId, item) {
  const io = getIO();
  io.to(`user:${userId}`).emit('shoppingItem:toggled', item);
}

function emitShoppingItemDeleted(userId, itemId) {
  const io = getIO();
  io.to(`user:${userId}`).emit('shoppingItem:deleted', { id: itemId });
}

module.exports = {
  emitNewShoppingItem,
  emitShoppingItemToggled,
  emitShoppingItemDeleted,
};
