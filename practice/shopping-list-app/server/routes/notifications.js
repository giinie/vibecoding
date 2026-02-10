const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Create a new notification
router.post('/', notificationController.create);

// Get notifications for a user
router.get('/:userId', notificationController.getByUserId);

// Mark a single notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all notifications as read for a user
router.patch('/read-all/:userId', notificationController.markAllAsRead);

// Delete a notification
router.delete('/:id', notificationController.delete);

module.exports = router;
