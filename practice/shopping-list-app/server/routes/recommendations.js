const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { authenticate, authorizeUser } = require('../middleware/auth');
const { validateUuid } = require('../middleware/validateUuid');

// All routes require authentication
router.use(authenticate);

// Get recommendations for a user
router.get('/:userId', validateUuid('userId'), authorizeUser, recommendationController.getRecommendations);

module.exports = router;
