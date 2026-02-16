const BASE_URL = 'http://localhost:3001/api';
export const TOKEN_KEY = 'auth_token';

export async function login(email, password) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || '로그인에 실패했습니다.');
  }

  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  return data;
}

export async function register(name, email, password) {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || '회원가입에 실패했습니다.');
  }

  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  return data;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}
