# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shopping list app with a real-time notification system and JWT authentication. Monorepo structure with an Express.js backend and a React (CRA) frontend, communicating via REST API and WebSocket (Socket.io).

> **TL;DR Critical Constraints**: `JWT_SECRET` env required (server exits without it). Tests: call `setupTestDatabase()` before `createTestServer()`. All `userId` params must be UUID v4. SQLite booleans need `Boolean()` transform at API boundary. Use `fetchWithAuth()` from `apiUtils.js` for all authenticated API calls (handles token refresh automatically). Access token default TTL is `15m`; refresh token TTL is `7d`.

@WORKFLOW_ORCHESTRATION.md

## Critical Rules

**Auth & Security**
- **MUST** set `JWT_SECRET` in `.env` before starting the server — it exits immediately without it. Tests set `process.env.JWT_SECRET = 'test-jwt-secret-key'` in `setupTestDatabase()`.
- **MUST** use `fetchWithAuth()` from `apiUtils.js` for all authenticated API calls — it transparently retries with a refreshed access token on 401, then throws if refresh fails (which also calls `logout()`). Both `notificationApi.js` and `shoppingItemApi.js` have been migrated to `fetchWithAuth()`.
- **MUST NOT** log secrets or passwords outside `NODE_ENV === 'development'`. `seed.js` guards password output with this check. Any new seed/debug scripts must follow the same pattern.
- **MUST** pass `corsOrigin` explicitly to `initializeSocket()`. The function warns if no origin is provided, but falls back to `localhost:3000` for development convenience. Always set `CORS_ORIGIN` in production.

**Testing**
- **MUST** call `setupTestDatabase()` before `createTestServer()` in tests — order matters because tests monkey-patch `server/db/connection.js` via module cache. Reversing the order breaks test isolation.
- **MUST** use UUID v4 format for any `userId` route parameter in tests. The default `test-user-1` string will be rejected by `validateUuid` middleware. Use `crypto.randomUUID()` or a fixed UUID like `'550e8400-e29b-41d4-a716-446655440000'`. **Note**: `seedTestUser()` defaults to `'test-user-1'` — always pass an explicit UUID: `seedTestUser('550e8400-e29b-41d4-a716-446655440000')`.

**API & Data**
- **MUST** transform boolean columns at the API boundary. SQLite returns integer (0/1), client-side uses boolean. Use `Boolean(notification.is_read)` (see `transformNotification` in `notificationApi.js`) and `Boolean(item.is_purchased)` (see `transformItem` in `shoppingItemApi.js`).
- **MUST** validate notification create fields: `user_id` (UUID v4), `type` (enum: `item_added`, `item_purchased`, `list_shared`, `reminder`), `title` (max 255 chars), `message` (max 2000 chars), `metadata` (max 10KB JSON).
- **MUST** validate shopping item create fields: `name` (non-empty string, max 200 chars), `quantity` (positive integer, max 10000, default 1), `unit` (optional string, max 20 chars).

## Toolchain

This project uses **npm** (not pnpm/bun). Respect the existing toolchain per `USER_REQUIREMENTS.md` policy.

## First-time Setup

```bash
cp .env.example .env          # Fill in JWT_SECRET (required)
npm install && npm --prefix client install
npm run migrate                # Auto-runs on server start too
npm run seed                   # Optional: insert sample data
npm run dev                    # Starts both server (3001) and client (3000)
```

## Commands

```bash
npm run dev                    # Both server + client concurrently
npm run server                 # Server only (nodemon, port 3001)
npm run client                 # Client only (CRA dev server, port 3000)
npm test                       # All tests (unit + integration)
npm run test:integration       # Integration tests only
npx jest tests/integration/notification.api.test.js  # Single test file
npm run migrate                # DB migration (also auto-runs on start)
npm run seed                   # Seed sample data
```

## Key Patterns

### Database & Server

