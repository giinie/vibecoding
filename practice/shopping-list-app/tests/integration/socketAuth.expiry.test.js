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
