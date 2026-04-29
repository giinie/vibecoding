# Architecture

> Detailed architecture reference for the shopping-list-app monorepo. Extracted from `CLAUDE.md` to reduce primary-context token cost. CLAUDE.md retains the Critical Rules and Key Patterns (WHY annotations); this document holds the structural reference (file trees, security implementation details, API endpoint tables, test layout).

**When to read this file**:
- You need the full file tree of `server/` or `client/`
- You need the exact API endpoint signatures or rate-limit details
- You need to understand Socket.io event names, error codes, or room conventions
- You need to know which test suites cover which feature

**When NOT to read this file**:
- You only need the rules / constraints — those live in `CLAUDE.md` (Critical Rules, Key Patterns)
- You need workflow / planning rules — those live in `WORKFLOW_ORCHESTRATION.md`

---

## Server (`server/`)

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
server/db/migrate.js                     → Runs schema.sql against the DB; backfills purchased_at on existing purchased rows
server/websocket/socketManager.js        → Socket.io init, room management
server/websocket/socketAuthMiddleware.js → JWT auth for WebSocket connections; exports SOCKET_AUTH_ERRORS, sets socket.tokenExp
server/websocket/notificationEmitter.js  → Event emitters (new, read, read-all)
server/routes/shoppingItems.js           → Shopping item CRUD routes (JWT required)
server/controllers/shoppingItemController.js → Request handling, delegates to shoppingItemModel; invalidates recommendation cache on toggle
server/models/shoppingItemModel.js       → Shopping item data access (better-sqlite3)
server/websocket/shoppingItemEmitter.js  → Event emitters (new, toggled, deleted)
server/routes/recommendations.js         → Recommendation routes (JWT required)
server/controllers/recommendationController.js → getRecommendations request handler
server/services/recommendationService.js → AI recommendation generation (Anthropic Claude), LRU cache, default fallback
```

### Database

- SQLite via `better-sqlite3` (synchronous API)
- WAL mode + foreign keys enabled
- `notifications` table: composite indexes on `(user_id, created_at DESC)` and `(user_id, is_read)`
- `shopping_items` table: composite indexes on `(user_id, created_at DESC)` and `(user_id, is_purchased)`
- `refresh_tokens` table: indexes on `user_id`, `token`, `family_id`, `expires_at`; columns `is_used` (INTEGER) and `family_id` (UUID) support rotation and replay detection

### WebSocket

- JWT auth via `socket.handshake.auth.token` (async auth function — refreshes token before connecting if expired)
- `socketAuthMiddleware` sets `socket.tokenExp` (JWT `exp` claim)
- `socketManager` starts a `setTimeout` on connect that auto-disconnects the socket when the access token expires, forcing the client to reconnect with a fresh token
- Users join room `user:{userId}`
- Notification events: `notification:new`, `notification:read`, `notification:read-all`
- Shopping item events: `shoppingItem:new`, `shoppingItem:toggled`, `shoppingItem:deleted`

### WebSocket error codes

`SOCKET_AUTH_ERRORS.MISSING_TOKEN`, `SOCKET_AUTH_ERRORS.TOKEN_EXPIRED`, `SOCKET_AUTH_ERRORS.INVALID_TOKEN`. `socketService.js` handles:
- `TOKEN_EXPIRED` → let Socket.io auto-reconnect (auth function will refresh)
- `MISSING_TOKEN` / `INVALID_TOKEN` → disconnect and call `onAuthFailure()`

### Notification types

CHECK constraint enforces: `item_added`, `item_purchased`, `list_shared`, `reminder`.

---

## Security

- **helmet** for HTTP security headers
- **express-rate-limit**: Auth 20 req/15min, API 100 req/15min
- **JSON body limit**: 10kb
- **CORS**: Configurable via `CORS_ORIGIN` env var
- **JWT**: HS256 algorithm, `JWT_SECRET` required. Access token TTL `15m`, refresh token TTL `7d`.
- **Refresh token rotation**: single-use tokens with family tracking; replay revokes entire family. Max 5 families per user.
- **Password hashing**: bcryptjs, 10 salt rounds
- **UUID validation**: All route params validated against UUID format

---

## Client (`client/`)

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
client/src/services/recommendationApi.js     → Recommendation API client + transformRecommendation()
client/src/hooks/useRecommendations.js       → Recommendation state management (fetch, add, addingIds for double-click prevention)
client/src/components/RecommendationPanel.js → AI recommendation panel UI (ARIA dialog, WCAG accessible)
```

