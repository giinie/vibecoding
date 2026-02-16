const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'server', 'db', 'schema.sql');
const TEST_JWT_SECRET = 'test-jwt-secret-key';
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('password123', 10);

let testDb;

function setupTestDatabase() {
  process.env.JWT_SECRET = TEST_JWT_SECRET;

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(schema);

  // Mock the connection module so all code uses our in-memory DB
  const connectionModule = require('../../server/db/connection');
  connectionModule.getDatabase = () => testDb;
  connectionModule.closeDatabase = () => {
    // no-op during tests; we manage lifecycle ourselves
  };

  return testDb;
}

function seedTestUser(userId = 'test-user-1', name = 'Test User', email = 'test@example.com', password = 'password123') {
  const passwordHash = password === 'password123' ? DEFAULT_PASSWORD_HASH : bcrypt.hashSync(password, 10);
  testDb.prepare(
    'INSERT OR IGNORE INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).run(userId, name, email, passwordHash);
  return { id: userId, name, email };
}

function getTestToken(userId) {
  return jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

function clearTestData() {
  if (testDb) {
    testDb.exec('DELETE FROM notifications');
    testDb.exec('DELETE FROM users');
  }
}

function teardownTestDatabase() {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
  // Clear module cache so fresh imports get a fresh DB next time
  delete require.cache[require.resolve('../../server/db/connection')];
  delete require.cache[require.resolve('../../server/models/notificationModel')];
  delete require.cache[require.resolve('../../server/models/userModel')];
  delete require.cache[require.resolve('../../server/controllers/notificationController')];
  delete require.cache[require.resolve('../../server/middleware/auth')];
  delete require.cache[require.resolve('../../server/routes/notifications')];
  delete require.cache[require.resolve('../../server/routes/auth')];
  delete require.cache[require.resolve('../../server/websocket/socketManager')];
  delete require.cache[require.resolve('../../server/websocket/notificationEmitter')];
}

function getTestDatabase() {
  return testDb;
}

module.exports = {
  setupTestDatabase,
  seedTestUser,
  getTestToken,
  clearTestData,
  teardownTestDatabase,
  getTestDatabase,
};
