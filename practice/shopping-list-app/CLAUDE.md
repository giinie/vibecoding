# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shopping list app with a real-time notification system. Monorepo structure with an Express.js backend and a React (CRA) frontend, communicating via REST API and WebSocket (Socket.io).

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

# Run all backend integration tests
npm test

# Run a specific test file
npx jest tests/integration/notification.api.test.js

# Database migration (auto-runs on server start)
npm run migrate

# Seed sample data
npm run seed
```

## Architecture

### Server (`server/`)

Standard MVC-like layered architecture with WebSocket side-channel:

```
server/index.js          → Express app bootstrap, migration on startup
server/routes/           → Express router definitions (REST endpoints)
server/controllers/      → Request handling, validation, delegates to models
server/models/           → Data access layer (direct better-sqlite3 queries)
server/db/connection.js  → Singleton DB connection (lazy-initialized)
server/db/schema.sql     → Table definitions (users, notifications)
server/db/migrate.js     → Runs schema.sql against the DB
server/websocket/        → Socket.io setup and event emitters
```

- **Database**: SQLite via `better-sqlite3` (synchronous API). File stored at `server/db/notifications.db`. WAL mode + foreign keys enabled.
- **WebSocket rooms**: Users join room `user:{userId}` on connection. Three events: `notification:new`, `notification:read`, `notification:read-all`.
- **Notification types** (enforced by CHECK constraint): `item_added`, `item_purchased`, `list_shared`, `reminder`.

### Client (`client/`)

React 18 app (Create React App) with custom hooks pattern:

```
client/src/context/SocketContext.js  → React Context providing socket instance
client/src/hooks/useSocket.js        → Subscribe to WebSocket notification events
client/src/hooks/useNotifications.js → Full notification state management (CRUD + real-time)
client/src/services/                 → API client functions and socket connection manager
client/src/components/               → UI components (Bell, Dropdown, Item, List)
```

- Client proxies API requests to `http://localhost:3001` (hardcoded in `notificationApi.js`, proxy also set in `client/package.json`).
- Currently uses a hardcoded `USER_ID = 'user-1'` in `App.js`.
- `is_read` field uses SQLite integer convention (0/1) from the API; client-side code also sets `isRead: true` for local optimistic updates.

### Tests (`tests/`)

Integration tests using Jest + Supertest with in-memory SQLite:

- `tests/helpers/testDb.js` — Creates `:memory:` SQLite DB and monkey-patches `server/db/connection.js` to use it. Clears module cache on teardown.
- `tests/helpers/testServer.js` — Spins up Express + Socket.io on random port with supertest agent.
- Tests mock the DB connection module at import time, so test order matters: always call `setupTestDatabase()` before `createTestServer()`.

### REST API Endpoints

All under `/api/notifications`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create notification |
| GET | `/:userId` | List user notifications (query: `unread_only`, `limit`, `offset`) |
| PATCH | `/:id/read` | Mark single as read |
| PATCH | `/read-all/:userId` | Mark all as read |
| DELETE | `/:id` | Delete notification |

## Key Patterns

- **DB connection singleton**: `getDatabase()` lazily creates the connection. Tests replace this function to inject an in-memory DB.
- **Module cache clearing in tests**: `teardownTestDatabase()` deletes `require.cache` entries for all server modules to ensure fresh state between test suites.
- **WebSocket event flow**: Controller actions (create, markAsRead, markAllAsRead) emit Socket.io events after DB writes. The client `useSocket` hook subscribes to these for real-time UI updates.
- **UUID primary keys**: All entities use `uuid` v4 for IDs, generated server-side.
