import { BASE_URL, handleErrorResponse, fetchWithAuth } from './apiUtils';

export function transformRecommendation(item) {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity || 1,
    unit: item.unit || null,
    reason: item.reason || '',
    type: item.type || 'staple',
  };
}

export async function fetchRecommendations(userId) {
  const response = await fetchWithAuth(`${BASE_URL}/recommendations/${userId}`);
  await handleErrorResponse(response, '추천 목록을 불러오는데 실패했습니다.');
  const data = await response.json();
  return {
    recommendations: data.recommendations.map(transformRecommendation),
  };
}
