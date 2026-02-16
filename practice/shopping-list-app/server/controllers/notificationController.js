const notificationModel = require('../models/notificationModel');
const {
  emitNewNotification,
  emitNotificationRead,
  emitAllNotificationsRead,
} = require('../websocket/notificationEmitter');

const notificationController = {
  create(req, res) {
    try {
      const { user_id, type, title, message, metadata } = req.body;

      if (!user_id || !type || !title || !message) {
        return res.status(400).json({
          error: 'Missing required fields: user_id, type, title, message',
        });
      }

      if (user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden: cannot create notifications for another user' });
      }

      const notification = notificationModel.create({
        user_id,
        type,
        title,
        message,
        metadata,
      });

      emitNewNotification(user_id, notification);

      return res.status(201).json(notification);
    } catch (err) {
      if (err.message.includes('CHECK constraint failed')) {
        return res.status(400).json({
          error: 'Invalid notification type. Must be one of: item_added, item_purchased, list_shared, reminder',
        });
      }
      if (err.message.includes('FOREIGN KEY constraint failed')) {
        return res.status(400).json({ error: 'Invalid user_id' });
      }
      return res.status(500).json({ error: 'Failed to create notification' });
    }
  },

  getByUserId(req, res) {
    try {
      const { userId } = req.params;
      const unreadOnly = req.query.unread_only === 'true';
      const limit = parseInt(req.query.limit, 10) || 20;
      const offset = parseInt(req.query.offset, 10) || 0;

      const result = notificationModel.findByUserId(userId, {
        unreadOnly,
        limit,
        offset,
      });

      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  },

  markAsRead(req, res) {
    try {
      const { id } = req.params;
      const existing = notificationModel.findById(id);

      if (!existing) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      if (existing.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden: notification does not belong to user' });
      }

      const notification = notificationModel.markAsRead(id);
      emitNotificationRead(notification.user_id, id);

      return res.json(notification);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  },

  markAllAsRead(req, res) {
    try {
      const { userId } = req.params;
      const result = notificationModel.markAllAsRead(userId);

      emitAllNotificationsRead(userId);

      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  },

  delete(req, res) {
    try {
      const { id } = req.params;
      const existing = notificationModel.findById(id);

      if (!existing) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      if (existing.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden: notification does not belong to user' });
      }

      notificationModel.delete(id);

      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete notification' });
    }
  },
};

module.exports = notificationController;
