const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../db/connection');

const SALT_ROUNDS = 10;

const userModel = {
  async create({ name, email, password }) {
    const db = getDatabase();
    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    db.prepare(
      'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
    ).run(id, name, email, password_hash);

    return this.findById(id);
  },

  findById(id) {
    const db = getDatabase();
    const row = db.prepare(
      'SELECT id, name, email, created_at FROM users WHERE id = ?'
    ).get(id);
    return row || null;
  },

  findByEmail(email) {
    const db = getDatabase();
    return db.prepare(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?'
    ).get(email) || null;
  },

  async verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
  },
};

module.exports = userModel;
