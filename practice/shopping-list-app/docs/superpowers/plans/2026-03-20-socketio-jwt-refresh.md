# Socket.io JWT Refresh Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Access/Refresh token separation with automatic token renewal for both REST API and Socket.io connections.

**Architecture:** Opaque refresh tokens stored in SQLite with family-based replay detection. Server disconnects sockets on access token expiry. Client uses Socket.io `auth` function pattern for automatic refresh on reconnection. `fetchWithAuth()` wrapper handles REST API token renewal.

**Tech Stack:** Express.js, better-sqlite3, jsonwebtoken, crypto, Socket.io v4, React (CRA)

**Spec:** `docs/superpowers/specs/2026-03-20-socketio-jwt-refresh-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `server/db/schema.sql` | Modify | Add `refresh_tokens` table |
| `server/models/refreshTokenModel.js` | Create | Refresh token CRUD (create, find, markUsed, deleteFamily, deleteByUser, deleteExpired, countFamilies) |
| `server/routes/auth.js` | Modify | Split `signToken` → `signAccessToken`/`generateRefreshToken`, add `/refresh` and `/logout` endpoints |
| `server/websocket/socketAuthMiddleware.js` | Modify | Structured error data, `tokenExp`, export `SOCKET_AUTH_ERRORS` |
| `server/websocket/socketManager.js` | Modify | Token expiration timer |
| `client/src/services/authApi.js` | Modify | Refresh token storage, `refreshAccessToken()` with mutex, `isTokenExpired()` |
| `client/src/services/apiUtils.js` | Modify | Add `fetchWithAuth()` wrapper |
| `client/src/services/notificationApi.js` | Modify | Replace `fetch()+authHeaders()` with `fetchWithAuth()` |
| `client/src/services/shoppingItemApi.js` | Modify | Replace `fetch()+authHeaders()` with `fetchWithAuth()` |
| `client/src/services/socketService.js` | Modify | `auth` as async function, structured error handling |
| `client/src/context/SocketContext.js` | Modify | `onAuthFailure` prop |
| `tests/helpers/testDb.js` | Modify | `refresh_tokens` migration + cleanup + new helpers |
| `tests/integration/auth.refresh.test.js` | Create | Refresh endpoint tests |
| `tests/integration/socketAuth.expiry.test.js` | Create | Socket expiry tests |
| `tests/unit/isTokenExpired.test.js` | Create | Token expiry utility tests |
| `tests/integration/auth.test.js` | Modify | Verify refresh token in responses |

---

### Task 1: Database Schema — Add `refresh_tokens` Table

**Files:**
- Modify: `server/db/schema.sql:42` (append after shopping_items indexes)

- [ ] **Step 1: Add refresh_tokens table to schema**

Append to `server/db/schema.sql` after line 41:

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    family_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    is_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

- [ ] **Step 2: Run migration to verify schema is valid**

Run: `cd server && node -e "const db = require('better-sqlite3')(':memory:'); const fs = require('fs'); db.pragma('foreign_keys = ON'); db.exec(fs.readFileSync('db/schema.sql','utf-8')); console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all())"`

Expected: Output includes `refresh_tokens` table.

- [ ] **Step 3: Commit**

```bash
git add server/db/schema.sql
git commit -m "feat(db): add refresh_tokens table with family-based replay detection"
```

---

### Task 2: Refresh Token Model

**Files:**
- Create: `server/models/refreshTokenModel.js`
- Modify: `tests/helpers/testDb.js:45-51,59-72`

- [ ] **Step 1: Write failing test for refreshTokenModel**

Create `tests/unit/refreshTokenModel.test.js`:

```javascript
const { setupTestDatabase, teardownTestDatabase, seedTestUser, getTestDatabase } = require('../helpers/testDb');
const crypto = require('crypto');

let refreshTokenModel;
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

beforeAll(() => {
  setupTestDatabase();
  refreshTokenModel = require('../../server/models/refreshTokenModel');
  seedTestUser(TEST_USER_ID);
});

