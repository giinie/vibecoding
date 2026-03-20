const jwt = require('jsonwebtoken');

describe('isTokenExpired', () => {
  // Pure function test - mirrors authApi.js implementation
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

  it('should return true for expired token', () => {
    const token = jwt.sign({ userId: 'test' }, 'secret', { expiresIn: '0s' });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('should return false for valid non-expired token', () => {
    const token = jwt.sign({ userId: 'test' }, 'secret', { expiresIn: '1h' });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('should return true for token without exp claim', () => {
    const token = jwt.sign({ userId: 'test' }, 'secret', { noTimestamp: true });
    expect(isTokenExpired(token)).toBe(true);
  });
});
