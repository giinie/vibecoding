const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/connection');

const notificationModel = {
  create({ user_id, type, title, message, metadata }) {
    const db = getDatabase();
    const id = uuidv4();
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, user_id, type, title, message, metadataStr);

    return this.findById(id);
  },

  findByUserId(userId, { unreadOnly = false, limit = 20, offset = 0 } = {}) {
    const db = getDatabase();

    let whereClause = 'WHERE user_id = ?';
    const params = [userId];

    if (unreadOnly) {
      whereClause += ' AND is_read = 0';
    }

    const notifications = db.prepare(`
      SELECT * FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const counts = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count
      FROM notifications
      WHERE user_id = ?
    `).get(userId);

    const total = unreadOnly ? counts.unread_count : counts.total;
    const unreadCount = counts.unread_count;

    return {
      notifications: notifications.map(this._parseMetadata),
      total,
      unread_count: unreadCount,
    };
  },

  findById(id) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    return row ? this._parseMetadata(row) : null;
  },

  markAsRead(id) {
    const db = getDatabase();
    const result = db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ?'
    ).run(id);

    if (result.changes === 0) return null;
    return this.findById(id);
  },

  markAllAsRead(userId) {
    const db = getDatabase();
    const result = db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
    ).run(userId);

    return { updated_count: result.changes };
  },

  delete(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return result.changes > 0;
  },

  _parseMetadata(notification) {
    if (notification.metadata) {
      try {
        notification.metadata = JSON.parse(notification.metadata);
      } catch {
        // keep as string if parsing fails
      }
    }
    return notification;
  },
};

module.exports = notificationModel;
