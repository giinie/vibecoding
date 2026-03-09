const shoppingItemModel = require('../models/shoppingItemModel');
const {
  emitNewShoppingItem,
  emitShoppingItemToggled,
  emitShoppingItemDeleted,
} = require('../websocket/shoppingItemEmitter');

const shoppingItemController = {
  create(req, res) {
    try {
      const { name, quantity, unit } = req.body;
      const user_id = req.userId;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (name.length > 200) {
        return res.status(400).json({ error: 'Name must be 200 characters or less' });
      }

      if (quantity !== undefined) {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
          return res.status(400).json({ error: 'Quantity must be a positive integer (max 10000)' });
        }
      }

      if (unit !== undefined && unit !== null) {
        if (typeof unit !== 'string' || unit.length > 20) {
          return res.status(400).json({ error: 'Unit must be 20 characters or less' });
        }
      }

      const item = shoppingItemModel.create({
        user_id,
        name: name.trim(),
        quantity: quantity ?? 1,
        unit: unit ?? null,
      });

      emitNewShoppingItem(user_id, item);

      return res.status(201).json(item);
    } catch (err) {
      if (err.message.includes('FOREIGN KEY constraint failed')) {
        return res.status(400).json({ error: 'Invalid user_id' });
      }
      return res.status(500).json({ error: 'Failed to create shopping item' });
    }
  },

  getByUserId(req, res) {
    try {
      const { userId } = req.params;
      const rawLimit = parseInt(req.query.limit, 10);
      const limit = (!rawLimit || rawLimit < 1) ? 20 : Math.min(rawLimit, 100);
      const rawOffset = parseInt(req.query.offset, 10);
      const offset = (!rawOffset || rawOffset < 0) ? 0 : rawOffset;

      const result = shoppingItemModel.findByUserId(userId, { limit, offset });

      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch shopping items' });
    }
  },

  togglePurchased(req, res) {
    try {
      const { id } = req.params;
      const item = shoppingItemModel.togglePurchased(id, req.userId);

      if (!item) {
        const exists = shoppingItemModel.findById(id);
        if (!exists) {
          return res.status(404).json({ error: 'Shopping item not found' });
        }
        return res.status(403).json({ error: 'Forbidden: item does not belong to user' });
      }

      emitShoppingItemToggled(req.userId, item);

      return res.json(item);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to toggle shopping item' });
    }
  },

  delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = shoppingItemModel.delete(id, req.userId);

      if (!deleted) {
        const exists = shoppingItemModel.findById(id);
        if (!exists) {
          return res.status(404).json({ error: 'Shopping item not found' });
        }
        return res.status(403).json({ error: 'Forbidden: item does not belong to user' });
      }

      emitShoppingItemDeleted(req.userId, id);

      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete shopping item' });
    }
  },
};

module.exports = shoppingItemController;
