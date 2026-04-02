# 보안 강화 권장사항

> **상태**: Archived — 모든 항목 구현 완료 (2026-02-16 ~ 2026-02-23). 결정 기록 용도로 보존.
> 아래 코드 예시는 구현 제안 당시의 스냅샷이며, 실제 구현은 소스 코드를 참조하세요.
> **작성일**: 2026-02-16
> **작성 배경**: Fullstack Code Review에서 도출된 프로덕션 배포 전 필수 개선 항목

## 변경 전 상태 (v0.1 구현)

현재 인증 체계는 `x-user-id` HTTP 헤더를 기반으로 하며, 클라이언트가 헤더 값을 자유롭게 설정할 수 있어 **실질적인 보안이 없는 상태**입니다. WebSocket 연결 역시 `query.userId`의 존재 여부만 확인하며, 유효성 검증이 없습니다.

### 해결된 항목 (2026-02-16 수정 완료)

| # | 항목 | 심각도 | 상태 |
|---|------|--------|------|
| 1 | 클라이언트 API 호출에 `x-user-id` 헤더 누락 | CRITICAL | 해결 |
| 2 | `markAsRead`, `delete` 라우트에 소유권 검증 없음 | CRITICAL | 해결 |
| 3 | WebSocket 알림 데이터 변환(transform) 누락 | WARNING | 해결 |
| 4 | 읽지 않은 알림 개수가 로드된 항목만 반영 | WARNING | 해결 |

### 추가 해결 항목 (2026-02-23 확인 완료)

| # | 항목 | 심각도 | 상태 |
|---|------|--------|------|
| 5 | REST API 인증 체계 강화 (JWT 도입) | CRITICAL | 해결 |
| 6 | WebSocket 인증 추가 | CRITICAL | 해결 |

---

## 권장사항 #5: REST API 인증 체계 강화 (JWT 도입)

> **구현 완료**. 실제 코드: `server/middleware/auth.js`, `server/routes/auth.js`, `client/src/services/authApi.js`

- **문제**: `x-user-id` 헤더 기반 인증 — 누구나 다른 사용자로 위장 가능
- **해결**: JWT HS256 인증 도입 (access token 15m + refresh token 7d rotation)
- **영향 범위**: auth.js, notifications.js, notificationApi.js, socketService.js, 신규 authApi.js
- **필요 패키지**: jsonwebtoken, bcryptjs (설치 완료)

<details>
<summary>구현 제안 당시 코드 예시 (참고용)</summary>

#### 서버 측 JWT 검증

```javascript
// server/middleware/auth.js (변경 후 예시)
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

#### 클라이언트 측 토큰 관리

```javascript
// client/src/services/notificationApi.js (현재 구현)
import { getToken, logout } from './authApi';

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extra,
  };
}
```

</details>

---

## 권장사항 #6: WebSocket 인증 추가

> **구현 완료**. 실제 코드: `server/websocket/socketAuthMiddleware.js`, `server/websocket/socketManager.js`, `client/src/services/socketService.js`

- **문제**: `query.userId`에 아무 값이나 넣으면 다른 사용자의 실시간 알림 수신 가능
- **해결**: Socket.io `auth` 옵션으로 JWT 토큰 전달 + 서버 미들웨어에서 검증
- **영향 범위**: socketManager.js, socketAuthMiddleware.js (신규), socketService.js
- **추가 구현**: access token 만료 시 자동 재연결 + 토큰 갱신, `SOCKET_AUTH_ERRORS` 상수

<details>
<summary>구현 제안 당시 코드 예시 (참고용)</summary>

#### 서버: Socket.io 미들웨어에서 JWT 검증

```javascript
// server/websocket/socketManager.js (변경 후 예시)
const jwt = require('jsonwebtoken');

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    return next(new Error('Invalid or expired token'));
  }
});
```

#### 클라이언트: 연결 시 토큰 전달

```javascript
// client/src/services/socketService.js (변경 후 예시)
export function connect(token) {
  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
}
```

</details>

---

## 구현 순서 권장

```text
#5 REST JWT 인증  →  #6 WebSocket JWT 인증
    │                       │
    └── users 테이블 수정     └── #5의 JWT 인프라 재사용
    └── 로그인 API 추가
    └── 클라이언트 토큰 관리
    └── 기존 테스트 수정
```

#5를 먼저 구현하면 #6은 동일한 JWT 검증 로직을 Socket.io 미들웨어에 적용하기만 하면 되므로 작업량이 크게 줄어듭니다.
