import { getToken, logout } from './authApi';

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
