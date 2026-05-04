# Changelog

이 프로젝트의 주요 변경사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [Unreleased]

### 2026-05-04

#### Chore
- `.gitattributes` 추가 — `* text=auto eol=lf` 적용으로 Windows CRLF 자동 변환 경고 제거. SQLite DB 파일(`*.db`, `*.sqlite`, `*.sqlite3`)과 이미지 바이너리를 binary로 명시 (commit `5a53b49`)

#### Docs
- `CLAUDE.md`, `WORKFLOW_ORCHESTRATION.md`, `docs/architecture.md`, `tasks/lessons.md`: cross-scope 정합성 강화 18건 (commit `698d64c`)
  - `CLAUDE.md`: Skill Routing + MCP Server Routing 상속 명시, `oh-my-claudecode:code-reviewer` default agent 명기, `NODE_ENV` 가능 값 3종 명시, Windows `Copy-Item` 안내, TL;DR → Critical Rules 하이퍼링크
  - `WORKFLOW_ORCHESTRATION.md`: Planning에 context7 MCP cross-link, Subagent Usage의 user-scope OMC override 참조, Verification 3-question 체크리스트, Lesson promotion 정량 기준 추가
  - `docs/architecture.md`: Database 섹션 schema.sql source-of-truth 링크, WebSocket `isTokenExpired()` cross-ref, Tests 카운트 dynamic 참조, Key Reference Docs를 Evergreen/Historical Reports로 분리
- `CLAUDE.md`: `/sync-docs` 드리프트 보수 3건
  - Critical Rules / Auth & Security: fetchWithAuth 마이그레이션 범위에 `recommendationApi.js` 누락 반영, `authApi.js` 제외 사유 명시
  - Key Patterns / Client API Utilities: "All API service modules" enumeration 동기화
  - Key Patterns / UI State: `ITEMS_PER_PAGE` 메모를 per-hook 스코프로 명확화 — `useNotifications.js`(5)와 `useShoppingItems.js`(20)이 도메인별로 의도적으로 다른 값을 가짐을 명시

### 2026-04-29

#### Docs
- `docs/architecture.md` 신규 작성 — Server/Client 파일 트리, DB/WebSocket 세부사항, Security 구현, API 엔드포인트 표, 테스트 레이아웃, Key Reference Docs 포함
- `CLAUDE.md`: `## Architecture` 섹션을 stub으로 교체 (link + 4-bullet At-a-glance 요약). 253줄 → 137줄 (약 46% 감소) — 컨텍스트 토큰 절감 목적

### 2026-04-20

#### Docs
- `CLAUDE.md`: Rules / Precedence / Skill Policy 섹션 신규 추가 — `@WORKFLOW_ORCHESTRATION.md` 인라인 참조를 구조화된 섹션으로 전환; 스킬 라우팅 및 보안 리뷰 의무화 정책 명시
- `WORKFLOW_ORCHESTRATION.md`: 서브에이전트 사용 가이드 확장 — gate failure 감지, Esc+Esc 인터럽트 구분, 직접 도구 우선 규칙 추가; Bug Fixing에 크로스 파일 변경 시 Planning 에스컬레이션 규칙 추가; Code Quality 섹션을 user-scope `CODE_QUALITY.md` 상속 구조로 재작성
- `tasks/todo.md`: Codex 리뷰 지적사항 및 수정 계획 항목 추가 (commit `312c4ba`)
- `docs/superpowers/plans/2026-04-09-recommendation-review-fixes.md` 신규: recommendation feature 크로스 코드 리뷰 수정 계획 문서 (commit `0db0b4c`)

### 2026-04-09

#### Added
- **AI 추천 기능** (Anthropic Claude API 연동)
  - `server/services/recommendationService.js`: `generateRecommendations()` — LRU 캐시(max 100, 1h TTL) 기반 AI 추천 생성; API 키 없거나 구매 이력 없으면 기본 추천 반환
  - `server/controllers/recommendationController.js`: `getRecommendations()` 요청 처리
  - `server/routes/recommendations.js`: `GET /api/recommendations/:userId` (JWT 필수)
  - `client/src/services/recommendationApi.js`: `fetchRecommendations()`, `transformRecommendation()` API 클라이언트
  - `client/src/hooks/useRecommendations.js`: 추천 상태 관리 + `addingIds` Set으로 중복 추가 방지
  - `client/src/components/RecommendationPanel.js`: 추천 패널 UI (ARIA `role="dialog"`, `aria-modal`, `aria-labelledby`)
  - `client/src/styles/recommendations.css`: 추천 패널 BEM 기반 스타일
  - `server/index.js`: `/api/recommendations` 라우트 등록

