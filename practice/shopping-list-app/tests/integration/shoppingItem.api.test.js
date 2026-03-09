const { setupTestDatabase, seedTestUser, getTestToken, clearTestData, teardownTestDatabase } = require('../helpers/testDb');
const { createTestServer, stopTestServer } = require('../helpers/testServer');

let agent;
let server;
let testUser;
let token;

beforeAll(() => {
  setupTestDatabase();
  const testServer = createTestServer();
  agent = testServer.agent;
  server = testServer.server;
});

afterAll(async () => {
  await stopTestServer(server);
  teardownTestDatabase();
});

beforeEach(() => {
  clearTestData();
  testUser = seedTestUser('20000000-0000-4000-8000-000000000001', 'Shopper', 'shopper@test.com');
  token = getTestToken(testUser.id);
});

describe('POST /api/shopping-items', () => {
  it('creates an item and returns 201', async () => {
    const res = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '우유', quantity: 2, unit: '개' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      user_id: testUser.id,
      name: '우유',
      quantity: 2,
      unit: '개',
      is_purchased: 0,
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.created_at).toBeDefined();
  });

  it('creates an item with defaults (quantity=1, no unit)', async () => {
    const res = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '계란' });

    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(1);
    expect(res.body.unit).toBeNull();
  });

  it('returns 400 for missing name', async () => {
    const res = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('returns 400 for empty name', async () => {
    const res = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('returns 400 for name exceeding 200 chars', async () => {
    const res = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'a'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('returns 400 for non-integer quantity', async () => {
    const res = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '빵', quantity: 1.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/quantity/i);
  });

  it('returns 400 for quantity less than 1', async () => {
    const res = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '빵', quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/quantity/i);
  });

  it('returns 400 for unit exceeding 20 chars', async () => {
    const res = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '빵', unit: 'a'.repeat(21) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unit/i);
  });

  it('returns 401 without auth token', async () => {
    const res = await agent
      .post('/api/shopping-items')
      .send({ name: '우유' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/shopping-items/:userId', () => {
  beforeEach(async () => {
    for (let i = 0; i < 5; i++) {
      await agent
        .post('/api/shopping-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `아이템 ${i}` });
    }
  });

  it('returns items for a user', async () => {
    const res = await agent
      .get(`/api/shopping-items/${testUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(5);
    expect(res.body.total).toBe(5);
  });

  it('respects limit and offset', async () => {
    const res = await agent
      .get(`/api/shopping-items/${testUser.id}?limit=2&offset=1`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(5);
  });

  it('returns empty array for user with no items', async () => {
    const otherUser = seedTestUser('20000000-0000-4000-8000-000000000002', 'Empty', 'empty@test.com');
    const otherToken = getTestToken(otherUser.id);

    const res = await agent
      .get(`/api/shopping-items/${otherUser.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('returns 403 when accessing another user items', async () => {
    const otherUser = seedTestUser('20000000-0000-4000-8000-000000000003', 'Other', 'other@test.com');
    const otherToken = getTestToken(otherUser.id);

    const res = await agent
      .get(`/api/shopping-items/${testUser.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/shopping-items/:id/toggle', () => {
  let itemId;

  beforeEach(async () => {
    const res = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '사과' });
    itemId = res.body.id;
  });

  it('toggles purchased status from false to true', async () => {
    const res = await agent
      .patch(`/api/shopping-items/${itemId}/toggle`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.is_purchased).toBe(1);
  });

  it('toggles purchased status back to false', async () => {
    await agent
      .patch(`/api/shopping-items/${itemId}/toggle`)
      .set('Authorization', `Bearer ${token}`);

    const res = await agent
      .patch(`/api/shopping-items/${itemId}/toggle`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.is_purchased).toBe(0);
  });

  it('returns 404 for non-existent item', async () => {
    const res = await agent
      .patch('/api/shopping-items/00000000-0000-4000-8000-000000000000/toggle')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 for another user item', async () => {
    const otherUser = seedTestUser('20000000-0000-4000-8000-000000000004', 'Other', 'other2@test.com');
    const otherToken = getTestToken(otherUser.id);

    const res = await agent
      .patch(`/api/shopping-items/${itemId}/toggle`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/shopping-items/:id', () => {
  let itemId;

  beforeEach(async () => {
    const res = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '바나나' });
    itemId = res.body.id;
  });

  it('deletes an item and returns 204', async () => {
    const res = await agent
      .delete(`/api/shopping-items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    const listRes = await agent
      .get(`/api/shopping-items/${testUser.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.items).toHaveLength(0);
  });

  it('returns 404 for non-existent item', async () => {
    const res = await agent
      .delete('/api/shopping-items/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 for another user item', async () => {
    const otherUser = seedTestUser('20000000-0000-4000-8000-000000000005', 'Other', 'other3@test.com');
    const otherToken = getTestToken(otherUser.id);

    const res = await agent
      .delete(`/api/shopping-items/${itemId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});

describe('UUID validation', () => {
  it('returns 400 for non-UUID userId param', async () => {
    const res = await agent
      .get('/api/shopping-items/not-a-valid-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 400 for non-UUID id param on PATCH', async () => {
    const res = await agent
      .patch('/api/shopping-items/not-a-valid-uuid/toggle')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 400 for non-UUID id param on DELETE', async () => {
    const res = await agent
      .delete('/api/shopping-items/not-a-valid-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });
});
