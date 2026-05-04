# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shopping list app with a real-time notification system and JWT authentication. Monorepo structure with an Express.js backend and a React (CRA) frontend, communicating via REST API and WebSocket (Socket.io).

> **TL;DR Critical Constraints** (full detail in [Critical Rules](#critical-rules) below): `JWT_SECRET` env required (server exits without it). Tests: call `setupTestDatabase()` before `createTestServer()`. All `userId` params must be UUID v4. SQLite booleans need `Boolean()` transform at API boundary. Use `fetchWithAuth()` from `apiUtils.js` for all authenticated API calls (handles token refresh automatically). Access token default TTL is `15m`; refresh token TTL is `7d`.

## Rules

Workflow orchestration: @WORKFLOW_ORCHESTRATION.md

## Precedence

Rules in this file and @WORKFLOW_ORCHESTRATION.md override user-scope
delegation defaults (including OMC delegation_rules).

## Skill Policy

Inherits Skill Routing Rules and MCP Server Routing from user scope `~/.claude/CLAUDE.md`. Project-specific additions:

- **Security-related changes** (auth / JWT / refresh token rotation / CORS / rate-limit): Review is MANDATORY via `superpowers:systematic-debugging` or the `oh-my-claudecode:security-reviewer` agent.
- **New business logic**: The existing integration/unit test suite is solid — prefer `superpowers:test-driven-development` to write tests first.
- **Code review**: Use `ai-review` (multi-model) or `pr-review-toolkit:review-pr`. For delegated review tasks, prefer the `oh-my-claudecode:code-reviewer` agent (user-scope default). `superpowers:requesting-code-review` / `superpowers:receiving-code-review` are disabled in this project (aligned with user-scope default policy).
- **Doc sync**: When code changes affect API endpoints, environment variables, the Architecture section, or any "WHY" annotation in Key Patterns, run `sync-docs:sync-docs` to update this CLAUDE.md and `docs/architecture.md`.
- **DB schema changes**: Must modify `server/db/schema.sql` and `migrate.js` together. Even trivial changes are cross-file, so the Planning rule applies.

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
- Notification create field schema (server-side validation enforced): `user_id` (UUID v4), `type` (enum: `item_added`, `item_purchased`, `list_shared`, `reminder`), `title` (max 255 chars), `message` (max 2000 chars), `metadata` (max 10KB JSON).
- Shopping item create field schema (server-side validation enforced): `name` (non-empty string, max 200 chars), `quantity` (positive integer, max 10000, default 1), `unit` (optional string, max 20 chars).

## Toolchain

This project uses **npm** (not pnpm/bun). Respect the existing toolchain per `USER_REQUIREMENTS.md` policy.

## First-time Setup

> **Windows note**: Replace `cp` with `Copy-Item` if using PowerShell.

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
- **Migration lifecycle**: `migrate()` does NOT close the DB connection — callers manage lifecycle. Only the CLI entry (`require.main === module`) calls `closeDatabase()`. WHY: prevents the server from closing and re-opening the connection on every startup. Migration also backfills `purchased_at = created_at` on existing purchased rows when adding the column. WHY: `getPurchaseHistory()` filters by `purchased_at IS NOT NULL`, so without backfill existing purchase history is invisible to recommendations.
- **Recommendation cache invalidation**: `shoppingItemController.togglePurchased()` calls `clearRecommendationCache(userId)` after toggling. WHY: purchase state changes affect recommendation input; stale cache would serve outdated suggestions for up to 1 hour.
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
- `NODE_ENV` — `development` (verbose error messages + socket logs, password output in `seed.js`), `production` (sanitized errors, default deploy mode), `test` (used by Jest harness; disables some warnings)
- `ANTHROPIC_API_KEY` — (optional) Enables AI-powered shopping recommendations via Claude API. If unset, returns hardcoded default recommendations. **MUST be unset in tests** to prevent live API calls.

Optional in `client/.env` (CRA prefix required):

- `REACT_APP_API_URL` — API base URL (default: `http://localhost:3001/api`)
- `REACT_APP_SOCKET_URL` — WebSocket server URL (default: `http://localhost:3001`)

> **Note**: `REACT_APP_API_URL` uses absolute URLs, which bypass the CRA proxy in `client/package.json`. The proxy only applies when using relative fetch paths (e.g., `/api/...`). When `REACT_APP_API_URL` is set, the proxy has no effect.

## Architecture

> Detailed file trees, security implementation, API endpoint tables, test layout, and reference doc index live in [docs/architecture.md](docs/architecture.md). Read it when you need exact file paths, endpoint signatures, Socket.io event names, or test suite locations. Skip it if you only need rules — those are in Critical Rules / Key Patterns above.

**At a glance**:
- **Backend**: Express.js (port 3001), layered (routes → controllers → models). SQLite via `better-sqlite3` (synchronous, WAL + foreign keys). Socket.io for real-time notifications and shopping item events. JWT HS256 + refresh token rotation.
- **Frontend**: React 18 (CRA, port 3000), custom hooks pattern. Access/refresh tokens in `localStorage`; all reads via `getToken()`. WebSocket via `SocketContext` + `useSocket`.
- **Tests**: Jest + Supertest, in-memory SQLite. Integration + unit suites under `tests/integration/` and `tests/unit/` (see `docs/architecture.md` for current inventory).
- **Security**: helmet, express-rate-limit, bcryptjs (10 salt rounds), refresh token rotation with family tracking and replay detection.
