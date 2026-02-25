# 보안 강화 권장사항

> **작성일**: 2026-02-16
> **작성 배경**: Fullstack Code Review에서 도출된 프로덕션 배포 전 필수 개선 항목

## 현재 상태

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

### 문제점

```bash
# 현재: 누구나 헤더를 조작하여 다른 사용자로 위장 가능
curl -H "x-user-id: user-2" http://localhost:3001/api/notifications/user-2
```

`server/middleware/auth.js`의 `authenticate` 함수가 `x-user-id` 헤더의 **존재 여부만** 확인하고, 해당 값이 실제 인증된 사용자인지 검증하지 않습니다.

### 영향 범위

- `server/middleware/auth.js` — 인증 로직 전체 교체
- `server/routes/notifications.js` — 미들웨어 연결 방식 변경 가능
- `client/src/services/notificationApi.js` — 헤더를 `Authorization: Bearer <token>`으로 변경
- `client/src/hooks/useNotifications.js` — 토큰 관리 연동
- 새 파일: 로그인 API 엔드포인트, 토큰 발급/검증 유틸

### 구현 방향

#### 1단계: 서버 측 JWT 검증

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

#### 2단계: 로그인 엔드포인트 추가

```javascript
// server/routes/auth.js (새 파일)
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  // 1. DB에서 사용자 조회
  // 2. 비밀번호 검증 (bcrypt)
  // 3. JWT 토큰 발급
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name } });
});
```

#### 3단계: 클라이언트 측 토큰 관리

```javascript
// client/src/services/notificationApi.js (변경 후 예시)
function authHeaders(extra = {}) {
  const token = localStorage.getItem('auth_token');
  return {
    'Authorization': `Bearer ${token}`,
    ...extra,
  };
}
```

### 필요 패키지

```bash
npm install jsonwebtoken bcryptjs
```

### 고려사항

- `JWT_SECRET`은 환경 변수로 관리 (`.env` 파일, 절대 코드에 하드코딩하지 않을 것)
- 토큰 만료 시간 설정 (예: 7일) 및 리프레시 토큰 전략 검토
- `users` 테이블에 `password_hash` 컬럼 추가 필요
- 기존 `x-user-id` 기반 테스트 코드 전면 수정 필요

---

## 권장사항 #6: WebSocket 인증 추가

### 문제점

```javascript
// server/websocket/socketManager.js (현재)
io.use((socket, next) => {
  const userId = socket.handshake.query.userId;
  if (!userId) {
    return next(new Error('Authentication required'));
  }
  next(); // userId가 아무 문자열이든 통과
});
```

WebSocket은 REST API와 **별도의 프로토콜**이며, HTTP 미들웨어가 적용되지 않습니다. 현재는 `query.userId`에 아무 값이나 넣으면 해당 사용자의 room에 참여하여 **다른 사용자의 실시간 알림을 수신**할 수 있습니다.

### 영향 범위

- `server/websocket/socketManager.js` — 연결 시 토큰 검증 추가
- `client/src/services/socketService.js` — 연결 시 토큰 전달
- 테스트 파일: `tests/integration/notification.websocket.test.js`

### 구현 방향

#### 서버: Socket.io 미들웨어에서 JWT 검증

```javascript
// server/websocket/socketManager.js (변경 후 예시)
const jwt = require('jsonwebtoken');

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    return next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  // socket.userId는 미들웨어에서 검증 완료
  const room = `user:${socket.userId}`;
  socket.join(room);
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

### 고려사항

- Socket.io의 `auth` 옵션은 `query`보다 안전 (URL에 노출되지 않음)
- 토큰 만료 시 WebSocket 재연결 실패 → 클라이언트에서 토큰 갱신 후 재연결 로직 필요
- `reconnection` 이벤트에서 최신 토큰을 다시 전달하도록 처리

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
