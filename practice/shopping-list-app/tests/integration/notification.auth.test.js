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
  testUser = seedTestUser('20000000-0000-4000-8000-000000000001', 'Auth User', 'auth@test.com');
  token = getTestToken(testUser.id);
});

describe('Authentication - missing Authorization header', () => {
  it('POST /api/notifications without token returns 401', async () => {
    const res = await agent.post('/api/notifications').send({
      user_id: testUser.id,
      type: 'item_added',
      title: 'Test',
      message: 'Test message',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('GET /api/notifications/:userId without token returns 401', async () => {
    const res = await agent.get(`/api/notifications/${testUser.id}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('PATCH /api/notifications/:id/read without token returns 401', async () => {
    const res = await agent.patch('/api/notifications/00000000-0000-4000-8000-000000000000/read');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('PATCH /api/notifications/read-all/:userId without token returns 401', async () => {
    const res = await agent.patch(`/api/notifications/read-all/${testUser.id}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('DELETE /api/notifications/:id without token returns 401', async () => {
    const res = await agent.delete('/api/notifications/00000000-0000-4000-8000-000000000000');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });
});

describe('Authentication - invalid token', () => {
  it('returns 401 for malformed token', async () => {
    const res = await agent
      .get(`/api/notifications/${testUser.id}`)
      .set('Authorization', 'Bearer invalid-token-here');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired token/i);
  });

  it('returns 401 for token without Bearer prefix', async () => {
    const res = await agent
      .get(`/api/notifications/${testUser.id}`)
      .set('Authorization', token);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });
});

describe('Authorization - userId param mismatch', () => {
  it('GET /api/notifications/:userId with mismatched token returns 403', async () => {
    const otherUser = seedTestUser('20000000-0000-4000-8000-000000000002', 'Other User', 'other@test.com');
    const otherToken = getTestToken(otherUser.id);

    const res = await agent
      .get(`/api/notifications/${testUser.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden/i);
  });

  it('PATCH /api/notifications/read-all/:userId with mismatched token returns 403', async () => {
    const otherUser = seedTestUser('20000000-0000-4000-8000-000000000002', 'Other User', 'other@test.com');
    const otherToken = getTestToken(otherUser.id);

    const res = await agent
      .patch(`/api/notifications/read-all/${testUser.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden/i);
  });

  it('POST /api/notifications with mismatched user_id in body returns 403', async () => {
    const otherUser = seedTestUser('20000000-0000-4000-8000-000000000002', 'Other User', 'other@test.com');

    const res = await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: otherUser.id,
        type: 'item_added',
        title: 'Test',
        message: 'Test message',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/forbidden/i);
  });
});

describe('Authentication - valid token', () => {
  it('POST /api/notifications with valid token returns 201', async () => {
    const res = await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: testUser.id,
        type: 'item_added',
        title: 'Test',
        message: 'Test message',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('GET /api/notifications/:userId with matching token returns 200', async () => {
    const res = await agent
      .get(`/api/notifications/${testUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toBeDefined();
  });

  it('PATCH /api/notifications/:id/read with valid token returns 200', async () => {
    const createRes = await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: testUser.id,
        type: 'reminder',
        title: 'Test',
        message: 'Test message',
      });
    const notificationId = createRes.body.id;

    const res = await agent
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.is_read).toBe(1);
  });

  it('DELETE /api/notifications/:id with valid token returns 204', async () => {
    const createRes = await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: testUser.id,
        type: 'item_added',
        title: 'Test',
        message: 'Test message',
      });
    const notificationId = createRes.body.id;

    const res = await agent
      .delete(`/api/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});
