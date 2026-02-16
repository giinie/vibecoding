const {
  fetchNotifications,
  markAllAsRead,
  deleteNotification,
} = require('../../client/src/services/notificationApi');

let originalFetch;

beforeEach(() => {
  originalFetch = global.fetch;
  global.localStorage = {
    getItem: () => 'test-token',
    setItem: () => {},
    removeItem: () => {},
  };
});

afterEach(() => {
  global.fetch = originalFetch;
  delete global.localStorage;
});

describe('fetchNotifications', () => {
  test('uses path parameter for userId instead of query parameter', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ notifications: [], total: 0, unread_count: 0 }),
    });

    await fetchNotifications('user-1', { limit: 5, offset: 0 });

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('/notifications/user-1');
    expect(calledUrl).not.toContain('userId=');
  });

  test('passes limit and offset as query parameters', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ notifications: [], total: 0, unread_count: 0 }),
    });

    await fetchNotifications('user-1', { limit: 10, offset: 5 });

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('offset=5');
  });

  test('sends Authorization header with Bearer token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ notifications: [], total: 0, unread_count: 0 }),
    });

    await fetchNotifications('user-1');

    const callOptions = global.fetch.mock.calls[0][1];
    expect(callOptions.headers['Authorization']).toBe('Bearer test-token');
  });
});

describe('markAllAsRead', () => {
  test('includes userId in URL path instead of request body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updated_count: 3 }),
    });

    await markAllAsRead('user-1');

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('/notifications/read-all/user-1');
  });

  test('does not send userId in the request body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updated_count: 3 }),
    });

    await markAllAsRead('user-1');

    const callOptions = global.fetch.mock.calls[0][1];
    if (callOptions.body) {
      const body = JSON.parse(callOptions.body);
      expect(body).not.toHaveProperty('userId');
    }
  });
});

describe('fetchNotifications transformation', () => {
  test('transforms server response notifications to camelCase', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          notifications: [
            {
              id: '1',
              user_id: 'user-1',
              type: 'item_added',
              title: 'Test',
              message: 'msg',
              is_read: 0,
              created_at: '2026-01-01T00:00:00.000Z',
              metadata: null,
            },
          ],
          total: 1,
          unread_count: 1,
        }),
    });

    const data = await fetchNotifications('user-1');
    expect(data.notifications[0].isRead).toBe(false);
    expect(data.notifications[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(data.notifications[0].userId).toBe('user-1');
  });

  test('sends offset instead of page parameter', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ notifications: [], total: 0, unread_count: 0 }),
    });

    await fetchNotifications('user-1', { offset: 5, limit: 5 });

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('offset=5');
    expect(calledUrl).not.toContain('page=');
  });
});

describe('deleteNotification', () => {
  test('handles 204 No Content without calling json()', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    });

    const result = await deleteNotification('some-id');
    expect(result).toBeNull();
  });

  test('still works for non-204 responses with JSON body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    const result = await deleteNotification('some-id');
    expect(result).toEqual({ success: true });
  });
});
