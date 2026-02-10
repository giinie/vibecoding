const BASE_URL = 'http://localhost:3001/api';

export async function fetchNotifications(userId, params = {}) {
  const query = new URLSearchParams({
    userId,
    ...params,
  });
  const response = await fetch(`${BASE_URL}/notifications?${query}`);
  if (!response.ok) {
    throw new Error('알림을 불러오는데 실패했습니다.');
  }
  return response.json();
}

export async function markAsRead(id) {
  const response = await fetch(`${BASE_URL}/notifications/${id}/read`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error('알림 읽음 처리에 실패했습니다.');
  }
  return response.json();
}

export async function markAllAsRead(userId) {
  const response = await fetch(`${BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    throw new Error('전체 읽음 처리에 실패했습니다.');
  }
  return response.json();
}

export async function deleteNotification(id) {
  const response = await fetch(`${BASE_URL}/notifications/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('알림 삭제에 실패했습니다.');
  }
  return response.json();
}

export async function createNotification(data) {
  const response = await fetch(`${BASE_URL}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('알림 생성에 실패했습니다.');
  }
  return response.json();
}