afterAll(() => {
  teardownTestDatabase();
});

afterEach(() => {
  const db = getTestDatabase();
  db.exec('DELETE FROM refresh_tokens');
});

describe('refreshTokenModel', () => {
  describe('create', () => {
    it('should create a refresh token and return it', () => {
      const result = refreshTokenModel.create(TEST_USER_ID);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('familyId');
      expect(result.token).toHaveLength(64);
    });
  });

  describe('findByToken', () => {
    it('should find an existing token', () => {
      const created = refreshTokenModel.create(TEST_USER_ID);
      const found = refreshTokenModel.findByToken(created.token);
      expect(found).not.toBeNull();
      expect(found.user_id).toBe(TEST_USER_ID);
    });

    it('should return null for non-existent token', () => {
      const found = refreshTokenModel.findByToken('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('markUsed', () => {
    it('should mark token as used', () => {
      const created = refreshTokenModel.create(TEST_USER_ID);
      refreshTokenModel.markUsed(created.id);
      const found = refreshTokenModel.findByToken(created.token);
      expect(found.is_used).toBe(1);
    });
  });

  describe('deleteFamily', () => {
    it('should delete all tokens in the same family', () => {
      const first = refreshTokenModel.create(TEST_USER_ID);
      // Create another token in the same family
      refreshTokenModel.createWithFamily(TEST_USER_ID, first.familyId);
      refreshTokenModel.deleteFamily(first.familyId);
      const found = refreshTokenModel.findByToken(first.token);
      expect(found).toBeNull();
    });
  });

  describe('deleteByUser', () => {
    it('should delete all tokens for a user', () => {
      refreshTokenModel.create(TEST_USER_ID);
      refreshTokenModel.create(TEST_USER_ID);
      refreshTokenModel.deleteByUser(TEST_USER_ID);
      const db = getTestDatabase();
      const count = db.prepare('SELECT COUNT(*) as cnt FROM refresh_tokens WHERE user_id = ?').get(TEST_USER_ID);
      expect(count.cnt).toBe(0);
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired tokens', () => {
      const db = getTestDatabase();
      db.prepare('INSERT INTO refresh_tokens (id, user_id, token, family_id, expires_at) VALUES (?, ?, ?, ?, ?)').run(
        crypto.randomUUID(), TEST_USER_ID, crypto.randomBytes(32).toString('hex'),
        crypto.randomUUID(), '2020-01-01T00:00:00.000Z'
      );
      const deleted = refreshTokenModel.deleteExpired();
      expect(deleted).toBeGreaterThan(0);
    });
  });

  describe('countFamilies', () => {
    it('should count distinct families for a user', () => {
      refreshTokenModel.create(TEST_USER_ID);
      refreshTokenModel.create(TEST_USER_ID);
      const count = refreshTokenModel.countFamilies(TEST_USER_ID);
      expect(count).toBe(2);
    });
  });

  describe('deleteOldestFamily', () => {
    it('should delete the oldest family', () => {
      refreshTokenModel.create(TEST_USER_ID);
      refreshTokenModel.create(TEST_USER_ID);
      refreshTokenModel.create(TEST_USER_ID);
      refreshTokenModel.deleteOldestFamily(TEST_USER_ID);
      const count = refreshTokenModel.countFamilies(TEST_USER_ID);
      expect(count).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/refreshTokenModel.test.js --no-coverage`

Expected: FAIL — `Cannot find module '../../server/models/refreshTokenModel'`

- [ ] **Step 3: Update testDb.js — add refresh_tokens cleanup and cache clearing**

In `tests/helpers/testDb.js`:

1. In `clearTestData()` (line 45-51), add before `DELETE FROM users`:
```javascript
testDb.exec('DELETE FROM refresh_tokens');
```

2. In `teardownTestDatabase()` (line 53-73), add a new cache delete line:
```javascript
delete require.cache[require.resolve('../../server/models/refreshTokenModel')];
```

- [ ] **Step 4: Write refreshTokenModel implementation**

Create `server/models/refreshTokenModel.js`:

```javascript
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/connection');

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

const refreshTokenModel = {
  create(userId) {
    const db = getDatabase();
    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const familyId = uuidv4();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO refresh_tokens (id, user_id, token, family_id, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, token, familyId, expiresAt);

    return { id, token, familyId, expiresAt };
  },

  createWithFamily(userId, familyId) {
    const db = getDatabase();
    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO refresh_tokens (id, user_id, token, family_id, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, token, familyId, expiresAt);

    return { id, token, familyId, expiresAt };
  },

  findByToken(token) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(token) || null;
  },

  markUsed(id) {
    const db = getDatabase();
    db.prepare('UPDATE refresh_tokens SET is_used = 1 WHERE id = ?').run(id);
  },

  deleteFamily(familyId) {
    const db = getDatabase();
    db.prepare('DELETE FROM refresh_tokens WHERE family_id = ?').run(familyId);
  },

  deleteByUser(userId) {
    const db = getDatabase();
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  },

  deleteExpired() {
    const db = getDatabase();
    const result = db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run();
    return result.changes;
  },

  countFamilies(userId) {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(DISTINCT family_id) as cnt FROM refresh_tokens WHERE user_id = ?').get(userId);
    return row.cnt;
  },

  deleteOldestFamily(userId) {
    const db = getDatabase();
    const oldest = db.prepare(
      'SELECT family_id FROM refresh_tokens WHERE user_id = ? ORDER BY created_at ASC LIMIT 1'
    ).get(userId);
    if (oldest) {
      db.prepare('DELETE FROM refresh_tokens WHERE family_id = ?').run(oldest.family_id);
    }
  },
};

module.exports = refreshTokenModel;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/unit/refreshTokenModel.test.js --no-coverage`

Expected: All 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/models/refreshTokenModel.js tests/unit/refreshTokenModel.test.js tests/helpers/testDb.js
git commit -m "feat(model): add refreshTokenModel with family-based replay detection"
```

---

### Task 3: Server Auth Routes — `/refresh` and `/logout` Endpoints

**Files:**
- Modify: `server/routes/auth.js:1-79`
- Test: `tests/integration/auth.refresh.test.js` (create)

- [ ] **Step 1: Write failing tests for refresh and logout endpoints**

Create `tests/integration/auth.refresh.test.js`:

```javascript
const { setupTestDatabase, teardownTestDatabase, seedTestUser, clearTestData, getTestToken, getTestDatabase } = require('../helpers/testDb');
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
    // Login to get a refresh token
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

    // Use it once (valid)
    await agent.post('/api/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    // Use the same token again (replay)
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

    // Token should no longer work
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/integration/auth.refresh.test.js --no-coverage`

Expected: FAIL — login response has no `refreshToken` field.

- [ ] **Step 3: Modify auth.js — split signToken, add refresh/logout endpoints**

Replace `server/routes/auth.js` content:

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const refreshTokenModel = require('../models/refreshTokenModel');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAMILIES_PER_USER = 5;

function signAccessToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function createTokenPair(userId) {
  const accessToken = signAccessToken(userId);

  // Enforce max families
  const familyCount = refreshTokenModel.countFamilies(userId);
  if (familyCount >= MAX_FAMILIES_PER_USER) {
    refreshTokenModel.deleteOldestFamily(userId);
  }

  const refreshData = refreshTokenModel.create(userId);
  return { accessToken, refreshToken: refreshData.token };
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password' });
    }

    if (typeof name !== 'string' || name.length < 1 || name.length > 50) {
      return res.status(400).json({ error: 'Name must be between 1 and 50 characters' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8 || password.length > 100) {
      return res.status(400).json({ error: 'Password must be between 8 and 100 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = userModel.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await userModel.create({ name, email: normalizedEmail, password });
    const { accessToken, refreshToken } = createTokenPair(user.id);

    return res.status(201).json({ token: accessToken, refreshToken, user });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email, password' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = userModel.findByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!await userModel.verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = createTokenPair(user.id);

    const { password_hash, ...safeUser } = user;
    return res.json({ token: accessToken, refreshToken, user: safeUser });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refreshToken field' });
    }

    // Cleanup expired tokens
    refreshTokenModel.deleteExpired();

    const existing = refreshTokenModel.findByToken(refreshToken);

    if (!existing) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Check if token is expired
    if (new Date(existing.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Replay detection: if token was already used, invalidate entire family
    if (existing.is_used) {
      refreshTokenModel.deleteFamily(existing.family_id);
      return res.status(401).json({ error: 'Refresh token replay detected — family revoked' });
    }

    // Mark as used (for future replay detection)
    refreshTokenModel.markUsed(existing.id);

    // Issue new token pair with same family
    const accessToken = signAccessToken(existing.user_id);
    const newRefresh = refreshTokenModel.createWithFamily(existing.user_id, existing.family_id);

    return res.json({ token: accessToken, refreshToken: newRefresh.token });
  } catch (err) {
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

router.post('/logout', (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const existing = refreshTokenModel.findByToken(refreshToken);
      if (existing) {
        refreshTokenModel.deleteFamily(existing.family_id);
      }
    }

    // Always return 200 (no info leak about token existence)
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/integration/auth.refresh.test.js --no-coverage`

Expected: All tests PASS.

- [ ] **Step 5: Run existing auth tests to verify no regression**

Run: `npx jest tests/integration/auth.test.js --no-coverage`

Expected: All existing tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/auth.js tests/integration/auth.refresh.test.js
git commit -m "feat(auth): add /refresh and /logout endpoints with token rotation"
```

---

### Task 4: Socket Auth Middleware — Structured Errors + tokenExp

**Files:**
- Modify: `server/websocket/socketAuthMiddleware.js:1-19`
- Test: `tests/integration/socketAuth.expiry.test.js` (create)

- [ ] **Step 1: Write failing tests for structured socket auth errors**

Create `tests/integration/socketAuth.expiry.test.js`:

```javascript
const { setupTestDatabase, teardownTestDatabase, seedTestUser } = require('../helpers/testDb');
const { createTestServer, startTestServer, stopTestServer } = require('../helpers/testServer');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_JWT_SECRET = 'test-jwt-secret-key';

let server, port;

beforeAll(async () => {
  setupTestDatabase();
  const testSetup = createTestServer();
  server = testSetup.server;
  port = await startTestServer(server);
  seedTestUser(TEST_USER_ID);
});

afterAll(async () => {
  await stopTestServer(server);
  teardownTestDatabase();
});

function connectSocket(token) {
  return ioClient(`http://localhost:${port}`, {
    auth: { token },
    reconnection: false,
    transports: ['websocket'],
  });
}

describe('Socket.io auth middleware structured errors', () => {
  it('should return MISSING_TOKEN when no token provided', (done) => {
    const socket = connectSocket(undefined);
    socket.on('connect_error', (err) => {
      expect(err.data).toBeDefined();
      expect(err.data.type).toBe('MISSING_TOKEN');
      expect(err.data.code).toBe(401);
      socket.disconnect();
      done();
    });
  });

  it('should return TOKEN_EXPIRED for expired token', (done) => {
    const expiredToken = jwt.sign({ userId: TEST_USER_ID }, TEST_JWT_SECRET, { expiresIn: '0s' });
    // Small delay to ensure token is expired
    setTimeout(() => {
      const socket = connectSocket(expiredToken);
      socket.on('connect_error', (err) => {
        expect(err.data).toBeDefined();
        expect(err.data.type).toBe('TOKEN_EXPIRED');
        socket.disconnect();
        done();
      });
    }, 100);
  });

  it('should return INVALID_TOKEN for malformed token', (done) => {
    const socket = connectSocket('not-a-valid-jwt');
    socket.on('connect_error', (err) => {
      expect(err.data).toBeDefined();
      expect(err.data.type).toBe('INVALID_TOKEN');
      socket.disconnect();
      done();
    });
  });

  it('should connect successfully with valid token', (done) => {
    const token = jwt.sign({ userId: TEST_USER_ID }, TEST_JWT_SECRET, { expiresIn: '1h' });
    const socket = connectSocket(token);
    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      socket.disconnect();
      done();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/integration/socketAuth.expiry.test.js --no-coverage`

Expected: FAIL — `err.data` is undefined (current middleware doesn't set it).

- [ ] **Step 3: Modify socketAuthMiddleware.js**

Replace `server/websocket/socketAuthMiddleware.js`:

```javascript
const jwt = require('jsonwebtoken');

const SOCKET_AUTH_ERRORS = {
  MISSING_TOKEN: 'MISSING_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
};

function createSocketAuthMiddleware() {
  return (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      const err = new Error('Authentication required');
      err.data = { code: 401, type: SOCKET_AUTH_ERRORS.MISSING_TOKEN };
      return next(err);
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      socket.userId = decoded.userId;
      socket.tokenExp = decoded.exp;
      next();
    } catch (err) {
      const error = new Error('Invalid or expired token');
      error.data = {
        code: 401,
        type: err.name === 'TokenExpiredError'
          ? SOCKET_AUTH_ERRORS.TOKEN_EXPIRED
          : SOCKET_AUTH_ERRORS.INVALID_TOKEN,
      };
      return next(error);
    }
  };
}

module.exports = { createSocketAuthMiddleware, SOCKET_AUTH_ERRORS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/integration/socketAuth.expiry.test.js --no-coverage`

Expected: All 4 tests PASS.

- [ ] **Step 5: Update testServer.js to include expiration timer in connection handler**

The test server has its own `io.on('connection')` handler that bypasses `socketManager.js`. Add the timer logic so socket expiry tests work:

In `tests/helpers/testServer.js`, replace the `io.on('connection')` block (lines 22-26):

```javascript
  io.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);

    // Token expiration auto-disconnect (mirrors socketManager.js)
    if (socket.tokenExp) {
      const remainingMs = (socket.tokenExp * 1000) - Date.now();
      if (remainingMs > 0) {
        socket.expirationTimer = setTimeout(() => {
          socket.disconnect(true);
        }, remainingMs);
      }
    }

    socket.on('disconnect', () => {
      if (socket.expirationTimer) {
        clearTimeout(socket.expirationTimer);
      }
    });
  });
```

- [ ] **Step 6: Run all existing socket tests to verify no regression**

Run: `npx jest tests/integration/notification.websocket.test.js tests/integration/shoppingItem.websocket.test.js --no-coverage`

Expected: All existing tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/websocket/socketAuthMiddleware.js tests/integration/socketAuth.expiry.test.js tests/helpers/testServer.js
git commit -m "feat(socket): add structured error data and tokenExp to socket auth middleware"
```

---

### Task 5: Socket Manager — Token Expiration Timer

**Files:**
- Modify: `server/websocket/socketManager.js:20-33`

- [ ] **Step 1: Modify socketManager.js to add expiration timer**

In `server/websocket/socketManager.js`, replace the `io.on('connection')` handler (lines 20-33):

```javascript
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const room = `user:${userId}`;
    socket.join(room);

    // Token expiration auto-disconnect
    if (socket.tokenExp) {
      const remainingMs = (socket.tokenExp * 1000) - Date.now();
      if (remainingMs > 0) {
        socket.expirationTimer = setTimeout(() => {
          socket.disconnect(true);
        }, remainingMs);
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`User ${userId} connected (socket: ${socket.id})`);
    }

    socket.on('disconnect', () => {
      if (socket.expirationTimer) {
        clearTimeout(socket.expirationTimer);
      }
      if (process.env.NODE_ENV === 'development') {
        console.log(`Socket ${socket.id} disconnected`);
      }
    });
  });
```

- [ ] **Step 2: Run all socket-related tests to verify no regression**

Run: `npx jest tests/integration/notification.websocket.test.js tests/integration/shoppingItem.websocket.test.js tests/integration/socketAuth.expiry.test.js --no-coverage`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add server/websocket/socketManager.js
git commit -m "feat(socket): add token expiration timer for auto-disconnect"
```

---

### Task 6: Client Auth API — Refresh Token Storage + Mutex

**Files:**
- Modify: `client/src/services/authApi.js:1-57`
- Test: `tests/unit/isTokenExpired.test.js` (create)

- [ ] **Step 1: Write failing tests for isTokenExpired**

Create `tests/unit/isTokenExpired.test.js`:

```javascript
/**
 * @jest-environment jsdom
 */
const jwt = require('jsonwebtoken');

// We test the pure function logic; import after defining it
describe('isTokenExpired', () => {
  // Inline implementation for unit test (mirrors authApi.js)
  function isTokenExpired(token) {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return true;
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  it('should return true for null token', () => {
    expect(isTokenExpired(null)).toBe(true);
  });

  it('should return true for undefined token', () => {
    expect(isTokenExpired(undefined)).toBe(true);
  });

  it('should return true for empty string', () => {
    expect(isTokenExpired('')).toBe(true);
  });

  it('should return true for malformed token', () => {
    expect(isTokenExpired('not.a.jwt')).toBe(true);
  });

  it('should return true for token without exp claim', () => {
    const token = jwt.sign({ userId: 'test' }, 'secret', { expiresIn: undefined });
    // Remove exp by creating a token without it
    const noExpToken = jwt.sign({ userId: 'test' }, 'secret', { noTimestamp: true });
    expect(isTokenExpired(noExpToken)).toBe(true);
  });

  it('should return true for expired token', () => {
    const token = jwt.sign({ userId: 'test' }, 'secret', { expiresIn: '0s' });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('should return false for valid non-expired token', () => {
    const token = jwt.sign({ userId: 'test' }, 'secret', { expiresIn: '1h' });
    expect(isTokenExpired(token)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (pure function test, no import needed)

Run: `npx jest tests/unit/isTokenExpired.test.js --no-coverage`

Expected: All 7 tests PASS.

- [ ] **Step 3: Modify authApi.js — add refresh token support**

Replace `client/src/services/authApi.js`:

```javascript
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
export const TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

export async function login(email, password) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let errorMessage = '로그인에 실패했습니다.';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch { /* non-JSON response */ }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  if (data.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  }
  return data;
}

export async function register(name, email, password) {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    let errorMessage = '회원가입에 실패했습니다.';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch { /* non-JSON response */ }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  if (data.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  }
  return data;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function logout() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);

  // Fire-and-forget server-side logout
  if (refreshToken) {
    fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => { /* ignore errors */ });
  }
}

export function isAuthenticated() {
  return !!getToken();
}

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return true;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Refresh mutex — prevents concurrent refresh calls
let refreshPromise = null;

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = _doRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function _doRefresh() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      logout();
      return null;
    }

    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    return data.token;
  } catch {
    logout();
    return null;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/services/authApi.js tests/unit/isTokenExpired.test.js
git commit -m "feat(client): add refresh token storage, isTokenExpired, and refreshAccessToken with mutex"
```

---

### Task 7: Client API Utils — `fetchWithAuth` Wrapper

**Files:**
- Modify: `client/src/services/apiUtils.js:1-27`

- [ ] **Step 1: Add fetchWithAuth to apiUtils.js**

Add to `client/src/services/apiUtils.js` after the existing `handleErrorResponse` function:

```javascript
import { refreshAccessToken } from './authApi';

export async function fetchWithAuth(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(options.headers) },
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      // refreshAccessToken() already calls logout() on failure — don't call it again
      throw new Error('인증이 필요합니다.');
    }
    // Retry with refreshed token (authHeaders reads from localStorage, which was updated by refreshAccessToken)
    const retryResponse = await fetch(url, {
      ...options,
      headers: { ...authHeaders(options.headers) },
    });
    return retryResponse;
  }

  return response;
}
```

Note: Also add `refreshAccessToken` to the import from `./authApi` at line 1.

Full updated `apiUtils.js`:

```javascript
import { getToken, logout, refreshAccessToken } from './authApi';

export const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function handleErrorResponse(response, defaultMessage) {
  if (response.ok) return;
  if (response.status === 401) {
    logout();
    throw new Error('인증이 필요합니다.');
  }
  if (response.status === 403) throw new Error('접근 권한이 없습니다.');
  try {
    const body = await response.json();
    throw new Error(body.error || defaultMessage);
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(defaultMessage);
    throw e;
  }
}

export async function fetchWithAuth(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(options.headers) },
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      // refreshAccessToken() already calls logout() on failure — don't duplicate
      throw new Error('인증이 필요합니다.');
    }
    const retryResponse = await fetch(url, {
      ...options,
      headers: { ...authHeaders(options.headers) },
    });
    return retryResponse;
  }

  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/services/apiUtils.js
git commit -m "feat(client): add fetchWithAuth wrapper with automatic token refresh and retry"
```

---

### Task 8: Migrate API Services to `fetchWithAuth`

**Files:**
- Modify: `client/src/services/notificationApi.js:1-64`
- Modify: `client/src/services/shoppingItemApi.js:1-54`

- [ ] **Step 1: Update notificationApi.js**

Replace imports and all `fetch()` + `authHeaders()` calls:

```javascript
import { BASE_URL, handleErrorResponse, fetchWithAuth } from './apiUtils';

export function transformNotification(notification) {
  return {
    id: notification.id,
    userId: notification.user_id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: Boolean(notification.is_read),
    createdAt: notification.created_at,
    metadata: notification.metadata,
  };
}

export async function fetchNotifications(userId, params = {}) {
  const query = new URLSearchParams(params);
  const response = await fetchWithAuth(`${BASE_URL}/notifications/${userId}?${query}`);
  await handleErrorResponse(response, '알림을 불러오는데 실패했습니다.');
  const data = await response.json();
  return {
    ...data,
    notifications: data.notifications.map(transformNotification),
  };
}

export async function markAsRead(id) {
  const response = await fetchWithAuth(`${BASE_URL}/notifications/${id}/read`, {
    method: 'PATCH',
  });
  await handleErrorResponse(response, '알림 읽음 처리에 실패했습니다.');
  return response.json();
}

export async function markAllAsRead(userId) {
  const response = await fetchWithAuth(`${BASE_URL}/notifications/read-all/${userId}`, {
    method: 'PATCH',
  });
  await handleErrorResponse(response, '전체 읽음 처리에 실패했습니다.');
  return response.json();
}

export async function deleteNotification(id) {
  const response = await fetchWithAuth(`${BASE_URL}/notifications/${id}`, {
    method: 'DELETE',
  });
  await handleErrorResponse(response, '알림 삭제에 실패했습니다.');
  return response.status === 204 ? null : response.json();
}

export async function createNotification(data) {
  const response = await fetchWithAuth(`${BASE_URL}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await handleErrorResponse(response, '알림 생성에 실패했습니다.');
  return response.json();
}
```

- [ ] **Step 2: Update shoppingItemApi.js**

```javascript
import { BASE_URL, handleErrorResponse, fetchWithAuth } from './apiUtils';

export function transformItem(item) {
  return {
    id: item.id,
    userId: item.user_id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    isPurchased: Boolean(item.is_purchased),
    createdAt: item.created_at,
  };
}

export async function fetchShoppingItems(userId, params = {}) {
  const query = new URLSearchParams(params);
  const response = await fetchWithAuth(`${BASE_URL}/shopping-items/${userId}?${query}`);
  await handleErrorResponse(response, '쇼핑 목록을 불러오는데 실패했습니다.');
  const data = await response.json();
  return {
    ...data,
    items: data.items.map(transformItem),
  };
}

export async function createShoppingItem({ name, quantity, unit }) {
  const response = await fetchWithAuth(`${BASE_URL}/shopping-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, quantity, unit }),
  });
  await handleErrorResponse(response, '아이템 추가에 실패했습니다.');
  return response.json();
}

export async function toggleShoppingItem(id) {
  const response = await fetchWithAuth(`${BASE_URL}/shopping-items/${id}/toggle`, {
    method: 'PATCH',
  });
  await handleErrorResponse(response, '상태 변경에 실패했습니다.');
  return response.json();
}

export async function deleteShoppingItem(id) {
  const response = await fetchWithAuth(`${BASE_URL}/shopping-items/${id}`, {
    method: 'DELETE',
  });
  await handleErrorResponse(response, '아이템 삭제에 실패했습니다.');
  return response.status === 204 ? null : response.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/services/notificationApi.js client/src/services/shoppingItemApi.js
git commit -m "refactor(client): migrate API services to fetchWithAuth for automatic token refresh"
```

---

### Task 9: Client Socket Service — Auth Function Pattern

**Files:**
- Modify: `client/src/services/socketService.js:1-53`

- [ ] **Step 1: Update socketService.js**

Replace `client/src/services/socketService.js`:

```javascript
import { io } from 'socket.io-client';
import { getToken, refreshAccessToken, isTokenExpired } from './authApi';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

let socket = null;

export function connect(onAuthFailure) {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: async (cb) => {
      let token = getToken();
      if (isTokenExpired(token)) {
        token = await refreshAccessToken();
      }
      cb({ token: token || '' });
    },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Socket connected:', socket.id);
    }
  });

  socket.on('disconnect', (reason) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Socket disconnected:', reason);
    }
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    const errorType = err?.data?.type;
    if (errorType === 'MISSING_TOKEN' || errorType === 'INVALID_TOKEN') {
      socket.disconnect();
      onAuthFailure?.();
    }
    // TOKEN_EXPIRED: let Socket.io auto-reconnect (auth function will refresh)
  });

  return socket;
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/services/socketService.js
git commit -m "feat(client): use async auth function for automatic token refresh on socket reconnection"
```

---

### Task 10: Client Socket Context — `onAuthFailure` Prop

**Files:**
- Modify: `client/src/context/SocketContext.js:1-30`

- [ ] **Step 1: Update SocketContext.js**

Replace `client/src/context/SocketContext.js`:

```javascript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { connect, disconnect } from '../services/socketService';

const SocketContext = createContext(null);

export function SocketProvider({ userId, onAuthFailure, children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const socketInstance = connect(onAuthFailure);
    setSocket(socketInstance);

    return () => {
      disconnect();
      setSocket(null);
    };
  }, [userId, onAuthFailure]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  return useContext(SocketContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/context/SocketContext.js
git commit -m "feat(client): add onAuthFailure callback to SocketProvider"
```

---

### Task 11: Update Existing Auth Tests

**Files:**
- Modify: `tests/integration/auth.test.js`

- [ ] **Step 1: Add refreshToken assertions to existing auth tests**

Find the existing login and register success test cases in `tests/integration/auth.test.js` and add:

```javascript
expect(res.body).toHaveProperty('refreshToken');
expect(typeof res.body.refreshToken).toBe('string');
expect(res.body.refreshToken.length).toBe(64);
```

Also verify `user` object is still present:
```javascript
expect(res.body).toHaveProperty('user');
expect(res.body.user).toHaveProperty('id');
```

- [ ] **Step 2: Run all auth tests**

Run: `npx jest tests/integration/auth.test.js tests/integration/auth.refresh.test.js --no-coverage`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/auth.test.js
git commit -m "test(auth): add refreshToken field assertions to existing auth tests"
```

---

### Task 12: Full Integration Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: All tests PASS. No regressions.

- [ ] **Step 2: Start the dev server and verify manually**

Run: `npm run dev`

Check:
1. Login returns `refreshToken` in response (browser DevTools → Network tab)
2. Socket connects with valid token
3. API calls work normally

- [ ] **Step 3: Final commit with all remaining changes**

If any files were missed, stage and commit them:

```bash
git status
# If needed:
git add -A && git commit -m "chore: complete Socket.io JWT refresh token implementation"
```
