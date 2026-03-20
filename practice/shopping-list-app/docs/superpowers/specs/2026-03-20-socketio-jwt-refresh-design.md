# Socket.io JWT Authentication Improvement with Refresh Token

**Date**: 2026-03-20
**Status**: Approved (Rev 2 — post spec review)
**Scope**: Server + Client JWT auth flow, Socket.io middleware, token refresh

## Problem

The current implementation verifies JWT only at socket connection time. Once connected, sockets remain open indefinitely even after token expiration. Error messages are plain strings, preventing the client from making programmatic decisions. There is no token refresh mechanism — users must re-login when the 7-day token expires.

## Solution Overview

Introduce Access Token (15min) + Refresh Token (7d) separation. The server proactively disconnects sockets when access tokens expire. The client uses Socket.io's `auth` function pattern to automatically refresh tokens on every reconnection. Structured error data enables precise client-side error handling.

## Design

### 1. Database Schema Extension

Add `refresh_tokens` table:

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  family_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  is_used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

**Design decisions:**
- Refresh tokens are **opaque random strings** (crypto.randomBytes), NOT JWTs. No signature verification needed — the DB is the source of truth for validity.
- `family_id` enables replay detection: all tokens in the same family (originating from the same login) share a family ID. On replay, invalidate the entire family.
- `is_used` marks a token as consumed after rotation. A request with `is_used=1` triggers family-wide invalidation (replay attack).
- `ON DELETE CASCADE` ensures cleanup when users are deleted.
- **Max 5 active token families per user.** On the 6th login, the oldest family is deleted. Prevents unbounded row growth.

### 2. Token Lifecycle

| Token | Lifetime | Storage | Format | Purpose |
|-------|----------|---------|--------|---------|
| Access Token | 15 min | `localStorage` (`auth_token`) | JWT (HS256) | API + Socket auth |
| Refresh Token | 7 days | `localStorage` (`refresh_token`) | Opaque string (64 hex chars) | Access token renewal |

### 3. Security Considerations

**localStorage XSS risk**: Both tokens are stored in `localStorage`, which is accessible to any JavaScript on the page. This is a known tradeoff:

- **Why not httpOnly cookies**: The app uses `Authorization: Bearer` headers for REST API and `socket.handshake.auth.token` for Socket.io. Switching to cookies requires significant refactoring of both auth flows, CSRF protection, and changes to the CORS configuration. This is out of scope for this change.
- **Mitigations in place**: helmet CSP headers (via `server/index.js`), 10kb JSON body limit, CORS restricted to `CORS_ORIGIN`.
- **Future improvement**: Consider moving refresh token to httpOnly cookie in a follow-up if the auth flow is refactored to cookie-based.

**Refresh token replay detection**: Uses token family lineage. Each login creates a new family. Token rotation marks the old token as `is_used=1` but retains it. If a request arrives with an `is_used=1` token, ALL tokens in that family are deleted (full invalidation), forcing re-login on all sessions in that family.

**Password change invalidation**: When a user changes their password, delete ALL refresh tokens for that user. Not implemented in this spec (no password change endpoint exists yet), but the `DELETE FROM refresh_tokens WHERE user_id = ?` query is trivial to add.

### 4. New API Endpoints

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| POST | `/api/auth/refresh` | Exchange refresh token for new access + refresh pair | 20 req/15min (auth group) |
| POST | `/api/auth/logout` | Invalidate refresh token family (requires refresh token in body, no JWT required) | 20 req/15min (auth group) |

**Refresh endpoint behavior:**
1. Accepts `{ refreshToken }` in request body.
2. Looks up token in DB by exact match.
3. If `is_used = 1` → **replay detected**: delete all tokens with same `family_id`, return 401.
4. If not found or expired → return 401.
5. Mark current token as `is_used = 1`.
6. Generate new opaque refresh token with same `family_id`.
7. Issue new access token (JWT) + new refresh token.
8. Return `{ token, refreshToken }`.

**Logout endpoint**: Accepts `{ refreshToken }` in body (no JWT required — a user with an expired access token can still logout). Deletes all tokens in the same family.

**Login/Register response change** (preserves existing `user` field):
```json
{
  "token": "<access_token>",
  "refreshToken": "<refresh_token>",
  "user": { "id": "...", "name": "...", "email": "..." }
}
```

**Expired token cleanup**: On every refresh request, also run `DELETE FROM refresh_tokens WHERE expires_at < datetime('now')` to prune expired rows. Low cost since it piggybacks on an existing DB write.

### 5. Server Token Helpers

Split existing `signToken()` in `server/routes/auth.js`:

- `signAccessToken(userId)` — `expiresIn: process.env.JWT_EXPIRES_IN || '7d'` (Phase 2 keeps `7d` default; changed to `15m` only in Phase 4)
- `generateRefreshToken()` — `crypto.randomBytes(32).toString('hex')` (opaque, not JWT)

