# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules

- **MUST** set `JWT_SECRET` in `.env` before starting the server — it exits immediately without it. Tests set `process.env.JWT_SECRET = 'test-jwt-secret-key'` in `setupTestDatabase()`.
- **MUST** call `setupTestDatabase()` before `createTestServer()` in tests — order matters because tests monkey-patch `server/db/connection.js` via module cache. Reversing the order breaks test isolation.
- **MUST** use UUID v4 format for any `userId` route parameter in tests. The default `test-user-1` string will be rejected by `validateUuid` middleware. Use `crypto.randomUUID()` or a fixed UUID like `'550e8400-e29b-41d4-a716-446655440000'`. **Note**: `seedTestUser()` defaults to `'test-user-1'` — always pass an explicit UUID: `seedTestUser('550e8400-e29b-41d4-a716-446655440000')`.
- **MUST** transform `is_read` at the API boundary. SQLite returns integer (0/1), client-side uses boolean. Use `Boolean(notification.is_read)` (see `transformNotification` in `notificationApi.js`).
- **MUST** use `handleErrorResponse()` in `notificationApi.js` for all new API functions — it calls `logout()` on 401 to preserve the auto-logout contract.
- **MUST** validate notification create fields: `user_id` (UUID v4), `type` (enum: `item_added`, `item_purchased`, `list_shared`, `reminder`), `title` (max 255 chars), `message` (max 2000 chars), `metadata` (max 10KB JSON).
- **MUST NOT** log secrets or passwords outside `NODE_ENV === 'development'`. `seed.js` guards password output with this check. Any new seed/debug scripts must follow the same pattern.
- **MUST** pass `corsOrigin` explicitly to `initializeSocket()`. The function warns if no origin is provided, but falls back to `localhost:3000` for development convenience. Always set `CORS_ORIGIN` in production.

## Project Overview

Shopping list app with a real-time notification system and JWT authentication. Monorepo structure with an Express.js backend and a React (CRA) frontend, communicating via REST API and WebSocket (Socket.io).

## First-time Setup

