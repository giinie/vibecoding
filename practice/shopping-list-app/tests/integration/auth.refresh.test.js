const { setupTestDatabase, teardownTestDatabase, seedTestUser, clearTestData, getTestDatabase } = require('../helpers/testDb');
const { createTestServer } = require('../helpers/testServer');

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

let agent;

beforeAll(() => {
  setupTestDatabase();
  const { agent: testAgent } = createTestServer();
  agent = testAgent;
  seedTestUser(TEST_USER_ID, 'Test User', 'refresh@test.com');
});

afterAll(() => {
  teardownTestDatabase();
});

afterEach(() => {
  const db = getTestDatabase();
  db.exec('DELETE FROM refresh_tokens');
});

describe('POST /api/auth/refresh', () => {
  it('should return new access and refresh tokens', async () => {
    const loginRes = await agent.post('/api/auth/login')
      .send({ email: 'refresh@test.com', password: 'password123' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('refreshToken');

    const res = await agent.post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.refreshToken).not.toBe(loginRes.body.refreshToken);
  });

  it('should reject an already-used refresh token (replay attack)', async () => {
    const loginRes = await agent.post('/api/auth/login')
      .send({ email: 'refresh@test.com', password: 'password123' });
    const oldRefreshToken = loginRes.body.refreshToken;

    await agent.post('/api/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    const replayRes = await agent.post('/api/auth/refresh')
      .send({ refreshToken: oldRefreshToken });
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error).toMatch(/replay|revoked/i);
  });

  it('should reject non-existent refresh token', async () => {
    const res = await agent.post('/api/auth/refresh')
      .send({ refreshToken: 'nonexistent-token-value' });
    expect(res.status).toBe(401);
  });

  it('should reject missing refreshToken field', async () => {
    const res = await agent.post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('should reject expired refresh token', async () => {
    const db = getTestDatabase();
    const crypto = require('crypto');
    const expiredToken = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO refresh_tokens (id, user_id, token, family_id, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), TEST_USER_ID, expiredToken, crypto.randomUUID(), '2020-01-01T00:00:00.000Z');

    const res = await agent.post('/api/auth/refresh')
      .send({ refreshToken: expiredToken });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('should invalidate the refresh token family', async () => {
    const loginRes = await agent.post('/api/auth/login')
      .send({ email: 'refresh@test.com', password: 'password123' });

    const logoutRes = await agent.post('/api/auth/logout')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(logoutRes.status).toBe(200);

    const refreshRes = await agent.post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('should return 200 even for unknown token (no info leak)', async () => {
    const res = await agent.post('/api/auth/logout')
      .send({ refreshToken: 'unknown-token' });
    expect(res.status).toBe(200);
  });
});

describe('Login/Register with refresh token', () => {
  it('login should return refreshToken alongside token and user', async () => {
    const res = await agent.post('/api/auth/login')
      .send({ email: 'refresh@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
  });

  it('register should return refreshToken alongside token and user', async () => {
    const res = await agent.post('/api/auth/register')
      .send({ name: 'New User', email: 'newrefresh@test.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
  });

  it('should enforce max 5 token families per user', async () => {
    for (let i = 0; i < 6; i++) {
      await agent.post('/api/auth/login')
        .send({ email: 'refresh@test.com', password: 'password123' });
    }
    const db = getTestDatabase();
    const row = db.prepare('SELECT COUNT(DISTINCT family_id) as cnt FROM refresh_tokens WHERE user_id = ?').get(TEST_USER_ID);
    expect(row.cnt).toBeLessThanOrEqual(5);
  });
});