- **DB connection singleton**: `getDatabase()` lazily creates the connection. WHY: lazy init allows tests to monkey-patch `connection.js` before the module loads — eager init would prevent injection.
- **Migration lifecycle**: `migrate()` does NOT close the DB connection — callers manage lifecycle. Only the CLI entry (`require.main === module`) calls `closeDatabase()`. WHY: prevents the server from closing and re-opening the connection on every startup.
- **UUID primary keys**: All entities use `uuid` v4, generated server-side. WHY: avoids integer ID enumeration attacks.
- **UUID_REGEX shared constant**: Defined and exported from `validateUuid.js`. The controller imports it for body-field validation. WHY: single source of truth prevents regex drift.
- **CORS_ORIGIN**: Defined once in `index.js` and passed to both Express CORS middleware and `initializeSocket()`. WHY: single config point prevents HTTP/WebSocket CORS drift.
- **WebSocket event flow**: Controller actions emit Socket.io events after DB writes. The client `useSocket` hook subscribes for real-time UI updates.

### Auth & Refresh Token System

- **JWT auth flow**: `authenticate` extracts `Bearer <token>`, verifies with HS256, sets `req.userId`. `authorizeUser` checks `req.params.userId === req.userId`. Token signing uses `signAccessToken()` in `auth.js`. TTLs: see TL;DR.
- **Refresh token rotation**: `POST /api/auth/refresh` consumes the current refresh token, issues a new access + refresh pair in the same family. Replay detection: if a used token is replayed, the entire family is revoked. Max 5 concurrent families per user (oldest evicted).
- **Logout flow**: `POST /api/auth/logout` accepts `{ refreshToken }` and deletes the entire token family server-side. Client `logout()` in `authApi.js` clears both `TOKEN_KEY` and `REFRESH_TOKEN_KEY` from `localStorage` and fires the server call fire-and-forget.
- **Token access**: All client modules MUST use `getToken()` from `authApi.js` to read the JWT access token and `REFRESH_TOKEN_KEY` for the refresh token. Never access `localStorage` directly for tokens.
- **Refresh mutex**: `refreshAccessToken()` in `authApi.js` uses a module-level promise to deduplicate concurrent refresh calls — only one `/auth/refresh` request fires regardless of how many API calls trigger it simultaneously.
- **isTokenExpired()**: Client-side JWT expiry check (parses `exp` claim from base64 payload). Used by `socketService.js` to proactively refresh before connecting. Returns `true` for null/invalid tokens.

### Client API Utilities

- **`fetchWithAuth()`**: Wraps `fetch()` with 401 retry via token refresh. On unrecoverable failure, throws `'인증이 필요합니다.'` — `refreshAccessToken()` already calls `logout()` internally, do not call it again. `handleErrorResponse()` is a legacy fallback for non-`fetchWithAuth` paths. **Prefer `fetchWithAuth()` for new code.**
- **Shared API utilities**: `BASE_URL`, `authHeaders()`, `handleErrorResponse()`, and `fetchWithAuth()` live in `apiUtils.js`. All API service modules (`notificationApi.js`, `shoppingItemApi.js`) import from here. Use `getToken()` from `authApi.js` for token access — never read `localStorage` directly.

### Testing

- **Module cache clearing in tests**: `teardownTestDatabase()` deletes `require.cache` entries for all server modules. WHY: ensures fresh state between test suites when DB connection is replaced.
- **Test auth helpers**: `seedTestUser(userId)` inserts user with pre-hashed password. `getTestToken(userId)` creates JWT. Always seed user before creating token. See Critical Rules for UUID requirement.

### UI State

- **useNotifications return values**: Returns `hasUnread` (boolean) derived from `unreadCount`. `NotificationDropdown` and `NotificationList` currently compute `hasUnread` locally via `notifications.some(n => !n.isRead)` — prefer using `hasUnread` from `useNotifications()` when refactoring.
- **Pagination constant**: `ITEMS_PER_PAGE = 5` in `useNotifications.js`. Hardcoded — do not add a separate constant elsewhere.

## Environment Variables

Required in `.env` (server):

- `JWT_SECRET` — JWT signing secret (**required**, server exits without it)
- `JWT_EXPIRES_IN` — Access token expiry (default: `15m`)
- `PORT` — Server port (default: `3001`)
- `CORS_ORIGIN` — Allowed origin (default: `http://localhost:3000`)
- `TRUST_PROXY` — Set for reverse proxy environments
- `NODE_ENV` — `development` enables verbose error messages and socket logs

Optional in `client/.env` (CRA prefix required):

