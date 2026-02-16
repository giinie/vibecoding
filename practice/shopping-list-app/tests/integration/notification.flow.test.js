const { io: ioClient } = require('socket.io-client');
const { setupTestDatabase, seedTestUser, getTestToken, clearTestData, teardownTestDatabase } = require('../helpers/testDb');
const { createTestServer, startTestServer, stopTestServer } = require('../helpers/testServer');

let server;
let agent;
let port;

function connectClient(userId) {
  return new Promise((resolve) => {
    const client = ioClient(`http://localhost:${port}`, {
      query: { userId },
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
});

describe('Full notification flow', () => {
  it('create notification -> receive via WebSocket -> mark as read -> verify in list', async () => {
    const user = seedTestUser('flow-user-1', 'Flow User', 'flow@test.com');
    const token = getTestToken(user.id);
    const client = await connectClient(user.id);

    // Step 1: Listen for the WebSocket event
    const wsPromise = waitForEvent(client, 'notification:new');

    // Step 2: Create a notification via API
    const createRes = await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: user.id,
        type: 'item_added',
        title: 'Milk added',
        message: 'Milk was added to your shopping list',
        metadata: { itemName: 'Milk' },
      });
    expect(createRes.status).toBe(201);
    const notificationId = createRes.body.id;

    // Step 3: Verify WebSocket received the notification
    const wsData = await wsPromise;
    expect(wsData.id).toBe(notificationId);
    expect(wsData.type).toBe('item_added');

    // Step 4: Verify notification appears in the list as unread
    const listRes1 = await agent
      .get(`/api/notifications/${user.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes1.body.notifications).toHaveLength(1);
    expect(listRes1.body.unread_count).toBe(1);
    expect(listRes1.body.notifications[0].is_read).toBe(0);

    // Step 5: Mark the notification as read
    const readPromise = waitForEvent(client, 'notification:read');
    const readRes = await agent
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.is_read).toBe(1);

    // Step 6: Verify read event received via WebSocket
    const readData = await readPromise;
    expect(readData.id).toBe(notificationId);

    // Step 7: Verify notification is now marked as read in the list
    const listRes2 = await agent
      .get(`/api/notifications/${user.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes2.body.unread_count).toBe(0);
    expect(listRes2.body.notifications[0].is_read).toBe(1);

    client.disconnect();
  });
});

describe('Multi-user isolation', () => {
  it('notifications are isolated per user', async () => {
    const alice = seedTestUser('alice-1', 'Alice', 'alice@test.com');
    const bob = seedTestUser('bob-1', 'Bob', 'bob@test.com');
    const aliceToken = getTestToken(alice.id);
    const bobToken = getTestToken(bob.id);

    const aliceClient = await connectClient(alice.id);
    const bobClient = await connectClient(bob.id);

    // Track received notifications per user
    const aliceNotifications = [];
    const bobNotifications = [];
    aliceClient.on('notification:new', (data) => aliceNotifications.push(data));
    bobClient.on('notification:new', (data) => bobNotifications.push(data));

    // Create notifications for Alice
    await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        user_id: alice.id,
        type: 'item_added',
        title: 'Alice item 1',
        message: 'For Alice only',
      });
    await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        user_id: alice.id,
        type: 'reminder',
        title: 'Alice reminder',
        message: 'Alice reminder msg',
      });

    // Create notification for Bob
    await agent
      .post('/api/notifications')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        user_id: bob.id,
        type: 'list_shared',
        title: 'Bob shared list',
        message: 'For Bob only',
      });

    // Wait for events to propagate
    await new Promise((r) => setTimeout(r, 300));

    // Verify WebSocket isolation
    expect(aliceNotifications).toHaveLength(2);
    expect(bobNotifications).toHaveLength(1);
    expect(aliceNotifications.every((n) => n.user_id === alice.id)).toBe(true);
    expect(bobNotifications.every((n) => n.user_id === bob.id)).toBe(true);

    // Verify API isolation
    const aliceList = await agent
      .get(`/api/notifications/${alice.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    const bobList = await agent
      .get(`/api/notifications/${bob.id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(aliceList.body.notifications).toHaveLength(2);
    expect(bobList.body.notifications).toHaveLength(1);
    expect(aliceList.body.notifications.every((n) => n.user_id === alice.id)).toBe(true);
    expect(bobList.body.notifications.every((n) => n.user_id === bob.id)).toBe(true);

    aliceClient.disconnect();
    bobClient.disconnect();
  });
});
