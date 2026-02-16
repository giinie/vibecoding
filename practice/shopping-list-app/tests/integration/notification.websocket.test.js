const { io: ioClient } = require('socket.io-client');
const { setupTestDatabase, seedTestUser, getTestToken, clearTestData, teardownTestDatabase } = require('../helpers/testDb');
const { createTestServer, startTestServer, stopTestServer } = require('../helpers/testServer');

let server;
let agent;
let port;
let testUser;
let token;

function connectClient(userId) {
  const token = getTestToken(userId);
  return new Promise((resolve) => {
    const client = ioClient(`http://localhost:${port}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    client.on('connect', () => resolve(client));
  });
}

function waitForEvent(client, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeoutMs);
    client.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

beforeAll(async () => {
  setupTestDatabase();
  const testServer = createTestServer();
  server = testServer.server;
  agent = testServer.agent;
  port = await startTestServer(server);
});

afterAll(async () => {
  await stopTestServer(server);
  teardownTestDatabase();
});

beforeEach(() => {
  clearTestData();
  testUser = seedTestUser('ws-user-1', 'WS User', 'ws@test.com');
  token = getTestToken(testUser.id);
});

describe('WebSocket authentication', () => {
  it('rejects connection without token', async () => {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    const error = await new Promise((resolve) => {
      client.on('connect_error', (err) => {
        resolve(err);
      });
    });

    expect(error.message).toMatch(/authentication required/i);
    expect(client.connected).toBe(false);
    client.disconnect();
  });

  it('rejects connection with invalid token', async () => {
    const client = ioClient(`http://localhost:${port}`, {
      auth: { token: 'invalid-token-value' },
      transports: ['websocket'],
      forceNew: true,
    });

    const error = await new Promise((resolve) => {
      client.on('connect_error', (err) => {
        resolve(err);
      });
    });

    expect(error.message).toMatch(/invalid or expired token/i);
    expect(client.connected).toBe(false);
    client.disconnect();
  });

  it('rejects connection with expired token', async () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET, { expiresIn: '0s' });

    const client = ioClient(`http://localhost:${port}`, {
      auth: { token: expiredToken },
      transports: ['websocket'],
      forceNew: true,
    });

    const error = await new Promise((resolve) => {
      client.on('connect_error', (err) => {
        resolve(err);
      });
    });

    expect(error.message).toMatch(/invalid or expired token/i);
    expect(client.connected).toBe(false);
    client.disconnect();
  });

  it('accepts connection with valid token and joins room', async () => {
    const client = await connectClient(testUser.id);

    expect(client.connected).toBe(true);
    client.disconnect();
  });
});

describe('notification:new event', () => {
  it('emits notification:new to the correct user when a notification is created', async () => {
    const client = await connectClient(testUser.id);

    const eventPromise = waitForEvent(client, 'notification:new');

    await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: testUser.id,
        type: 'item_added',
        title: 'New item',
        message: 'Milk added',
      });

    const data = await eventPromise;

    expect(data).toMatchObject({
      user_id: testUser.id,
      type: 'item_added',
      title: 'New item',
      message: 'Milk added',
    });
    expect(data.id).toBeDefined();

    client.disconnect();
  });

  it('other users do NOT receive the notification', async () => {
    const otherUser = seedTestUser('ws-user-2', 'Other', 'other@test.com');
    const targetClient = await connectClient(testUser.id);
    const otherClient = await connectClient(otherUser.id);

    let otherReceived = false;
    otherClient.on('notification:new', () => {
      otherReceived = true;
    });

    const targetPromise = waitForEvent(targetClient, 'notification:new');

    await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: testUser.id,
        type: 'item_added',
        title: 'Private notification',
        message: 'Only for ws-user-1',
      });

    await targetPromise;

    // Give a short window for any erroneous delivery
    await new Promise((r) => setTimeout(r, 200));

    expect(otherReceived).toBe(false);

    targetClient.disconnect();
    otherClient.disconnect();
  });
});

describe('notification:read event', () => {
  it('emits notification:read when a notification is marked as read', async () => {
    // Create a notification first
    const createRes = await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: testUser.id,
        type: 'reminder',
        title: 'Reminder',
        message: 'Buy bread',
      });
    const notificationId = createRes.body.id;

    const client = await connectClient(testUser.id);
    const eventPromise = waitForEvent(client, 'notification:read');

    await agent
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${token}`);

    const data = await eventPromise;

    expect(data).toEqual({ id: notificationId });

    client.disconnect();
  });
});

describe('notification:read-all event', () => {
  it('emits notification:read-all when all notifications are marked as read', async () => {
    // Create a couple of notifications
    await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: testUser.id,
        type: 'item_added',
        title: 'Item 1',
        message: 'Msg 1',
      });
    await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: testUser.id,
        type: 'item_added',
        title: 'Item 2',
        message: 'Msg 2',
      });

    const client = await connectClient(testUser.id);
    const eventPromise = waitForEvent(client, 'notification:read-all');

    await agent
      .patch(`/api/notifications/read-all/${testUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    // notification:read-all emits without data payload
    const data = await eventPromise;
    // The event fires - that's the assertion (no timeout = success)
    expect(true).toBe(true);

    client.disconnect();
  });
});