- Access token stored in `localStorage` under `TOKEN_KEY`; refresh token under `REFRESH_TOKEN_KEY` (both constants defined in `authApi.js`). All modules access the access token via `getToken()` — never read `localStorage` directly.
- `App.js` implements JWT login/logout flow; `userId` from login response, managed in React state. Pass `onAuthFailure` to `SocketProvider` to handle unrecoverable socket auth failures (e.g., force logout).

---

## Tests (`tests/`)

Integration and unit tests using Jest + Supertest with in-memory SQLite:

- `tests/helpers/testDb.js` — Creates `:memory:` SQLite DB, monkey-patches connection module. Provides `seedTestUser()`, `getTestToken()`, `clearTestData()`.
- `tests/helpers/testServer.js` — Spins up Express + Socket.io on random port.
- `tests/integration/` — 10 suites: `auth.test.js`, `auth.refresh.test.js` (refresh/logout/replay), `notification.api.test.js`, `notification.auth.test.js`, `notification.flow.test.js`, `notification.websocket.test.js`, `shoppingItem.api.test.js`, `shoppingItem.websocket.test.js`, `socketAuth.expiry.test.js` (token expiry disconnect), `recommendation.api.test.js`.
- `tests/unit/` — 5 suites: `notificationApi.test.js`, `notificationTransform.test.js`, `refreshTokenModel.test.js`, `isTokenExpired.test.js`, `recommendationService.test.js`.

---

## API Endpoints

### Auth (`/api/auth`, rate-limited 20 req/15min)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create user account (name, email, password); returns `{ token, refreshToken, user }` |
| POST | `/login` | Authenticate; returns `{ token, refreshToken, user }` |
| POST | `/refresh` | Exchange refresh token for new access + refresh token pair (rotation) |
| POST | `/logout` | Revoke refresh token family server-side |

### Notifications (`/api/notifications`, JWT required, rate-limited 100 req/15min)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create notification |
| GET | `/:userId` | List notifications (query: `unread_only`, `limit`, `offset`) |
| PATCH | `/:id/read` | Mark single as read |
| PATCH | `/read-all/:userId` | Mark all as read |
| DELETE | `/:id` | Delete notification |

### Shopping Items (`/api/shopping-items`, JWT required, rate-limited 100 req/15min)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create shopping item (name, quantity?, unit?) |
| GET | `/:userId` | List items (query: `limit`, `offset`); ordered unpurchased-first |
| PATCH | `/:id/toggle` | Toggle purchased status |
| DELETE | `/:id` | Delete shopping item |

### Recommendations (`/api/recommendations`, JWT required, rate-limited 100 req/15min)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:userId` | Get AI-powered shopping recommendations (5 items); uses LRU cache (max 100, 1h TTL); falls back to defaults if `ANTHROPIC_API_KEY` unset or no purchase history. Supports `?refresh=true` to bypass server cache. |

---

## Key Reference Docs

| File | Purpose |
|------|---------|
| `docs/ai-skills-usage-guide.md` | AI skills usage guide (Korean) |
| `docs/security-cross-verification-2026-03-07.md` | Latest security audit; N-4 token revocation partially resolved |
| `docs/security-audit-followup-report.md` | Security audit follow-up |
| `docs/security-recommendations.md` | Standing security recommendations |
| `docs/slop-cleanup-report.md` | AI slop cleanup audit |
| `docs/collaborator-review.md` | Collaborator review notes |
| `docs/plans/` | Architecture plans and design docs |
| `docs/superpowers/specs/`, `docs/superpowers/plans/` | Feature specs and execution plans |