#### Fixed
- `server/db/migrate.js`: 기존 구매 완료 아이템의 `purchased_at` 백필 쿼리 추가 (`ALTER TABLE` 직후 실행)
- `server/controllers/shoppingItemController.js`: 구매 상태 토글 시 추천 캐시 무효화 (`clearRecommendationCache(userId)`) 추가
- `server/services/recommendationService.js`: 무제한 Map 캐시 → LRU 캐시 교체 (max 100, 1h TTL)
- `server/services/recommendationService.js`: AI 응답 필드 레벨 타입 검증 (`validateRecommendation`) 추가
- `server/services/recommendationService.js`: Anthropic SDK `require`를 최상단 조건부 가드로 이동
- `server/services/recommendationService.js`: no-API-key / 구매이력 없는 경로에서 기본 추천 캐싱
- `client/src/hooks/useRecommendations.js`: `addingIds` Set으로 추천 추가 버튼 중복 클릭 방지
- `client/src/components/RecommendationPanel.js`: ARIA 접근성 속성 추가 (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`)
- `tests/integration/recommendation.api.test.js`: `ANTHROPIC_API_KEY` 환경변수 테스트 격리 (`beforeEach` 삭제, `afterEach` 복원)

### 2026-04-02

#### Changed
- **ai-* 스킬 Enhancement Pass 2**: 3-enhancer 병렬 분석 → 32건 통합, 전체 적용
  - `references/security.md`: 정규식 버그 수정 (`\|` → `|`), Regex Flavor 섹션 추가 (JS/PCRE 명시)
  - `references/conventions.md`: 6개 신규 섹션 (Execution Context, CLI Exclusivity Rule, multi-teammate cleanup, user confirmation MUST, STATE_DIR 정의, effort level 참조 정책) + 4개 기존 섹션 업데이트
  - `ai-delegate/SKILL.md`: 워크플로 재구조화, preamble 결정 테이블, `{task_text}` → `{task_description}` 통일, retry 정책 통일, research → ai-research 라우팅
  - `ai-review/SKILL.md`: timeout 300s → 600s (conventions.md high 기준), Pre-execution Safety Check 추가, 보일러플레이트 → conventions.md 참조
  - `ai-deep/SKILL.md`: provider 선택 heuristics 추가, 보일러플레이트 → conventions.md 참조
  - `ai-parallel/SKILL.md`: 파일 분할 전략 추가 (디렉토리 그룹 우선), 보일러플레이트 → conventions.md 참조
  - `ai-research/SKILL.md`: Pre-execution Safety Check 추가, fallback chain 역순 근거 문서화, MCP fallback 모호성 수정
- `docs/ai-skills-usage-guide.md`: CLI Exclusivity Rule, ai-deep provider heuristics, effort level 참조 소스 업데이트

### 2026-04-01

#### Changed
- `CLAUDE.md`: `security-recommendations.md` 설명을 N-4 토큰 갱신 항목 PARTIALLY RESOLVED 상태 반영으로 업데이트 (commit 5e8c106)
- `docs/ai-skills-usage-guide.md`: Codex Plugin Integration 반영 — codex 호출 경로가 `/codex` 플러그인 명령어로 통합됨

### 2026-03-25

#### Refactored
- `server/controllers/notificationController.js`: 에러 로깅 추가 및 `handleServerError` 인자 개선 (commit abdeb83)

### 2026-03-20 (Refresh Token 시스템 + 클라이언트 자동 갱신)

#### Added
- **Refresh Token 인프라** (서버)
  - `server/models/refreshTokenModel.js`: create, createWithFamily, findByToken, markUsed, deleteFamily, deleteByUser, deleteExpired, countFamilies, deleteOldestFamily
  - `server/db/schema.sql`: `refresh_tokens` 테이블 추가 (id, user_id, token, family_id, expires_at, is_used, created_at; 인덱스 4개)
  - `server/routes/auth.js`: `POST /api/auth/refresh` — 리프레시 토큰 rotation; 재사용 감지 시 family 전체 폐기
  - `server/routes/auth.js`: `POST /api/auth/logout` — refresh token family 서버 측 폐기
  - 로그인/회원가입 응답에 `refreshToken` 필드 추가 (`{ token, refreshToken, user }`)
  - 사용자당 최대 5개 family 제한 (초과 시 가장 오래된 family 삭제)

- **클라이언트 자동 갱신** (클라이언트)
  - `client/src/services/authApi.js`: `refreshAccessToken()` — mutex 기반 단일 갱신 (동시 401 중복 방지)
  - `client/src/services/authApi.js`: `isTokenExpired()` — JWT payload `exp` 클라이언트 사이드 검사
  - `client/src/services/authApi.js`: `REFRESH_TOKEN_KEY` 상수, `logout()` 서버 측 폐기 fire-and-forget 추가
  - `client/src/services/apiUtils.js`: `fetchWithAuth()` — 401 시 자동 토큰 갱신 후 재시도 (1회)
  - `client/src/services/socketService.js`: async auth 함수 패턴 — 연결 전 토큰 만료 시 자동 갱신
  - `client/src/context/SocketContext.js`: `onAuthFailure` prop 추가 (복구 불가 소켓 인증 실패 시 콜백)

- **WebSocket 토큰 만료 처리**
  - `server/websocket/socketAuthMiddleware.js`: `SOCKET_AUTH_ERRORS` 상수 export, `socket.tokenExp` 설정
  - `server/websocket/socketManager.js`: access token 만료 시점에 소켓 자동 연결 해제 타이머 (`setTimeout`)

- **테스트**
  - `tests/integration/auth.refresh.test.js`: refresh/logout/replay 탐지 통합 테스트
  - `tests/integration/socketAuth.expiry.test.js`: 토큰 만료 후 소켓 자동 해제 테스트
  - `tests/unit/refreshTokenModel.test.js`: refreshTokenModel 단위 테스트
  - `tests/unit/isTokenExpired.test.js`: isTokenExpired() 단위 테스트

#### Changed
- `server/routes/auth.js`: `signToken()` → `signAccessToken()` (이름 변경), access token 기본 TTL `7d` → `15m`
- `client/src/services/notificationApi.js`, `shoppingItemApi.js`: 모든 인증 API 호출을 `fetchWithAuth()`로 마이그레이션
- `CLAUDE.md`: 위 변경사항 전체 반영 (JWT auth flow, 토큰 TTL, 새 endpoints, 파일 맵, 테스트 목록)

### 2026-03-12 (ai-* 스킬 Team 실행 모델 + 문서 동기화)

#### Changed
- ai-delegate 스킬: Claude Code native Agent Team 기반 CLI 실행 모델로 전면 재설계 (iteration-3)
- ai-review, ai-deep, ai-parallel, ai-research 스킬: Team 실행 모델 참조 업데이트
- ai-review: "2 Teams 병렬" → "1 Team + 2 teammates" 병렬 패턴으로 수정
- `docs/ai-skills-usage-guide.md`: Team 실행 모델, Minimum Output Guarantee, 검증 이력 섹션 추가

#### Added
- 모든 ai-* 스킬에 Minimum Output Guarantee 섹션 추가 (CLI 실패 시 Claude fallback)
- ai-delegate: CLI Worker Preamble, Safe Prompt Delivery 우선순위 재정렬, Team Lifecycle Rules
- ai-delegate: 서브에이전트 제한 사항 문서화 (Agent tool 미지원 → inline flag fallback)
- `ai-delegate-workspace/iteration-3/`: E2E 테스트 결과 (Phase 0, Test A-D)

### 2026-03-11 (프로젝트 설정 및 워크플로 가이드)

#### Changed
- `.mcp.json`을 git 추적에서 제거하고 `.mcp.json.example` 템플릿 추가
- `CLAUDE.md`에 Workflow Orchestration 안내 추가 (`WORKFLOW_ORCHESTRATION.md` 참조)

#### Fixed
- 크로스 모델 리뷰 기반 코드 품질 개선 및 문서 동기화

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
