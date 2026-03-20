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
