const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, authorizeUser } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Create a new notification
router.post('/', notificationController.create);

// Get notifications for a user
router.get('/:userId', authorizeUser, notificationController.getByUserId);

// Mark a single notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all notifications as read for a user
router.patch('/read-all/:userId', authorizeUser, notificationController.markAllAsRead);

// Delete a notification
router.delete('/:id', notificationController.delete);

module.exports = router;
