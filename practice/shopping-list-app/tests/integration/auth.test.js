const { setupTestDatabase, clearTestData, teardownTestDatabase } = require('../helpers/testDb');
const { createTestServer, stopTestServer } = require('../helpers/testServer');

/** @typedef {import('supertest').SuperTest<import('supertest').Test>} SuperTestAgent */
/** @typedef {import('http').Server} HttpServer */

/** @type {SuperTestAgent} */
let agent;
/** @type {HttpServer} */
let server;

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
});

describe('Registration validation', () => {
  it('returns 400 for password shorter than 8 chars', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'short',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'not-an-email',
        password: 'password123',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 for name exceeding 50 chars', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send({
        name: 'a'.repeat(51),
        email: 'test@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('normalizes email to lowercase', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'Alice@Test.COM',
        password: 'password123',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@test.com');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.refreshToken.length).toBe(64);
    expect(res.body).toHaveProperty('user');
  });

  it('rejects duplicate email with different casing', async () => {
    await agent
      .post('/api/auth/register')
      .send({
        name: 'First User',
        email: 'alice@test.com',
        password: 'password123',
      });

    const res = await agent
      .post('/api/auth/register')
      .send({
        name: 'Second User',
        email: 'Alice@Test.COM',
        password: 'password123',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send({
        name: 'Test User',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields/i);
  });
});

describe('Login validation', () => {
  beforeEach(async () => {
    await agent
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'login@test.com',
        password: 'password123',
      });
  });

  it('returns 400 for missing fields', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields/i);
  });

  it('returns 401 for wrong password', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('logs in successfully with case-different email', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({
        email: 'LOGIN@Test.COM',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('login@test.com');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.refreshToken.length).toBe(64);
    expect(res.body).toHaveProperty('user');
  });
});