- `REACT_APP_API_URL` — API base URL (default: `http://localhost:3001/api`)
- `REACT_APP_SOCKET_URL` — WebSocket server URL (default: `http://localhost:3001`)

> **Note**: `REACT_APP_API_URL` uses absolute URLs, which bypass the CRA proxy in `client/package.json`. The proxy only applies when using relative fetch paths (e.g., `/api/...`). When `REACT_APP_API_URL` is set, the proxy has no effect.

## Architecture

### Server (`server/`)

Layered architecture with JWT auth and WebSocket side-channel:

```text
server/index.js                          → Express bootstrap, security middleware, graceful shutdown
server/routes/auth.js                    → POST /register, POST /login, POST /refresh, POST /logout
server/routes/notifications.js           → Notification CRUD routes (JWT required)
server/controllers/notificationController.js → Request handling, delegates to models
server/middleware/auth.js                → JWT authenticate + authorizeUser middleware
server/middleware/validateUuid.js         → UUID format validation middleware + UUID_REGEX export
server/models/notificationModel.js       → Notification data access (better-sqlite3)
server/models/userModel.js               → User CRUD with bcrypt password hashing
server/models/refreshTokenModel.js       → Refresh token CRUD (create, rotate, revoke family, expire)
server/db/connection.js                  → Singleton DB connection (lazy-initialized)
server/db/schema.sql                     → Table definitions (users, notifications, shopping_items, refresh_tokens)
server/db/migrate.js                     → Runs schema.sql against the DB
server/websocket/socketManager.js        → Socket.io init, room management
server/websocket/socketAuthMiddleware.js → JWT auth for WebSocket connections; exports SOCKET_AUTH_ERRORS, sets socket.tokenExp
server/websocket/notificationEmitter.js  → Event emitters (new, read, read-all)
server/routes/shoppingItems.js           → Shopping item CRUD routes (JWT required)
server/controllers/shoppingItemController.js → Request handling, delegates to shoppingItemModel
server/models/shoppingItemModel.js       → Shopping item data access (better-sqlite3)
server/websocket/shoppingItemEmitter.js  → Event emitters (new, toggled, deleted)
```

- **Database**: SQLite via `better-sqlite3` (synchronous API). WAL mode + foreign keys enabled. `notifications` table: composite indexes on `(user_id, created_at DESC)` and `(user_id, is_read)`. `shopping_items` table: composite indexes on `(user_id, created_at DESC)` and `(user_id, is_purchased)`. `refresh_tokens` table: indexes on `user_id`, `token`, `family_id`, `expires_at`; columns `is_used` (INTEGER) and `family_id` (UUID) support rotation and replay detection.
- **WebSocket**: JWT auth via `socket.handshake.auth.token` (async auth function — refreshes token before connecting if expired). `socketAuthMiddleware` sets `socket.tokenExp` (JWT `exp` claim). `socketManager` starts a `setTimeout` on connect that auto-disconnects the socket when the access token expires, forcing the client to reconnect with a fresh token. Users join room `user:{userId}`. Notification events: `notification:new`, `notification:read`, `notification:read-all`. Shopping item events: `shoppingItem:new`, `shoppingItem:toggled`, `shoppingItem:deleted`.
- **WebSocket error codes**: `SOCKET_AUTH_ERRORS.MISSING_TOKEN`, `SOCKET_AUTH_ERRORS.TOKEN_EXPIRED`, `SOCKET_AUTH_ERRORS.INVALID_TOKEN`. `socketService.js` handles: `TOKEN_EXPIRED` → let Socket.io auto-reconnect (auth function will refresh); `MISSING_TOKEN` / `INVALID_TOKEN` → disconnect and call `onAuthFailure()`.
- **Notification types** (CHECK constraint): `item_added`, `item_purchased`, `list_shared`, `reminder`.

### Security

- **helmet** for HTTP security headers
- **express-rate-limit**: Auth 20 req/15min, API 100 req/15min
- **JSON body limit**: 10kb
- **CORS**: Configurable via `CORS_ORIGIN` env var
- **JWT**: HS256 algorithm, `JWT_SECRET` required. Access token TTL `15m`, refresh token TTL `7d`.
- **Refresh token rotation**: single-use tokens with family tracking; replay revokes entire family. Max 5 families per user.
- **Password hashing**: bcryptjs, 10 salt rounds
- **UUID validation**: All route params validated against UUID format

