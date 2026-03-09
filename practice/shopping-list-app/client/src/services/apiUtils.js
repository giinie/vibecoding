import { getToken, logout } from './authApi';

export const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function handleErrorResponse(response, defaultMessage) {
  if (response.status === 401) {
    logout();
    throw new Error('인증이 필요합니다.');
  }
  if (response.status === 403) throw new Error('접근 권한이 없습니다.');
  if (!response.ok) throw new Error(defaultMessage);
}
