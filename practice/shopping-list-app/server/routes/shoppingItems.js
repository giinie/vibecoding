const express = require('express');
const router = express.Router();
const shoppingItemController = require('../controllers/shoppingItemController');
const { authenticate, authorizeUser } = require('../middleware/auth');
const { validateUuid } = require('../middleware/validateUuid');

// All routes require authentication
router.use(authenticate);

// Create a new shopping item
router.post('/', shoppingItemController.create);

// Get shopping items for a user
router.get('/:userId', validateUuid('userId'), authorizeUser, shoppingItemController.getByUserId);

// Toggle purchased status
router.patch('/:id/toggle', validateUuid('id'), shoppingItemController.togglePurchased);

// Delete a shopping item
router.delete('/:id', validateUuid('id'), shoppingItemController.delete);

module.exports = router;
