const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/connection');

const shoppingItemModel = {
  create({ user_id, name, quantity = 1, unit = null }) {
    const db = getDatabase();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO shopping_items (id, user_id, name, quantity, unit)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, user_id, name, quantity, unit);

    return this.findById(id);
  },

  findByUserId(userId, { limit = 20, offset = 0 } = {}) {
    const db = getDatabase();

    const items = db.prepare(`
      SELECT * FROM shopping_items
      WHERE user_id = ?
      ORDER BY is_purchased ASC, created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);

    const { total } = db.prepare(
      'SELECT COUNT(*) as total FROM shopping_items WHERE user_id = ?'
    ).get(userId);

    return { items, total };
  },

  findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id) || null;
  },

  togglePurchased(id) {
    const db = getDatabase();
    const result = db.prepare(
      'UPDATE shopping_items SET is_purchased = CASE WHEN is_purchased = 0 THEN 1 ELSE 0 END WHERE id = ?'
    ).run(id);

    if (result.changes === 0) return null;
    return this.findById(id);
  },

  delete(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM shopping_items WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

module.exports = shoppingItemModel;
