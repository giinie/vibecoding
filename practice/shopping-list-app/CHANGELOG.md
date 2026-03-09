# Changelog

이 프로젝트의 주요 변경사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [Unreleased]

### 2026-03-09 (보안 강화 및 버그 수정)

#### Added
- Shopping Item CRUD 기능
  - `server/models/shoppingItemModel.js`: create, findByUserId, findById, togglePurchased, delete
  - `server/controllers/shoppingItemController.js`: 요청 처리 및 유효성 검사
  - `server/routes/shoppingItems.js`: POST /, GET /:userId, PATCH /:id/toggle, DELETE /:id (JWT 필수)
  - `server/websocket/shoppingItemEmitter.js`: shoppingItem:new, shoppingItem:toggled, shoppingItem:deleted 이벤트
  - `client/src/services/shoppingItemApi.js`: API 클라이언트 + transformItem()
  - `client/src/hooks/useShoppingItems.js`: CRUD 상태 관리 + WebSocket 실시간 동기화
  - `client/src/components/ShoppingItemInput.js`: 아이템 추가 폼 (이름, 수량, 단위)
  - `client/src/components/ShoppingItemList.js`: 목록 뷰 (토글/삭제/더보기)
  - `client/src/styles/shopping.css`: BEM 기반 스타일
  - `server/db/schema.sql`: shopping_items 테이블 추가 (복합 인덱스 2개)
  - `tests/integration/shoppingItem.api.test.js`: 통합 테스트 (quantity max 케이스 포함)
  - `tests/integration/shoppingItem.websocket.test.js`: WebSocket 통합 테스트 5개 케이스 신규 추가

#### Fixed
- `server/models/shoppingItemModel.js`: `togglePurchased`, `delete` 메서드에 `userId` 파라미터 추가 — 단일 SQL로 소유권 검증 + 변경을 원자적으로 처리 (TOCTOU 취약점 해소)
- `server/controllers/shoppingItemController.js`: `quantity` 최대값 10000 제한 추가
- `client/src/hooks/useShoppingItems.js`: `loadMore` 중복 아이템 방지(dedup) 및 `inflightRef`로 WebSocket self-event 필터링
- `client/src/components/ShoppingItemList.js`: 하드코딩된 `'개'` 기본 단위 제거 — 단위가 없으면 수량만 표시

#### Refactored
- `client/src/services/apiUtils.js` 신규 추출: notificationApi.js에서 중복 코드(BASE_URL, authHeaders, handleErrorResponse) 분리
- `client/src/services/apiUtils.js`: `handleErrorResponse()`를 async 함수로 변경 — 서버 오류 응답 본문(JSON)을 파싱해 상세 메시지 노출
- `notificationApi.js`, `shoppingItemApi.js`: 모든 `handleErrorResponse()` 호출을 `await`로 변경

### 2026-03-04

#### Changed
- 코드 품질 리팩토링 (`/simplify`)
  - `server/middleware/validateUuid.js`: `UUID_REGEX`를 export하여 공유 상수로 전환
  - `server/controllers/notificationController.js`: 로컬 `UUID_REGEX` 제거, `validateUuid.js`에서 import
  - `server/routes/auth.js`: `signToken()` 헬퍼 추출, `EMAIL_REGEX` 모듈 스코프로 이동
  - `server/index.js`: `CORS_ORIGIN` 상수 추출, `rateLimitDefaults` 공유 설정 추출
  - `server/websocket/socketManager.js`: `initializeSocket()`에 `corsOrigin` 파라미터 추가
  - `server/db/migrate.js`: `closeDatabase()`를 CLI 진입점으로 한정 (서버 시작 시 DB 재연결 방지)
  - `server/models/notificationModel.js`: 3개 SQL 쿼리를 1개 집계 쿼리로 통합
  - `client/src/services/socketService.js`, `notificationApi.js`: `TOKEN_KEY` 직접 접근 → `getToken()` 사용
  - `client/src/hooks/useNotifications.js`: `applyReadToOne` 헬퍼 추출, `hasUnread` 반환값 추가

### 2026-02-25

#### Changed
- AI slop 정리 적용 (`/deslop apply`)
  - `client/src/services/socketService.js`: connect/disconnect `console.log`에 NODE_ENV 개발 환경 가드 추가, `REACT_APP_SOCKET_URL` 환경변수 지원
  - `client/src/services/authApi.js`: `BASE_URL`에 `REACT_APP_API_URL` 환경변수 폴백 추가
  - `client/src/services/notificationApi.js`: `BASE_URL`에 `REACT_APP_API_URL` 환경변수 폴백 추가
  - `server/controllers/notificationController.js`: `UUID_REGEX`, `VALID_TYPES` 상수를 모듈 레벨로 호이스팅
  - `server/db/migrate.js`: 성공 `console.log`를 `require.main` 가드 안으로 이동

#### Added
- `docs/slop-cleanup-report.md` AI slop 정리 보고서

### 2026-02-23

