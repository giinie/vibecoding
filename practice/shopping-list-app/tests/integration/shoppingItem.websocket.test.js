const { io: ioClient } = require('socket.io-client');
const { setupTestDatabase, seedTestUser, getTestToken, clearTestData, teardownTestDatabase } = require('../helpers/testDb');
const { createTestServer, startTestServer, stopTestServer } = require('../helpers/testServer');

let server;
let agent;
let port;
let testUser;
let token;

function connectClient(userId) {
  const clientToken = getTestToken(userId);
  return new Promise((resolve) => {
    const client = ioClient(`http://localhost:${port}`, {
      auth: { token: clientToken },
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
  testUser = seedTestUser('50000000-0000-4000-8000-000000000001', 'Shop WS User', 'shopws@test.com');
  token = getTestToken(testUser.id);
});

describe('shoppingItem:new event', () => {
  it('emits shoppingItem:new when an item is created', async () => {
    const client = await connectClient(testUser.id);
    const eventPromise = waitForEvent(client, 'shoppingItem:new');

    await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '우유', quantity: 2, unit: '개' });

    const data = await eventPromise;

    expect(data).toMatchObject({
      user_id: testUser.id,
      name: '우유',
      quantity: 2,
      unit: '개',
      is_purchased: 0,
    });
    expect(data.id).toBeDefined();

    client.disconnect();
  });

  it('other users do NOT receive the event', async () => {
    const otherUser = seedTestUser('50000000-0000-4000-8000-000000000002', 'Other', 'shopother@test.com');
    const targetClient = await connectClient(testUser.id);
    const otherClient = await connectClient(otherUser.id);

    let otherReceived = false;
    otherClient.on('shoppingItem:new', () => {
      otherReceived = true;
    });

    const targetPromise = waitForEvent(targetClient, 'shoppingItem:new');

    await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '빵' });

    await targetPromise;
    await new Promise((r) => setTimeout(r, 200));

    expect(otherReceived).toBe(false);

    targetClient.disconnect();
    otherClient.disconnect();
  });
});

describe('shoppingItem:toggled event', () => {
  it('emits shoppingItem:toggled when an item is toggled', async () => {
    const createRes = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '사과' });
    const itemId = createRes.body.id;

    const client = await connectClient(testUser.id);
    const eventPromise = waitForEvent(client, 'shoppingItem:toggled');

    await agent
      .patch(`/api/shopping-items/${itemId}/toggle`)
      .set('Authorization', `Bearer ${token}`);

    const data = await eventPromise;

    expect(data).toMatchObject({
      id: itemId,
      is_purchased: 1,
    });

    client.disconnect();
  });
});

describe('shoppingItem:deleted event', () => {
  it('emits shoppingItem:deleted when an item is deleted', async () => {
    const createRes = await agent
      .post('/api/shopping-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '바나나' });
    const itemId = createRes.body.id;

    const client = await connectClient(testUser.id);
    const eventPromise = waitForEvent(client, 'shoppingItem:deleted');

    await agent
      .delete(`/api/shopping-items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);

    const data = await eventPromise;

    expect(data).toEqual({ id: itemId });

    client.disconnect();
  });
});
