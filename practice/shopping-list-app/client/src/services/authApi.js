const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
export const TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

export async function login(email, password) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let errorMessage = '로그인에 실패했습니다.';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch { /* non-JSON response */ }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  if (data.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  }
  return data;
}

export async function register(name, email, password) {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    let errorMessage = '회원가입에 실패했습니다.';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch { /* non-JSON response */ }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  if (data.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  }
  return data;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function logout() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);

  // Fire-and-forget server-side logout
  if (refreshToken) {
    fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => { /* ignore errors */ });
  }
}

export function isAuthenticated() {
  return !!getToken();
}

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return true;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Refresh mutex — prevents concurrent refresh calls
let refreshPromise = null;

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = _doRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function _doRefresh() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      logout();
      return null;
    }

    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    return data.token;
  } catch {
    logout();
    return null;
  }
}