#### Changed
- 문서와 코드 상태 동기화 (`/sync-docs apply`)
  - `CLAUDE.md`: 하드코딩 USER_ID 설명을 JWT 로그인 플로우 설명으로 교체
  - `docs/security-recommendations.md`: JWT 인증 항목(#5, #6) 상태를 "해결"로 업데이트
  - `server/websocket/socketManager.js`: disconnect 로그에 NODE_ENV 개발 환경 가드 추가
- DB 쿼리 성능 최적화 (Codex 분석 → 3-agent 교차 검증 후 확인된 항목만 적용)
  - `server/db/schema.sql`: 단일 컬럼 인덱스 3개를 복합 인덱스 2개로 교체 (`user_id, created_at DESC` / `user_id, is_read`) — 임시 B-tree 정렬 제거
  - `server/models/userModel.js`: `LOWER(email)=LOWER(?)` → `email=?` 직접 비교로 변경 — 풀 테이블 스캔 제거

#### Added
- `.env.example` 환경 변수 템플릿 파일 생성

---

## [0.3.0] - 2026-02-16 (보안 강화)

### Added
- 회원가입 및 로그인 입력 검증 (이름, 이메일, 비밀번호 형식 검사)
- UUID 형식 유효성 검사 미들웨어 (`validateUuid`) 및 라우트 적용
- `ErrorBoundary` 컴포넌트로 클라이언트 전역 에러 처리 지원
- `helmet` 미들웨어로 HTTP 보안 헤더 적용
- `express-rate-limit`으로 API 및 인증 라우트 요청 제한
- 서버 종료 시 Graceful Shutdown 로직 (SIGTERM/SIGINT, 10초 타임아웃)
- 보안 감사 후속 조치 문서 (`docs/security-audit-followup-report.md`)
- 협업자 코드 리뷰 문서 (`docs/collaborator-review.md`)
- CLAUDE.md 프로젝트 가이드 문서 작성

### Changed
- 비밀번호 해싱 및 검증을 비동기 방식(bcryptjs)으로 업데이트
- WebSocket 및 API CORS 설정을 환경 변수(`CORS_ORIGIN`)로 분리
- JSON body 크기 제한 10kb 적용
- 알림 관련 오류 처리 개선 (404 핸들링, 메시지 길이 제한)
- 로그인/로그아웃 UI 플로우 개선
- 테스트 데이터에서 고정 UUID 사용으로 일관성 확보
- 통합 테스트 및 유닛 테스트 구조 최적화

---

## [0.2.0] - 2026-02-16 (JWT 인증 도입)

### Added
- JWT 인증 시스템 도입 (`jsonwebtoken`, `bcryptjs`)
  - `POST /api/auth/register` — 회원가입
  - `POST /api/auth/login` — 로그인 및 JWT 토큰 발급
  - `server/middleware/auth.js` — Bearer 토큰 검증 미들웨어
  - `server/middleware/auth.js#authorizeUser` — 리소스 소유권 검증
- JWT 기반 WebSocket 인증
  - `server/websocket/socketAuthMiddleware.js` — Socket.io JWT 미들웨어 모듈화
  - 클라이언트에서 `socket.handshake.auth.token`으로 토큰 전달
- `server/models/userModel.js` — 사용자 CRUD 및 bcrypt 비밀번호 해싱
- `server/routes/auth.js` — 인증 라우트
- 보안 권장사항 문서 (`docs/security-recommendations.md`)

### Changed
- 인증 방식을 `x-user-id` 헤더 → JWT Bearer 토큰으로 전환
- WebSocket 인증을 `query.userId` → `auth.token` JWT 검증으로 전환
- `TOKEN_KEY` 상수 재사용으로 토큰 키 이름 일관성 확보 *(이후 2026-03-04에 `getToken()` 헬퍼로 전환, 모듈이 `localStorage`를 직접 접근하지 않도록 개선)*
- 기존 테스트를 JWT 인증 기반으로 전면 수정

### Security
- `x-user-id` 헤더 기반 인증 취약점 해결 (사용자 위장 방지)
- WebSocket 무인증 접속 취약점 해결 (타 사용자 알림 수신 방지)

---

## [0.1.0] - 2026-02-11

### Added
- 프로젝트 초기 구조 (Express.js 백엔드 + React CRA 프론트엔드)
- SQLite 데이터베이스 (`better-sqlite3`) 및 스키마 설정
  - `users` 테이블, `notifications` 테이블 (UUID PK, 외래키, CHECK 제약)
  - WAL 모드 및 외래키 활성화
- 알림 시스템 REST API
  - `POST /api/notifications` — 알림 생성
  - `GET /api/notifications/:userId` — 사용자 알림 목록 조회
  - `PATCH /api/notifications/:id/read` — 단일 알림 읽음 처리
  - `PATCH /api/notifications/read-all/:userId` — 전체 읽음 처리
  - `DELETE /api/notifications/:id` — 알림 삭제
- Socket.io 실시간 알림 시스템
  - `notification:new`, `notification:read`, `notification:read-all` 이벤트
  - 사용자별 room 관리 (`user:{userId}`)
- React 클라이언트 컴포넌트
  - `NotificationBell` — 알림 벨 아이콘 및 미읽음 카운트 배지
  - `NotificationDropdown` — 알림 드롭다운 패널
  - `NotificationList` — 알림 목록 뷰
  - `NotificationItem` — 개별 알림 아이템
- 커스텀 훅: `useSocket`, `useNotifications`
- React Context: `SocketContext` (소켓 인스턴스 제공)
- API 클라이언트: `notificationApi.js`, `socketService.js`
- 데이터베이스 마이그레이션 스크립트 (`npm run migrate`)
- 시드 데이터 스크립트 (`npm run seed`)
- 통합 테스트 (Jest + Supertest, 인메모리 SQLite)
- `concurrently`로 서버/클라이언트 동시 실행 (`npm run dev`)