```bash
cp .env.example .env          # Fill in JWT_SECRET (required)
npm install && cd client && npm install && cd ..
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

- **DB connection singleton**: `getDatabase()` lazily creates the connection. WHY: lazy init allows tests to monkey-patch `connection.js` before the module loads — eager init would prevent injection.
- **Migration lifecycle**: `migrate()` does NOT close the DB connection — callers manage lifecycle. Only the CLI entry (`require.main === module`) calls `closeDatabase()`. WHY: prevents the server from closing and re-opening the connection on every startup.
- **Module cache clearing in tests**: `teardownTestDatabase()` deletes `require.cache` entries for all server modules. WHY: ensures fresh state between test suites when DB connection is replaced.
- **WebSocket event flow**: Controller actions emit Socket.io events after DB writes. The client `useSocket` hook subscribes for real-time UI updates.
- **UUID_REGEX shared constant**: Defined and exported from `validateUuid.js`. The controller imports it for body-field validation. WHY: single source of truth prevents regex drift.
- **UUID primary keys**: All entities use `uuid` v4, generated server-side. WHY: avoids integer ID enumeration attacks.
- **JWT auth flow**: `authenticate` extracts `Bearer <token>`, verifies with HS256, sets `req.userId`. `authorizeUser` checks `req.params.userId === req.userId`. Token signing uses `signToken()` helper in `auth.js`.
- **CORS_ORIGIN**: Defined once in `index.js` and passed to both Express CORS middleware and `initializeSocket()`. WHY: single config point prevents HTTP/WebSocket CORS drift.
- **Token access**: All client modules MUST use `getToken()` from `authApi.js` to read the JWT token. Never access `localStorage` directly for the token.
- **Test auth helpers**: `seedTestUser(userId)` inserts user with pre-hashed password. `getTestToken(userId)` creates JWT. Always seed user before creating token. **Caution**: `seedTestUser()` defaults to non-UUID `'test-user-1'` — always pass an explicit UUID.
- **Auto-logout on 401**: `handleErrorResponse()` in `notificationApi.js` calls `logout()` on 401. All API functions MUST use this helper.
- **useNotifications return values**: Returns `hasUnread` (boolean) derived from `unreadCount`. `NotificationDropdown` and `NotificationList` currently compute `hasUnread` locally via `notifications.some(n => !n.isRead)` — prefer using `hasUnread` from `useNotifications()` when refactoring.
- **Pagination constant**: `ITEMS_PER_PAGE = 5` in `useNotifications.js`. Hardcoded — do not add a separate constant elsewhere.

## Environment Variables

Required in `.env` (server):

- `JWT_SECRET` — JWT signing secret (**required**, server exits without it)
- `JWT_EXPIRES_IN` — Token expiry (default: `7d`)
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

```
server/index.js                          → Express bootstrap, security middleware, graceful shutdown
server/routes/auth.js                    → POST /register, POST /login
server/routes/notifications.js           → Notification CRUD routes (JWT required)
server/controllers/notificationController.js → Request handling, delegates to models
server/middleware/auth.js                → JWT authenticate + authorizeUser middleware
server/middleware/validateUuid.js         → UUID format validation middleware + UUID_REGEX export
server/models/notificationModel.js       → Notification data access (better-sqlite3)
server/models/userModel.js               → User CRUD with bcrypt password hashing
server/db/connection.js                  → Singleton DB connection (lazy-initialized)
server/db/schema.sql                     → Table definitions (users, notifications)
server/db/migrate.js                     → Runs schema.sql against the DB
server/websocket/socketManager.js        → Socket.io init, room management
server/websocket/socketAuthMiddleware.js → JWT auth for WebSocket connections
server/websocket/notificationEmitter.js  → Event emitters (new, read, read-all)
```

- **Database**: SQLite via `better-sqlite3` (synchronous API). WAL mode + foreign keys enabled. Composite indexes on `(user_id, created_at DESC)` and `(user_id, is_read)`.
- **WebSocket**: JWT auth via `socket.handshake.auth.token`. Users join room `user:{userId}`. Events: `notification:new`, `notification:read`, `notification:read-all`.
- **Notification types** (CHECK constraint): `item_added`, `item_purchased`, `list_shared`, `reminder`.

### Security

- **helmet** for HTTP security headers
- **express-rate-limit**: Auth 20 req/15min, API 100 req/15min
- **JSON body limit**: 10kb
- **CORS**: Configurable via `CORS_ORIGIN` env var
- **JWT**: HS256 algorithm, `JWT_SECRET` required
- **Password hashing**: bcryptjs, 10 salt rounds
- **UUID validation**: All route params validated against UUID format

### Client (`client/`)

React 18 app (CRA) with custom hooks pattern:

```
client/src/context/SocketContext.js       → React Context providing socket instance
client/src/hooks/useSocket.js            → Subscribe to WebSocket notification events
client/src/hooks/useNotifications.js     → Full notification state management (CRUD + real-time)
client/src/services/notificationApi.js   → Notification API client functions
client/src/services/authApi.js           → Auth API client (register, login)
client/src/services/socketService.js     → Socket connection manager
client/src/components/NotificationBell.js     → Bell icon with unread count badge
client/src/components/NotificationDropdown.js → Notification dropdown panel
client/src/components/NotificationList.js     → Notification list view
client/src/components/NotificationItem.js     → Single notification item
client/src/components/ErrorBoundary.js        → React error boundary wrapper
```

- JWT token stored in `localStorage` under `TOKEN_KEY` constant (defined in `authApi.js`). All modules access the token via `getToken()` from `authApi.js` — never read `localStorage` directly.
- `App.js` implements JWT login/logout flow; `userId` from login response, managed in React state.

### Tests (`tests/`)

Integration and unit tests using Jest + Supertest with in-memory SQLite:

- `tests/helpers/testDb.js` — Creates `:memory:` SQLite DB, monkey-patches connection module. Provides `seedTestUser()`, `getTestToken()`, `clearTestData()`.
- `tests/helpers/testServer.js` — Spins up Express + Socket.io on random port.
- `tests/integration/` — 5 suites: `auth.test.js`, `notification.api.test.js`, `notification.auth.test.js`, `notification.flow.test.js`, `notification.websocket.test.js`.
- `tests/unit/` — 2 suites: `notificationApi.test.js`, `notificationTransform.test.js`.

### API Endpoints

Auth (`/api/auth`, rate-limited 20 req/15min):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create user account (name, email, password) |
| POST | `/login` | Authenticate and receive JWT token |

Notifications (`/api/notifications`, JWT required, rate-limited 100 req/15min):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create notification |
| GET | `/:userId` | List notifications (query: `unread_only`, `limit`, `offset`) |
| PATCH | `/:id/read` | Mark single as read |
| PATCH | `/read-all/:userId` | Mark all as read |
| DELETE | `/:id` | Delete notification |

### Documentation (`docs/`)

- `security-recommendations.md` — Security audit findings and remediation plan (all items resolved)
- `security-audit-followup-report.md` — Post-audit verification results
- `collaborator-review.md` — Collaborator code review notes
- `slop-cleanup-report.md` — AI slop cleanup scan results
- `session-report-2026-02-23.md` — Session work log (docs sync, perf analysis, cross-verification)
- `session-report-2026-02-25.md` — Session work log (deslop apply, cross-verification, docs update)
- `security-cross-verification-2026-03-07.md` — Cross-verification of security audit (9 existing items re-confirmed, 6 new findings, 2 HIGH fixed)
