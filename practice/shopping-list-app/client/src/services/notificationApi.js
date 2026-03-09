import { BASE_URL, authHeaders, handleErrorResponse } from './apiUtils';

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
  const response = await fetch(`${BASE_URL}/notifications/${userId}?${query}`, {
    headers: authHeaders(),
  });
  handleErrorResponse(response, '알림을 불러오는데 실패했습니다.');
  const data = await response.json();
  return {
    ...data,
    notifications: data.notifications.map(transformNotification),
  };
}

export async function markAsRead(id) {
  const response = await fetch(`${BASE_URL}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  handleErrorResponse(response, '알림 읽음 처리에 실패했습니다.');
  return response.json();
}

export async function markAllAsRead(userId) {
  const response = await fetch(`${BASE_URL}/notifications/read-all/${userId}`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  handleErrorResponse(response, '전체 읽음 처리에 실패했습니다.');
  return response.json();
}

export async function deleteNotification(id) {
  const response = await fetch(`${BASE_URL}/notifications/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  handleErrorResponse(response, '알림 삭제에 실패했습니다.');
  return response.status === 204 ? null : response.json();
}

export async function createNotification(data) {
  const response = await fetch(`${BASE_URL}/notifications`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  handleErrorResponse(response, '알림 생성에 실패했습니다.');
  return response.json();
}
