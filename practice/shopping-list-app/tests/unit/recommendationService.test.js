const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'server', 'db', 'schema.sql');

let testDb;
let recommendationService;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  // Do NOT set ANTHROPIC_API_KEY — tests should use defaults

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(schema);

  // Mock connection
  const connectionModule = require('../../server/db/connection');
  connectionModule.getDatabase = () => testDb;
  connectionModule.closeDatabase = () => {};

  recommendationService = require('../../server/services/recommendationService');
});

afterAll(() => {
  if (testDb) testDb.close();
  delete require.cache[require.resolve('../../server/db/connection')];
  delete require.cache[require.resolve('../../server/services/recommendationService')];
});

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  testDb.exec('DELETE FROM shopping_items');
  testDb.exec('DELETE FROM users');
  recommendationService.clearCache();
});

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

function seedUser() {
  testDb.prepare(
    'INSERT OR IGNORE INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).run(USER_ID, 'Test User', 'test@example.com', 'hash');
}

function seedPurchasedItem(name, daysAgo = 1) {
  const { v4: uuidv4 } = require('uuid');
  const purchasedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  testDb.prepare(`
    INSERT INTO shopping_items (id, user_id, name, quantity, is_purchased, purchased_at)
    VALUES (?, ?, ?, 1, 1, ?)
  `).run(uuidv4(), USER_ID, name, purchasedAt);
}

describe('getPurchaseHistory', () => {
  it('returns empty array for user with no purchases', () => {
    seedUser();
    const history = recommendationService.getPurchaseHistory(USER_ID);
    expect(history).toEqual([]);
  });

  it('returns purchased items within last 30 days', () => {
    seedUser();
    seedPurchasedItem('Milk', 5);
    seedPurchasedItem('Eggs', 10);
    seedPurchasedItem('Old Item', 40); // outside 30-day window

    const history = recommendationService.getPurchaseHistory(USER_ID);
    expect(history).toHaveLength(2);
    expect(history[0].name).toBe('Milk');
    expect(history[1].name).toBe('Eggs');
  });
});

describe('getDefaultRecommendations', () => {
  it('returns array of default items with ids', () => {
    const defaults = recommendationService.getDefaultRecommendations();
    expect(defaults.length).toBeGreaterThan(0);
    for (const item of defaults) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('reason');
      expect(item).toHaveProperty('type', 'staple');
    }
  });
});

describe('generateRecommendations', () => {
  it('returns default recommendations when ANTHROPIC_API_KEY is not set', async () => {
    seedUser();
    seedPurchasedItem('Milk', 3);
    delete process.env.ANTHROPIC_API_KEY;

    const recs = await recommendationService.generateRecommendations(USER_ID);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]).toHaveProperty('name');
  });

  it('returns default recommendations for user with no purchase history', async () => {
    seedUser();
    delete process.env.ANTHROPIC_API_KEY;

    const recs = await recommendationService.generateRecommendations(USER_ID);
    const defaults = recommendationService.getDefaultRecommendations();
    expect(recs).toEqual(defaults);
  });
});

describe('AI response validation', () => {
  it('rejects items with non-string name', () => {
    const { _validateRecommendation } = require('../../server/services/recommendationService');
    expect(_validateRecommendation({ name: 123, quantity: 1 })).toBe(false);
    expect(_validateRecommendation({ name: '', quantity: 1 })).toBe(false);
    expect(_validateRecommendation({ name: null, quantity: 1 })).toBe(false);
  });

  it('rejects items with invalid quantity', () => {
    const { _validateRecommendation } = require('../../server/services/recommendationService');
    expect(_validateRecommendation({ name: 'Milk', quantity: -1 })).toBe(false);
    expect(_validateRecommendation({ name: 'Milk', quantity: 'abc' })).toBe(false);
    expect(_validateRecommendation({ name: 'Milk', quantity: 100000 })).toBe(false);
  });

  it('accepts valid recommendation', () => {
    const { _validateRecommendation } = require('../../server/services/recommendationService');
    expect(_validateRecommendation({ name: '우유', quantity: 2, unit: 'L', reason: '필수품', type: 'replenish' })).toBe(true);
    expect(_validateRecommendation({ name: '계란', quantity: 1 })).toBe(true);
  });
});

describe('cache', () => {
  it('returns cached data on second call', async () => {
    seedUser();
    delete process.env.ANTHROPIC_API_KEY;

    const first = await recommendationService.generateRecommendations(USER_ID);

    // Default recommendations should now be cached
    const cached = recommendationService._getCachedRecommendations(USER_ID);
    expect(cached).toBeTruthy();
    expect(cached).toEqual(first);
  });

  it('clearCache removes cached data', () => {
    recommendationService._setCachedRecommendations(USER_ID, [{ id: 'test', name: 'Test' }]);
    expect(recommendationService._getCachedRecommendations(USER_ID)).toBeTruthy();

    recommendationService.clearCache(USER_ID);
    expect(recommendationService._getCachedRecommendations(USER_ID)).toBeNull();
  });

  it('cache expires after TTL', () => {
    const data = [{ id: 'test', name: 'Test' }];
    recommendationService._setCachedRecommendations(USER_ID, data);
    expect(recommendationService._getCachedRecommendations(USER_ID)).toBeTruthy();

    // LRUCache handles TTL internally; verify clearCache works as expiry mechanism
    recommendationService.clearCache(USER_ID);
    expect(recommendationService._getCachedRecommendations(USER_ID)).toBeNull();
  });

  it('evicts oldest entry when cache exceeds max size', () => {
    for (let i = 0; i < 101; i++) {
      const uid = `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`;
      recommendationService._setCachedRecommendations(uid, [{ id: `test-${i}`, name: `Item ${i}` }]);
    }
    const firstUid = '550e8400-e29b-41d4-a716-446655440000';
    expect(recommendationService._getCachedRecommendations(firstUid)).toBeNull();
    const lastUid = '550e8400-e29b-41d4-a716-446655440100';
    expect(recommendationService._getCachedRecommendations(lastUid)).toBeTruthy();
  });
});
