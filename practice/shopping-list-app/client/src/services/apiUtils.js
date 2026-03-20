import { getToken, logout, refreshAccessToken } from './authApi';

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

export async function fetchWithAuth(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(options.headers) },
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      // refreshAccessToken() already calls logout() on failure — don't duplicate
      throw new Error('인증이 필요합니다.');
    }
    const retryResponse = await fetch(url, {
      ...options,
      headers: { ...authHeaders(options.headers) },
    });
    return retryResponse;
  }

  return response;
}
