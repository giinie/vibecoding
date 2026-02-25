# Changelog

이 프로젝트의 주요 변경사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [Unreleased]

### Changed
- AI slop 정리 적용 (`/deslop apply`) (2026-02-25)
  - `client/src/services/socketService.js`: connect/disconnect `console.log`에 NODE_ENV 개발 환경 가드 추가, `REACT_APP_SOCKET_URL` 환경변수 지원
  - `client/src/services/authApi.js`: `BASE_URL`에 `REACT_APP_API_URL` 환경변수 폴백 추가
  - `client/src/services/notificationApi.js`: `BASE_URL`에 `REACT_APP_API_URL` 환경변수 폴백 추가
  - `server/controllers/notificationController.js`: `UUID_REGEX`, `VALID_TYPES` 상수를 모듈 레벨로 호이스팅
  - `server/db/migrate.js`: 성공 `console.log`를 `require.main` 가드 안으로 이동
- 문서와 코드 상태 동기화 (`/sync-docs apply`) (2026-02-23)
  - `CLAUDE.md`: 하드코딩 USER_ID 설명을 JWT 로그인 플로우 설명으로 교체
  - `docs/security-recommendations.md`: JWT 인증 항목(#5, #6) 상태를 "해결"로 업데이트
  - `server/websocket/socketManager.js`: disconnect 로그에 NODE_ENV 개발 환경 가드 추가
- DB 쿼리 성능 최적화 (Codex 분석 → 3-agent 교차 검증 후 확인된 항목만 적용)
  - `server/db/schema.sql`: 단일 컬럼 인덱스 3개를 복합 인덱스 2개로 교체 (`user_id, created_at DESC` / `user_id, is_read`) — 임시 B-tree 정렬 제거
  - `server/models/userModel.js`: `LOWER(email)=LOWER(?)` → `email=?` 직접 비교로 변경 — 풀 테이블 스캔 제거

### Added
- `.env.example` 환경 변수 템플릿 파일 생성
- `docs/slop-cleanup-report.md` AI slop 정리 보고서

---

## [0.3.0] - 2026-02-16

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

## [0.2.0] - 2026-02-16

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
- `TOKEN_KEY` 상수 재사용으로 토큰 키 이름 일관성 확보
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