### Client (`client/`)

React 18 app (CRA) with custom hooks pattern:

```text
client/src/context/SocketContext.js       → React Context providing socket instance; accepts onAuthFailure prop
client/src/hooks/useSocket.js            → Subscribe to WebSocket notification events
client/src/hooks/useNotifications.js     → Full notification state management (CRUD + real-time)
client/src/services/notificationApi.js   → Notification API client functions
client/src/services/authApi.js           → Auth API client (register, login, logout, refreshAccessToken, isTokenExpired)
client/src/services/socketService.js     → Socket connection manager
client/src/components/NotificationBell.js     → Bell icon with unread count badge
client/src/components/NotificationDropdown.js → Notification dropdown panel
client/src/components/NotificationList.js     → Notification list view
client/src/components/NotificationItem.js     → Single notification item
client/src/components/ErrorBoundary.js        → React error boundary wrapper
client/src/services/apiUtils.js              → Shared API utilities (BASE_URL, authHeaders, handleErrorResponse, fetchWithAuth)
client/src/services/shoppingItemApi.js       → Shopping item API client + transformItem()
client/src/hooks/useShoppingItems.js         → Shopping item state management (CRUD + real-time, pagination)
client/src/components/ShoppingItemInput.js   → Add item form (name, quantity, unit)
client/src/components/ShoppingItemList.js    → Shopping item list with toggle/delete/load-more
```

- Access token stored in `localStorage` under `TOKEN_KEY`; refresh token under `REFRESH_TOKEN_KEY` (both constants defined in `authApi.js`). All modules access the access token via `getToken()` — never read `localStorage` directly.
- `App.js` implements JWT login/logout flow; `userId` from login response, managed in React state. Pass `onAuthFailure` to `SocketProvider` to handle unrecoverable socket auth failures (e.g., force logout).

### Tests (`tests/`)

Integration and unit tests using Jest + Supertest with in-memory SQLite:

- `tests/helpers/testDb.js` — Creates `:memory:` SQLite DB, monkey-patches connection module. Provides `seedTestUser()`, `getTestToken()`, `clearTestData()`.
- `tests/helpers/testServer.js` — Spins up Express + Socket.io on random port.
- `tests/integration/` — 9 suites: `auth.test.js`, `auth.refresh.test.js` (refresh/logout/replay), `notification.api.test.js`, `notification.auth.test.js`, `notification.flow.test.js`, `notification.websocket.test.js`, `shoppingItem.api.test.js`, `shoppingItem.websocket.test.js`, `socketAuth.expiry.test.js` (token expiry disconnect).
- `tests/unit/` — 4 suites: `notificationApi.test.js`, `notificationTransform.test.js`, `refreshTokenModel.test.js`, `isTokenExpired.test.js`.

### API Endpoints

Auth (`/api/auth`, rate-limited 20 req/15min):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create user account (name, email, password); returns `{ token, refreshToken, user }` |
| POST | `/login` | Authenticate; returns `{ token, refreshToken, user }` |
| POST | `/refresh` | Exchange refresh token for new access + refresh token pair (rotation) |
| POST | `/logout` | Revoke refresh token family server-side |

Notifications (`/api/notifications`, JWT required, rate-limited 100 req/15min):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create notification |
| GET | `/:userId` | List notifications (query: `unread_only`, `limit`, `offset`) |
| PATCH | `/:id/read` | Mark single as read |
| PATCH | `/read-all/:userId` | Mark all as read |
| DELETE | `/:id` | Delete notification |

Shopping Items (`/api/shopping-items`, JWT required, rate-limited 100 req/15min):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create shopping item (name, quantity?, unit?) |
| GET | `/:userId` | List items (query: `limit`, `offset`); ordered unpurchased-first |
| PATCH | `/:id/toggle` | Toggle purchased status |
| DELETE | `/:id` | Delete shopping item |

### Documentation (`docs/`)

See `docs/` for security audits, session reports, slop cleanup reports, and architecture plans. Key docs: `ai-skills-usage-guide.md` (AI skills usage), `security-cross-verification-2026-03-07.md` (latest security audit; N-4 token revocation partially resolved).
