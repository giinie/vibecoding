const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/connection');

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

const refreshTokenModel = {
  create(userId) {
    const db = getDatabase();
    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const familyId = uuidv4();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO refresh_tokens (id, user_id, token, family_id, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, token, familyId, expiresAt);

    return { id, token, familyId, expiresAt };
  },

  createWithFamily(userId, familyId) {
    const db = getDatabase();
    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO refresh_tokens (id, user_id, token, family_id, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, token, familyId, expiresAt);

    return { id, token, familyId, expiresAt };
  },

  findByToken(token) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(token) || null;
  },

  markUsed(id) {
    const db = getDatabase();
    db.prepare('UPDATE refresh_tokens SET is_used = 1 WHERE id = ?').run(id);
  },

  deleteFamily(familyId) {
    const db = getDatabase();
    db.prepare('DELETE FROM refresh_tokens WHERE family_id = ?').run(familyId);
  },

  deleteByUser(userId) {
    const db = getDatabase();
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  },

  deleteExpired() {
    const db = getDatabase();
    const result = db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run();
    return result.changes;
  },

  countFamilies(userId) {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(DISTINCT family_id) as cnt FROM refresh_tokens WHERE user_id = ?').get(userId);
    return row.cnt;
  },

  deleteOldestFamily(userId) {
    const db = getDatabase();
    const oldest = db.prepare(
      'SELECT family_id FROM refresh_tokens WHERE user_id = ? ORDER BY created_at ASC LIMIT 1'
    ).get(userId);
    if (oldest) {
      db.prepare('DELETE FROM refresh_tokens WHERE family_id = ?').run(oldest.family_id);
    }
  },
};

module.exports = refreshTokenModel;
