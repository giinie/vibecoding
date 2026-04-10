const { setupTestDatabase, seedTestUser, getTestToken, clearTestData, teardownTestDatabase } = require('../helpers/testDb');
const { createTestServer } = require('../helpers/testServer');
const crypto = require('crypto');

let agent;
let server;

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440001';

beforeAll(() => {
  setupTestDatabase();
  const testServer = createTestServer();
  agent = testServer.agent;
  server = testServer.server;
});

afterAll(async () => {
  if (server && server.listening) {
    await new Promise(resolve => server.close(resolve));
  }
  teardownTestDatabase();
});

let savedApiKey;

beforeEach(() => {
  savedApiKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  clearTestData();
  seedTestUser(USER_ID, 'Test User', 'test@example.com');
  seedTestUser(OTHER_USER_ID, 'Other User', 'other@example.com');
});

afterEach(() => {
  if (savedApiKey !== undefined) {
    process.env.ANTHROPIC_API_KEY = savedApiKey;
  }
});

describe('GET /api/recommendations/:userId', () => {
  it('returns 401 without auth token', async () => {
    const res = await agent.get(`/api/recommendations/${USER_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid userId format', async () => {
    const token = getTestToken(USER_ID);
    const res = await agent
      .get('/api/recommendations/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid.*format/i);
  });

  it('returns 403 for different user', async () => {
    const token = getTestToken(USER_ID);
    const res = await agent
      .get(`/api/recommendations/${OTHER_USER_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns default recommendations for user with no purchase history', async () => {
    const token = getTestToken(USER_ID);
    const res = await agent
      .get(`/api/recommendations/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.recommendations).toBeDefined();
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);

    const item = res.body.recommendations[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('reason');
  });

  it('returns recommendations with correct structure', async () => {
    const token = getTestToken(USER_ID);
    const res = await agent
      .get(`/api/recommendations/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    for (const item of res.body.recommendations) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('quantity');
      expect(item).toHaveProperty('reason');
      expect(item).toHaveProperty('type');
    }
  });
});

describe('GET /api/recommendations/:userId?refresh=true', () => {
  it('bypasses cache and returns fresh recommendations', async () => {
    const token = getTestToken(USER_ID);

    // First request — populates cache
    const res1 = await agent
      .get(`/api/recommendations/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res1.status).toBe(200);
    const first = res1.body.recommendations;

    // Second request without refresh — should return cached result
    const res2 = await agent
      .get(`/api/recommendations/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(200);
    expect(res2.body.recommendations).toEqual(first);

    // Third request with refresh=true — cache cleared, regenerated
    const res3 = await agent
      .get(`/api/recommendations/${USER_ID}?refresh=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(res3.status).toBe(200);
    expect(res3.body.recommendations).toBeDefined();
    expect(Array.isArray(res3.body.recommendations)).toBe(true);
  });
});

describe('purchased_at column', () => {
  it('sets purchased_at when toggling to purchased', async () => {
    const token = getTestToken(USER_ID);

    // Create an item
    const createRes = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Item' });
    expect(createRes.status).toBe(201);
    const itemId = createRes.body.id;

    // Toggle to purchased
    const toggleRes = await agent
      .patch(`/api/shopping-items/${itemId}/toggle`)
      .set('Authorization', `Bearer ${token}`);
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.is_purchased).toBe(1);
    expect(toggleRes.body.purchased_at).toBeTruthy();

    // Toggle back to unpurchased
    const toggleBackRes = await agent
      .patch(`/api/shopping-items/${itemId}/toggle`)
      .set('Authorization', `Bearer ${token}`);
    expect(toggleBackRes.status).toBe(200);
    expect(toggleBackRes.body.is_purchased).toBe(0);
    expect(toggleBackRes.body.purchased_at).toBeNull();
  });
});
