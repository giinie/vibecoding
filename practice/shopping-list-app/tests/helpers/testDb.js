const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'server', 'db', 'schema.sql');

let testDb;

function setupTestDatabase() {
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

function seedTestUser(userId = 'test-user-1', name = 'Test User', email = 'test@example.com') {
  testDb.prepare(
    'INSERT OR IGNORE INTO users (id, name, email) VALUES (?, ?, ?)'
  ).run(userId, name, email);
  return { id: userId, name, email };
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
  delete require.cache[require.resolve('../../server/controllers/notificationController')];
  delete require.cache[require.resolve('../../server/routes/notifications')];
  delete require.cache[require.resolve('../../server/websocket/socketManager')];
  delete require.cache[require.resolve('../../server/websocket/notificationEmitter')];
}

function getTestDatabase() {
  return testDb;
}

module.exports = {
  setupTestDatabase,
  seedTestUser,
  clearTestData,
  teardownTestDatabase,
  getTestDatabase,
};
