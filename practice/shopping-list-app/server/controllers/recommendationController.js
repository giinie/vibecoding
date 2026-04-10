const recommendationService = require('../services/recommendationService');

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

function handleServerError(res, errorMessage, err) {
  console.error(`${errorMessage}:`, err);
  return sendError(res, 500, errorMessage);
}

const recommendationController = {
  async getRecommendations(req, res) {
    try {
      const { userId } = req.params;

      if (req.query.refresh === 'true') {
        recommendationService.clearCache(userId);
      }

      const recommendations = await recommendationService.generateRecommendations(userId);

      return res.json({ recommendations });
    } catch (err) {
      return handleServerError(res, 'Failed to fetch recommendations', err);
    }
  },
};

module.exports = recommendationController;