**Access token rejection of refresh tokens**: The `authenticate` middleware in `server/middleware/auth.js` already only accepts JWTs. Since refresh tokens are opaque strings (not JWTs), they cannot pass `jwt.verify()` and are automatically rejected. No middleware change needed.

### 6. Server Socket Auth Middleware

**File: `socketAuthMiddleware.js`**

Changes:
- Add `socket.tokenExp = decoded.exp` for expiration timer use.
- Replace plain `Error` messages with structured `error.data`:

```javascript
error.data = { code: 401, type: 'MISSING_TOKEN' | 'TOKEN_EXPIRED' | 'INVALID_TOKEN' }
```

Error type constants defined and exported from the same file:

```javascript
const SOCKET_AUTH_ERRORS = {
  MISSING_TOKEN: 'MISSING_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
};
```

### 7. Server Socket Manager — Expiration Timer

**File: `socketManager.js`**

After successful connection, set `setTimeout` based on `socket.tokenExp`:

```javascript
if (socket.tokenExp) {
  const remainingMs = (socket.tokenExp * 1000) - Date.now();
  if (remainingMs > 0) {
    socket.expirationTimer = setTimeout(() => {
      socket.disconnect(true);
    }, remainingMs);
  }
}

socket.on('disconnect', () => {
  if (socket.expirationTimer) clearTimeout(socket.expirationTimer);
});
```

- Max timer duration is 15 minutes (access token lifetime), no memory concern.
- `disconnect(true)` triggers client-side `disconnect` event with reason `io server disconnect`.

### 8. Client Auth API

**File: `authApi.js`**

New exports:
- `REFRESH_TOKEN_KEY = 'refresh_token'`
- `refreshAccessToken()` — calls `POST /api/auth/refresh`, stores new tokens, returns new access token or `null` on failure (calls `logout()` on failure). **Includes mutex** (see Section 10).
- `isTokenExpired(token)` — decodes JWT base64 payload, checks `exp` claim against `Date.now()`. Returns `true` for `null`, missing `exp`, or malformed tokens. No signature verification (server does that).

Modified:
- `login()`, `register()` — also store `refreshToken` from response.
- `logout()` — also removes `REFRESH_TOKEN_KEY` from localStorage. Calls `POST /api/auth/logout` with the refresh token (fire-and-forget, no await).

### 9. Client API Utils — `fetchWithAuth` Wrapper

**File: `apiUtils.js`**

**Critical design change** (from Rev 1): Instead of modifying `handleErrorResponse()` with a `retryable` error, introduce a new `fetchWithAuth(url, options)` wrapper that all API functions use:

```javascript
export async function fetchWithAuth(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(options.headers) },
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      logout();
      throw new Error('인증이 필요합니다.');
    }
    // Retry with new token
    const retryResponse = await fetch(url, {
      ...options,
      headers: { ...authHeaders(options.headers) },
    });
    return retryResponse;
  }

  return response;
}
```

- `handleErrorResponse()` remains unchanged — it still calls `logout()` on 401 as a safety net.
- API functions in `notificationApi.js` and `shoppingItemApi.js` replace `fetch()` + `authHeaders()` calls with `fetchWithAuth()`. The function signature is the same as `fetch()`, so changes are mechanical: `fetch(url, { headers: authHeaders() })` → `fetchWithAuth(url, {})`.
- One retry maximum — if the retry also returns 401, `handleErrorResponse` catches it normally.

### 10. Client Refresh Mutex

**File: `authApi.js`**

Prevents concurrent refresh requests from triggering replay detection:

```javascript
let refreshPromise = null;

export async function refreshAccessToken() {
  // If a refresh is already in flight, wait for it
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
  // MUST store tokens before returning — fetchWithAuth reads from localStorage on retry
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  return data.token;
}
```

All callers (socket `auth` function, `fetchWithAuth`) use the same `refreshAccessToken()`, so concurrent requests are deduplicated to a single HTTP call.

### 11. Client Socket Service

**File: `socketService.js`**

Core change — `auth` becomes an async function:

