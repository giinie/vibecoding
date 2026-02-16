const { transformNotification } = require('../../client/src/services/notificationApi');

describe('transformNotification', () => {
  test('converts is_read=0 to isRead=false', () => {
    const serverData = {
      id: '1',
      is_read: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      user_id: 'user-1',
    };
    const result = transformNotification(serverData);
    expect(result.isRead).toBe(false);
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.userId).toBe('user-1');
  });

  test('converts is_read=1 to isRead=true', () => {
    const serverData = {
      id: '1',
      is_read: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      user_id: 'user-1',
    };
    const result = transformNotification(serverData);
    expect(result.isRead).toBe(true);
  });

  test('preserves other fields unchanged', () => {
    const serverData = {
      id: 'abc-123',
      type: 'item_added',
      title: '장바구니 추가',
      message: '우유가 추가되었습니다',
      is_read: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      user_id: 'user-1',
      metadata: null,
    };
    const result = transformNotification(serverData);
    expect(result.id).toBe('abc-123');
    expect(result.type).toBe('item_added');
    expect(result.title).toBe('장바구니 추가');
    expect(result.message).toBe('우유가 추가되었습니다');
    expect(result.metadata).toBeNull();
  });

  test('handles metadata object correctly', () => {
    const serverData = {
      id: '1',
      is_read: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      user_id: 'user-1',
      metadata: { itemName: 'milk', quantity: 2 },
    };
    const result = transformNotification(serverData);
    expect(result.metadata).toEqual({ itemName: 'milk', quantity: 2 });
  });
});

describe('fetchNotifications applies transformation', () => {
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

  test('returned notifications have camelCase fields', async () => {
    const { fetchNotifications } = require('../../client/src/services/notificationApi');

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
            {
              id: '2',
              user_id: 'user-1',
              type: 'reminder',
              title: 'Reminder',
              message: 'reminder msg',
              is_read: 1,
              created_at: '2026-01-02T00:00:00.000Z',
              metadata: null,
            },
          ],
          total: 2,
          unread_count: 1,
        }),
    });

    const data = await fetchNotifications('user-1');
    expect(data.notifications[0].isRead).toBe(false);
    expect(data.notifications[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(data.notifications[0].userId).toBe('user-1');
    expect(data.notifications[1].isRead).toBe(true);
    expect(data.total).toBe(2);
    expect(data.unread_count).toBe(1);
  });
});
