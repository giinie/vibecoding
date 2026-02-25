# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shopping list app with a real-time notification system and JWT authentication. Monorepo structure with an Express.js backend and a React (CRA) frontend, communicating via REST API and WebSocket (Socket.io).

## Commands

```bash
# Install dependencies (run from shopping-list-app/)
npm install && cd client && npm install && cd ..

# Run both server and client concurrently (dev mode)
npm run dev

# Run server only (nodemon, port 3001)
npm run server

# Run client only (CRA dev server, port 3000)
npm run client

# Run all tests (unit + integration)
npm test

# Run integration tests only
npm run test:integration

# Run a specific test file
npx jest tests/integration/notification.api.test.js

# Database migration (auto-runs on server start)
npm run migrate

# Seed sample data
npm run seed
```

## Environment Variables

Required in `.env` (server will exit without `JWT_SECRET`):

- `JWT_SECRET` — JWT signing secret (required)
- `JWT_EXPIRES_IN` — Token expiry (default: `7d`)
- `PORT` — Server port (default: `3001`)
- `CORS_ORIGIN` — Allowed origin (default: `http://localhost:3000`)
- `TRUST_PROXY` — Set for reverse proxy environments
- `NODE_ENV` — `development` enables verbose error messages and socket logs

## Architecture

### Server (`server/`)

Layered architecture with JWT auth and WebSocket side-channel:

```
server/index.js                          → Express app bootstrap, security middleware, graceful shutdown
server/routes/auth.js                    → POST /register, POST /login
server/routes/notifications.js           → Notification CRUD routes (JWT required)
server/controllers/notificationController.js → Request handling, delegates to models
server/middleware/auth.js                → JWT authenticate + authorizeUser middleware
server/middleware/validateUuid.js         → UUID v4 format validation middleware
server/models/notificationModel.js       → Notification data access (better-sqlite3)
server/models/userModel.js               → User CRUD with bcrypt password hashing
server/db/connection.js                  → Singleton DB connection (lazy-initialized)
server/db/schema.sql                     → Table definitions (users, notifications)
server/db/migrate.js                     → Runs schema.sql against the DB
server/websocket/socketManager.js        → Socket.io init, room management
server/websocket/socketAuthMiddleware.js → JWT auth for WebSocket connections
server/websocket/notificationEmitter.js  → Event emitters (new, read, read-all)
```

- **Database**: SQLite via `better-sqlite3` (synchronous API). File stored at `server/db/notifications.db`. WAL mode + foreign keys enabled. Composite indexes on `(user_id, created_at DESC)` and `(user_id, is_read)` for efficient notification listing and unread count queries.
- **WebSocket**: JWT auth required via `socket.handshake.auth.token`. Users join room `user:{userId}` after auth. Events: `notification:new`, `notification:read`, `notification:read-all`.
- **Notification types** (enforced by CHECK constraint): `item_added`, `item_purchased`, `list_shared`, `reminder`.

### Security

- **helmet** for HTTP security headers
- **express-rate-limit**: Auth routes 20 req/15min, API routes 100 req/15min
- **JSON body limit**: 10kb (`express.json({ limit: '10kb' })`)
- **CORS**: Configurable via `CORS_ORIGIN` env var (default: `http://localhost:3000`)
- **JWT**: HS256 algorithm, secret via `JWT_SECRET` env var (required, server exits without it)
- **Password hashing**: bcryptjs with 10 salt rounds
- **UUID validation middleware**: All route params validated against UUID v4 format

### Client (`client/`)

React 18 app (Create React App) with custom hooks pattern:

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

- Client proxies API requests to `http://localhost:3001` (hardcoded in `notificationApi.js`, proxy also set in `client/package.json`).
- `App.js` implements a JWT-based login/logout flow; `userId` is obtained from the login API response and managed in React state. No hardcoded user IDs.
- `is_read` field uses SQLite integer convention (0/1) from the API; client-side code also sets `isRead: true` for local optimistic updates.

### Tests (`tests/`)

Integration tests using Jest + Supertest with in-memory SQLite:

- `tests/helpers/testDb.js` — Creates `:memory:` SQLite DB, monkey-patches connection module. Provides `seedTestUser()`, `getTestToken()`, `clearTestData()` helpers. Clears module cache for all server modules on teardown.
- `tests/helpers/testServer.js` — Spins up Express + Socket.io on random port with supertest agent.
- Tests mock the DB connection module at import time, so test order matters: always call `setupTestDatabase()` before `createTestServer()`.

### Test Suites

- `tests/integration/auth.test.js` — Registration, login, validation
- `tests/integration/notification.api.test.js` — CRUD operations
- `tests/integration/notification.auth.test.js` — Auth/authorization checks
- `tests/integration/notification.flow.test.js` — End-to-end flows
- `tests/integration/notification.websocket.test.js` — Real-time WebSocket events
- `tests/unit/notificationApi.test.js` — Client API service unit tests
- `tests/unit/notificationTransform.test.js` — Data transform unit tests

### Auth API Endpoints

All under `/api/auth` (rate-limited: 20 req/15min):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create user account (name, email, password) |
| POST | `/login` | Authenticate and receive JWT token |

### Notification API Endpoints

All under `/api/notifications` (JWT required, rate-limited: 100 req/15min):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create notification |
| GET | `/:userId` | List user notifications (query: `unread_only`, `limit`, `offset`) |
| PATCH | `/:id/read` | Mark single as read |
| PATCH | `/read-all/:userId` | Mark all as read |
| DELETE | `/:id` | Delete notification |

### Documentation (`docs/`)

- `security-recommendations.md` — Security audit findings and remediation plan
- `security-audit-followup-report.md` — Post-audit verification results
- `collaborator-review.md` — Collaborator code review notes

## Key Patterns

- **DB connection singleton**: `getDatabase()` lazily creates the connection. Tests replace this function to inject an in-memory DB.
- **Module cache clearing in tests**: `teardownTestDatabase()` deletes `require.cache` entries for all server modules to ensure fresh state between test suites.
- **WebSocket event flow**: Controller actions (create, markAsRead, markAllAsRead) emit Socket.io events after DB writes. The client `useSocket` hook subscribes to these for real-time UI updates.
- **UUID primary keys**: All entities use `uuid` v4 for IDs, generated server-side.
- **JWT auth flow**: `authenticate` middleware extracts token from `Authorization: Bearer <token>`, verifies with HS256, sets `req.userId`. `authorizeUser` checks `req.params.userId === req.userId`.
- **Test auth helpers**: `seedTestUser(userId)` inserts user with pre-hashed password. `getTestToken(userId)` creates JWT with test secret. Always seed user before creating test token.
- **Graceful shutdown**: Server handles SIGTERM/SIGINT, closes HTTP server and DB connection with 10s timeout.

## Gotchas

- **Test user IDs are NOT UUIDs**: Test helpers use `test-user-1` (non-UUID) by default. `validateUuid` middleware will reject these — tests that hit routes with `:userId` param must use real UUID format or seed accordingly.
- **Module cache**: Tests monkey-patch `server/db/connection.js`. Always call `setupTestDatabase()` before `createTestServer()` — order matters.
- **JWT_SECRET required**: Server exits immediately if `JWT_SECRET` is not set. Tests set it via `process.env.JWT_SECRET = 'test-jwt-secret-key'` in `setupTestDatabase()`.
- **`is_read` type mismatch**: SQLite returns integer (0/1), client-side uses boolean. Transform at the API boundary.