```javascript
socket = io(SOCKET_URL, {
  auth: async (cb) => {
    let token = getToken();
    if (isTokenExpired(token)) {
      token = await refreshAccessToken();
    }
    cb({ token: token || '' });
  },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

`connect_error` handler uses `err.data.type` for programmatic branching:

```javascript
socket.on('connect_error', (err) => {
  const errorType = err?.data?.type;
  if (errorType === 'MISSING_TOKEN' || errorType === 'INVALID_TOKEN') {
    // Permanent failure — refresh already attempted in auth function
    socket.disconnect();
  }
  // TOKEN_EXPIRED and network errors: let Socket.io auto-reconnect
  // (reconnection triggers auth function which refreshes the token)
});
```

**Key behavior**: `TOKEN_EXPIRED` does NOT disconnect — it allows Socket.io to auto-reconnect, which re-invokes the `auth` function and refreshes the token. Only `MISSING_TOKEN` and `INVALID_TOKEN` (permanent failures) cause disconnect.

### 12. Client Socket Context

**File: `SocketContext.js`**

Add optional `onAuthFailure` prop to `SocketProvider`. On permanent socket auth failure (MISSING_TOKEN, INVALID_TOKEN after refresh attempt), call `onAuthFailure()` so `App.js` can trigger logout UI flow.

## Testing Strategy

### New Test Files

| File | Coverage |
|------|----------|
| `tests/integration/auth.refresh.test.js` | Normal refresh, expired refresh token, replay detection (reuse triggers family invalidation), logout invalidation, concurrent refresh dedup, max 5 families per user |
| `tests/integration/socketAuth.expiry.test.js` | Expired access token rejection, server timer disconnect, structured `error.data` verification |
| `tests/unit/isTokenExpired.test.js` | Expired/valid/malformed/null/missing-exp token inputs |

### Modified Test Files

| File | Changes |
|------|---------|
| `tests/integration/auth.test.js` | Verify `refreshToken` in login/register responses, verify `user` object still present |
| `tests/helpers/testDb.js` | Include `refresh_tokens` migration, add `DELETE FROM refresh_tokens` in `clearTestData()` (before users delete), add `getExpiredTestToken()` helper |
| `tests/integration/notification.auth.test.js` | Verify structured error if applicable |

## Migration Plan

Deployed in 4 phases for backward compatibility:

1. **DB migration** — Add `refresh_tokens` table via `schema.sql`. No impact on existing tables.
2. **Server deploy** — Add `/refresh`, `/logout` endpoints. Add structured errors + timer to socket. `signAccessToken` defaults to `7d` (matching current behavior). Login/register responses add `refreshToken` field alongside existing `token` + `user`.
3. **Client deploy** — Update `authApi.js`, `socketService.js`, `apiUtils.js`, `SocketContext.js`, `notificationApi.js`, `shoppingItemApi.js`. Existing users without refresh token work normally; they re-login on next expiry.
4. **Lifetime switch** — Change `signAccessToken` default to `15m` (or set `JWT_EXPIRES_IN=15m` in `.env`). Existing 7d tokens remain valid until natural expiry.

## Files Changed

| File | Action |
|------|--------|
| `server/db/schema.sql` | Modify — add `refresh_tokens` table |
| `server/routes/auth.js` | Modify — add `/refresh`, `/logout`, split `signAccessToken`/`generateRefreshToken` |
| `server/models/userModel.js` | Modify — add refresh token CRUD methods (create, findByToken, markUsed, deleteFamily, deleteByUser, deleteExpired, countFamilies) |
| `server/websocket/socketAuthMiddleware.js` | Modify — structured errors, `tokenExp`, export `SOCKET_AUTH_ERRORS` |
| `server/websocket/socketManager.js` | Modify — expiration timer |
| `client/src/services/authApi.js` | Modify — refresh token storage, `refreshAccessToken()` with mutex, `isTokenExpired()`, logout cleanup |
| `client/src/services/socketService.js` | Modify — `auth` as async function, structured error handling |
| `client/src/services/apiUtils.js` | Modify — add `fetchWithAuth()` wrapper |
| `client/src/services/notificationApi.js` | Modify — replace `fetch()` + `authHeaders()` with `fetchWithAuth()` |
| `client/src/services/shoppingItemApi.js` | Modify — replace `fetch()` + `authHeaders()` with `fetchWithAuth()` |
| `client/src/context/SocketContext.js` | Modify — `onAuthFailure` prop |
| `tests/integration/auth.refresh.test.js` | New |
| `tests/integration/socketAuth.expiry.test.js` | New |
| `tests/unit/isTokenExpired.test.js` | New |
| `tests/helpers/testDb.js` | Modify — `refresh_tokens` migration + cleanup |
| `tests/integration/auth.test.js` | Modify — verify refresh token in responses |

## Decisions Log

| Decision | Rationale | Alternative Rejected |
|----------|-----------|---------------------|
| Opaque refresh token (not JWT) | DB is source of truth for validity; no need for signature verification. Prevents refresh tokens from being used as access tokens. | JWT refresh token — conflates two auth mechanisms, requires middleware change to reject |
| Token family with `is_used` flag | Enables replay detection without storing all revoked tokens. Single family invalidation limits blast radius. | Bcrypt hash comparison — expensive per-request, doesn't enable replay detection |
| `fetchWithAuth()` wrapper | Single retry point, mechanical migration for all API callers. No changes to `handleErrorResponse()`. | Retryable error pattern — requires modifying 10+ call sites with try/catch logic |
| Refresh mutex (client) | Prevents concurrent refresh calls from triggering server-side replay detection | Server-side grace period — adds complexity, still doesn't prevent wasted HTTP calls |
| localStorage for both tokens | Matches existing auth pattern, minimal refactoring | httpOnly cookies — requires full auth flow refactoring (CSRF, CORS, Socket.io auth) |
