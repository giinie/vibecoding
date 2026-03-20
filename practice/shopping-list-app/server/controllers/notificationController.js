const notificationModel = require('../models/notificationModel');
const {
  emitNewNotification,
  emitNotificationRead,
  emitAllNotificationsRead,
} = require('../websocket/notificationEmitter');

const { UUID_REGEX } = require('../middleware/validateUuid');
const VALID_TYPES = ['item_added', 'item_purchased', 'list_shared', 'reminder'];
const INVALID_TYPE_ERROR = `Invalid notification type. Must be one of: ${VALID_TYPES.join(', ')}`;
const REQUIRED_CREATE_FIELDS_ERROR = 'Missing required fields: user_id, type, title, message';
const NOTIFICATION_NOT_FOUND_ERROR = 'Notification not found';
const FORBIDDEN_NOTIFICATION_ERROR = 'Forbidden: notification does not belong to user';
const FORBIDDEN_CREATE_ERROR = 'Forbidden: cannot create notifications for another user';

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

function parsePagination(query) {
  const rawLimit = parseInt(query.limit, 10);
  const rawOffset = parseInt(query.offset, 10);

  return {
    unreadOnly: query.unread_only === 'true',
    limit: (!rawLimit || rawLimit < 1) ? 20 : Math.min(rawLimit, 100),
    offset: (!rawOffset || rawOffset < 0) ? 0 : rawOffset,
  };
}

function validateCreatePayload(body) {
  const { user_id, type, title, message, metadata } = body;

  if (!user_id || !type || !title || !message) {
    return REQUIRED_CREATE_FIELDS_ERROR;
  }

  if (!UUID_REGEX.test(user_id)) {
    return 'Invalid user_id format';
  }

  if (!VALID_TYPES.includes(type)) {
    return INVALID_TYPE_ERROR;
  }

  if (typeof title !== 'string' || title.length > 255) {
    return 'Title must be 255 characters or less';
  }

  if (typeof message !== 'string' || message.length > 2000) {
    return 'Message must be 2000 characters or less';
  }

  if (metadata && JSON.stringify(metadata).length > 10240) {
    return 'Metadata must be 10KB or less';
  }

  return null;
}

function ensureUserMatch(res, expectedUserId, actualUserId, errorMessage) {
  if (expectedUserId !== actualUserId) {
    sendError(res, 403, errorMessage);
    return false;
  }

  return true;
}

function findOwnedNotification(res, id, userId) {
  const notification = notificationModel.findById(id);

  if (!notification) {
    sendError(res, 404, NOTIFICATION_NOT_FOUND_ERROR);
    return null;
  }

  if (!ensureUserMatch(res, notification.user_id, userId, FORBIDDEN_NOTIFICATION_ERROR)) {
    return null;
  }

  return notification;
}

function handleCreateError(res, err) {
  if (err.message.includes('CHECK constraint failed')) {
    return sendError(res, 400, INVALID_TYPE_ERROR);
  }

  if (err.message.includes('FOREIGN KEY constraint failed')) {
    return sendError(res, 400, 'Invalid user_id');
  }

  return sendError(res, 500, 'Failed to create notification');
}

function handleServerError(res, errorMessage) {
  return sendError(res, 500, errorMessage);
}

const notificationController = {
  create(req, res) {
    try {
      const { user_id, type, title, message, metadata } = req.body;
      const validationError = validateCreatePayload(req.body);

      if (validationError) {
        return sendError(res, 400, validationError);
      }

      if (!ensureUserMatch(res, user_id, req.userId, FORBIDDEN_CREATE_ERROR)) {
        return;
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
      return handleCreateError(res, err);
    }
  },

  getByUserId(req, res) {
    try {
      const { userId } = req.params;
      const { unreadOnly, limit, offset } = parsePagination(req.query);

      const result = notificationModel.findByUserId(userId, {
        unreadOnly,
        limit,
        offset,
      });

      return res.json(result);
    } catch (err) {
      return handleServerError(res, 'Failed to fetch notifications');
    }
  },

  markAsRead(req, res) {
    try {
      const { id } = req.params;
      const existing = findOwnedNotification(res, id, req.userId);

      if (!existing) {
        return;
      }

      const notification = notificationModel.markAsRead(id);
      if (!notification) {
        return sendError(res, 404, NOTIFICATION_NOT_FOUND_ERROR);
      }
      emitNotificationRead(notification.user_id, id);

      return res.json(notification);
    } catch (err) {
      return handleServerError(res, 'Failed to mark notification as read');
    }
  },

  markAllAsRead(req, res) {
    try {
      const { userId } = req.params;
      const result = notificationModel.markAllAsRead(userId);

      emitAllNotificationsRead(userId);

      return res.json(result);
    } catch (err) {
      return handleServerError(res, 'Failed to mark all notifications as read');
    }
  },

  delete(req, res) {
    try {
      const { id } = req.params;
      const existing = findOwnedNotification(res, id, req.userId);

      if (!existing) {
        return;
      }

      const deleted = notificationModel.delete(id);
      if (!deleted) {
        return sendError(res, 404, NOTIFICATION_NOT_FOUND_ERROR);
      }

      return res.status(204).send();
    } catch (err) {
      return handleServerError(res, 'Failed to delete notification');
    }
  },
};

module.exports = notificationController;
