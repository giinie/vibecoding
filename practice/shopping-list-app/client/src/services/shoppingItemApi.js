import { BASE_URL, authHeaders, handleErrorResponse } from './apiUtils';

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
  const response = await fetch(`${BASE_URL}/shopping-items/${userId}?${query}`, {
    headers: authHeaders(),
  });
  await handleErrorResponse(response, '쇼핑 목록을 불러오는데 실패했습니다.');
  const data = await response.json();
  return {
    ...data,
    items: data.items.map(transformItem),
  };
}

export async function createShoppingItem({ name, quantity, unit }) {
  const response = await fetch(`${BASE_URL}/shopping-items`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name, quantity, unit }),
  });
  await handleErrorResponse(response, '아이템 추가에 실패했습니다.');
  return response.json();
}

export async function toggleShoppingItem(id) {
  const response = await fetch(`${BASE_URL}/shopping-items/${id}/toggle`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  await handleErrorResponse(response, '상태 변경에 실패했습니다.');
  return response.json();
}

export async function deleteShoppingItem(id) {
  const response = await fetch(`${BASE_URL}/shopping-items/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleErrorResponse(response, '아이템 삭제에 실패했습니다.');
  return response.status === 204 ? null : response.json();
}
