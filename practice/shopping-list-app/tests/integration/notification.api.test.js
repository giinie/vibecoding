const { setupTestDatabase, seedTestUser, clearTestData, teardownTestDatabase } = require('../helpers/testDb');
const { createTestServer, stopTestServer } = require('../helpers/testServer');

let agent;
let server;
let testUser;

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
  testUser = seedTestUser('user-1', 'Alice', 'alice@test.com');
});

describe('POST /api/notifications', () => {
  it('creates a notification and returns 201 with correct shape', async () => {
    const payload = {
      user_id: testUser.id,
      type: 'item_added',
      title: 'New item',
      message: 'Milk was added to your list',
    };

    const res = await agent.post('/api/notifications').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      user_id: testUser.id,
      type: 'item_added',
      title: 'New item',
      message: 'Milk was added to your list',
      is_read: 0,
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.created_at).toBeDefined();
  });

  it('returns 400 for missing required fields', async () => {
    const payload = { user_id: testUser.id };

    const res = await agent.post('/api/notifications').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields/i);
  });

  it('returns 400 for invalid notification type', async () => {
    const payload = {
      user_id: testUser.id,
      type: 'invalid_type',
      title: 'Test',
      message: 'Test message',
    };

    const res = await agent.post('/api/notifications').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid notification type/i);
  });

  it('stores metadata as JSON', async () => {
    const payload = {
      user_id: testUser.id,
      type: 'item_added',
      title: 'New item',
      message: 'Added item',
      metadata: { itemName: 'Milk', listId: 'list-1' },
    };

    const res = await agent.post('/api/notifications').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.metadata).toEqual({ itemName: 'Milk', listId: 'list-1' });
  });
});

describe('GET /api/notifications/:userId', () => {
  beforeEach(async () => {
    // Seed multiple notifications
    for (let i = 0; i < 5; i++) {
      await agent.post('/api/notifications').send({
        user_id: testUser.id,
        type: 'item_added',
        title: `Notification ${i}`,
        message: `Message ${i}`,
      });
    }
  });

  it('returns notifications for a user', async () => {
    const res = await agent.get(`/api/notifications/${testUser.id}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(5);
    expect(res.body.total).toBe(5);
    expect(res.body.unread_count).toBe(5);
  });

  it('filters unread notifications when unread_only=true', async () => {
    // Mark first notification as read
    const listRes = await agent.get(`/api/notifications/${testUser.id}`);
    const firstId = listRes.body.notifications[0].id;
    await agent.patch(`/api/notifications/${firstId}/read`);

    const res = await agent.get(`/api/notifications/${testUser.id}?unread_only=true`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(4);
    res.body.notifications.forEach((n) => {
      expect(n.is_read).toBe(0);
    });
  });

  it('respects limit and offset', async () => {
    const res = await agent.get(`/api/notifications/${testUser.id}?limit=2&offset=1`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.total).toBe(5);
  });

  it('returns empty array for user with no notifications', async () => {
    const otherUser = seedTestUser('user-empty', 'Empty', 'empty@test.com');

    const res = await agent.get(`/api/notifications/${otherUser.id}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  let notificationId;

  beforeEach(async () => {
    const res = await agent.post('/api/notifications').send({
      user_id: testUser.id,
      type: 'reminder',
      title: 'Reminder',
      message: 'Buy eggs',
    });
    notificationId = res.body.id;
  });

  it('marks a notification as read', async () => {
    const res = await agent.patch(`/api/notifications/${notificationId}/read`);

    expect(res.status).toBe(200);
    expect(res.body.is_read).toBe(1);
    expect(res.body.id).toBe(notificationId);
  });

  it('returns 404 for non-existent notification', async () => {
    const res = await agent.patch('/api/notifications/non-existent-id/read');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('PATCH /api/notifications/read-all/:userId', () => {
  beforeEach(async () => {
    for (let i = 0; i < 3; i++) {
      await agent.post('/api/notifications').send({
        user_id: testUser.id,
        type: 'item_added',
        title: `Item ${i}`,
        message: `Message ${i}`,
      });
    }
  });

  it('marks all notifications as read for a user', async () => {
    const res = await agent.patch(`/api/notifications/read-all/${testUser.id}`);

    expect(res.status).toBe(200);
    expect(res.body.updated_count).toBe(3);

    // Verify all are read
    const listRes = await agent.get(`/api/notifications/${testUser.id}?unread_only=true`);
    expect(listRes.body.notifications).toHaveLength(0);
    expect(listRes.body.unread_count).toBe(0);
  });
});

describe('DELETE /api/notifications/:id', () => {
  let notificationId;

  beforeEach(async () => {
    const res = await agent.post('/api/notifications').send({
      user_id: testUser.id,
      type: 'list_shared',
      title: 'Shared',
      message: 'List shared with you',
    });
    notificationId = res.body.id;
  });

  it('deletes a notification and returns 204', async () => {
    const res = await agent.delete(`/api/notifications/${notificationId}`);

    expect(res.status).toBe(204);

    // Verify it's gone
    const listRes = await agent.get(`/api/notifications/${testUser.id}`);
    expect(listRes.body.notifications).toHaveLength(0);
  });

  it('returns 404 for non-existent notification', async () => {
    const res = await agent.delete('/api/notifications/non-existent-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
