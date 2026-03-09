# Shopping List App 개선 로드맵

> **생성일**: 2026-03-02
> **마지막 업데이트**: 2026-03-04 (코드 simplify 리팩토링 반영)
> **분석 방법**: CCG (Claude-Codex-Gemini) 트라이 모델 아키텍처/UI 병렬 감사
> **분석 대상**: 백엔드 아키텍처 (Architect/opus) + 프론트엔드 UI (Designer/sonnet)

---

## 전체 건강도 요약

| 영역 | 평가 | 핵심 소견 |
|------|------|-----------|
| 인증 시스템 | **양호** | JWT HS256 명시, bcrypt 해싱, 알고리즘 혼동 방지 |
| 알림 CRUD | **양호** | 입력 검증 꼼꼼, 페이지네이션, 소유권 검증 |
| WebSocket 실시간 | **양호** | JWT 인증, Room 격리, 3종 이벤트 |
| DB 설계 | **양호** | WAL 모드, 복합 인덱스, CASCADE 삭제 |
| 보안 | **양호** | helmet, rate-limit, CORS, parameterized query |
| 컴포넌트 구현 | **양호** | 접근성 기본 요소, 낙관적 UI 패턴 |
| UX 완성도 | **보통** | 로딩/에러 처리 기본만 존재, toast 없음 |
| 접근성/반응형 | **미흡** | 미디어 쿼리 전무, 색상 대비 미달 |
| 테스트 | **양호** | 69개 테스트, 격리 패턴 우수 |

---

## Phase 1: 즉시 수정 (Critical)

> 사용자 경험에 직접 영향을 미치는 버그 및 누락된 연결

### 1.1 ErrorBoundary 적용

- **파일**: `client/src/App.js`
- **문제**: `ErrorBoundary.js`가 구현되어 있지만 App.js에서 import/사용하지 않음. 렌더링 오류 시 전체 앱이 빈 화면이 됨.
- **작업**:
  - [ ] `App.js`에서 `ErrorBoundary` import
  - [ ] `<SocketProvider>` 바깥을 `<ErrorBoundary>`로 감싸기
- **예상 변경량**: 1 파일, ~5줄

### 1.2 새로고침 시 세션 복원

- **파일**: `client/src/App.js:75`, `client/src/services/authApi.js`
- **문제**: localStorage에 JWT 토큰이 있어도 앱 재시작 시 `userId`가 `null`로 초기화됨. 매번 재로그인 필요.
- **작업**:
  - [ ] `App.js`에서 초기 마운트 시 저장된 토큰 확인
  - [ ] 토큰에서 userId 추출 (jwt-decode 라이브러리 또는 수동 Base64 파싱)
  - [ ] 토큰 만료 여부 검사 후 유효하면 userId 상태 복원
- **예상 변경량**: 1-2 파일, ~20줄
- **의존성**: jwt-decode 패키지 추가 고려

### 1.3 401 응답 시 React 상태 초기화

- **파일**: `client/src/services/notificationApi.js`, `client/src/App.js`
- **문제**: `handleErrorResponse()`가 401 시 `logout()` 호출 → localStorage만 삭제, React `userId` 상태는 유효한 채로 남음. UI는 로그인 상태인데 API만 실패하는 불일치.

> **2026-03-04 업데이트**: 리팩토링으로 `notificationApi.js`가 `getToken()`을 사용하도록 변경됨. `handleErrorResponse` 로직은 동일.

- **작업**:
  - [ ] App 레벨에서 401 감지 시 `setUserId(null)` 호출하는 콜백 연결
  - [ ] 방법 1: 커스텀 이벤트 (`window.dispatchEvent`) 활용
  - [ ] 방법 2: Context를 통한 logout 콜백 주입
- **예상 변경량**: 2-3 파일, ~15줄

### 1.4 알림 삭제 WebSocket 이벤트 추가

- **파일**: `server/controllers/notificationController.js:129-151`, `server/websocket/notificationEmitter.js`
- **문제**: create → `notification:new`, markAsRead → `notification:read`, markAllAsRead → `notification:read-all` 이벤트는 있으나 **delete에는 없음**. 멀티 디바이스에서 삭제가 실시간 반영 안 됨.
- **작업**:
  - [ ] `notificationEmitter.js`에 `emitNotificationDeleted(userId, notificationId)` 추가
  - [ ] `notificationController.js` delete 성공 후 emit 호출
  - [ ] 클라이언트 `useSocket.js`에 `notification:deleted` 리스너 추가
  - [ ] `useNotifications.js`에서 삭제 이벤트 처리
- **예상 변경량**: 4 파일, ~25줄

---

## Phase 2: 단기 개선 (High Priority)

> 기능적 공백 해소 및 기본 품질 향상

### 2.1 회원가입 UI 추가

- **파일**: `client/src/App.js`, `client/src/services/authApi.js`
- **문제**: `register` API 함수가 구현되어 있지만 UI가 없음. 신규 사용자가 앱에서 계정을 생성할 수 없음.
- **작업**:
  - [ ] 로그인 폼에 "회원가입" 탭/토글 추가
  - [ ] 이름(name) 입력 필드 추가
  - [ ] `authApi.register()` 연동
  - [ ] 등록 성공 시 자동 로그인 처리
- **예상 변경량**: 1-2 파일, ~50줄

### 2.2 알림 title 필드 UI 표시

- **파일**: `client/src/components/NotificationItem.js:32`
- **문제**: 서버가 반환하고 `transformNotification`도 매핑하는 `title` 필드가 UI에서 전혀 사용되지 않음.
- **작업**:
  - [ ] NotificationItem에서 `title` 디스트럭처링 추가
  - [ ] message 위에 title 표시 (bold 처리)
- **예상 변경량**: 1 파일, ~5줄

### 2.3 에러 표시 CSS 및 자동 해제

- **파일**: `client/src/App.css`, `client/src/App.js`
- **문제**: `app-error`, `login-form__error` CSS 클래스 정의 없음. 에러가 무한히 표시됨.
- **작업**:
  - [ ] `App.css`에 에러 스타일 추가 (배경색, 패딩, 테두리)
  - [ ] 에러 자동 해제 타이머 (5초) 또는 닫기 버튼
- **예상 변경량**: 2 파일, ~20줄

### 2.4 Health Check에 DB 상태 확인 추가

- **파일**: `server/index.js:58-60`
- **문제**: DB 연결이 끊어져도 `{ status: 'ok' }` 반환
- **작업**:
  - [ ] `getDatabase().prepare('SELECT 1').get()` DB ping 추가
  - [ ] 실패 시 503 + `{ status: 'degraded', db: 'disconnected' }` 반환
- **예상 변경량**: 1 파일, ~10줄

### 2.5 등록 응답에서 명시적 password_hash 제거

- **파일**: `server/routes/auth.js` (register 라우트의 응답 부분)
- **문제**: `password_hash` 제거가 `findById` 쿼리의 컬럼 선택에 암묵적 의존. `findById`가 `SELECT *`로 변경되면 해시 노출 위험.
- **작업**:
  - [ ] 로그인 라우트와 동일하게 `{ password_hash, ...safeUser } = user` 패턴 적용
- **예상 변경량**: 1 파일, ~3줄

### 2.6 유니코드 이스케이프 → 한글 직접 작성

- **파일**: `client/src/components/NotificationItem.js:3-15`
- **문제**: `TYPE_LABELS` 객체의 한글 문자열이 `\uC7A5\uBC14\uAD6C\uB2C8` 형태로 작성되어 가독성 저해
- **작업**:
  - [ ] 유니코드 이스케이프를 한글 문자열로 직접 교체
- **예상 변경량**: 1 파일, ~8줄

---

## Phase 3: 중기 개선 (Medium Priority)

> UX 품질 향상 및 접근성/반응형 대응

### 3.1 반응형 CSS

- **파일**: `client/src/App.css`, `client/src/notifications.css`
- **문제**: `@media` 쿼리 전무. 드롭다운 `width: 360px` 고정으로 소형 모바일에서 화면 초과.
- **작업**:
  - [ ] 주요 브레이크포인트 추가 (480px, 768px)
  - [ ] 드롭다운 `max-width: calc(100vw - 32px)` 적용
  - [ ] 알림 목록에서 message 줄임 처리 모바일/데스크톱 분리
- **예상 변경량**: 2 파일, ~40줄

### 3.2 접근성 개선

- **파일**: `client/src/components/NotificationItem.js`, `NotificationBell.js`, `App.js`
- **문제**: Space 키 처리 누락, `<label>` 없음, 색상 대비 미달, focus trap 없음
- **작업**:
  - [ ] NotificationItem: `onKeyDown`에 Space 키 추가
  - [ ] 로그인 폼: `<label>` 요소 추가 (htmlFor 연결)
  - [ ] CSS: `#999` → `#767676` (4.5:1 대비율 충족)
  - [ ] 드롭다운: Escape 키 닫기 + focus trap 구현
- **예상 변경량**: 4 파일, ~30줄

### 3.3 로딩 스켈레톤 UI

- **파일**: `client/src/components/NotificationList.js`
- **문제**: "불러오는 중..." 텍스트만 표시. 레이아웃 점프 발생.
- **작업**:
  - [ ] 스켈레톤 컴포넌트 생성 (또는 CSS-only skeleton)
  - [ ] 초기 로드와 추가 로드 UI 구분
- **예상 변경량**: 2-3 파일, ~40줄

### 3.4 Toast 알림

- **문제**: WebSocket으로 새 알림 수신 시 시각적 피드백 없음. 드롭다운이 닫혀있으면 뱃지 숫자 변경만 발생.
- **작업**:
  - [ ] 간단한 Toast 컴포넌트 생성
  - [ ] `useNotifications`에서 새 알림 수신 시 toast 트리거
  - [ ] 자동 해제 (3-5초) + 클릭 시 해당 알림으로 이동
- **예상 변경량**: 3 파일, ~60줄

### 3.5 Refresh Token 도입

- **파일**: `server/routes/auth.js`, `server/middleware/auth.js`, 클라이언트 서비스
- **문제**: 단일 JWT(7일 만료). 토큰 탈취 시 방어 불가.
- **작업**:
  - [ ] Access Token 만료를 15분으로 단축
  - [ ] Refresh Token (HttpOnly 쿠키) 발급 엔드포인트
  - [ ] `POST /api/auth/refresh` 엔드포인트
  - [ ] 클라이언트에서 401 시 자동 refresh 시도
- **예상 변경량**: 5+ 파일, ~100줄

> **2026-03-04 업데이트**: Phase 1.3의 401 처리 개선이 선행되어야 함.

### 3.6 낙관적 UI 롤백 구현

- **파일**: `client/src/hooks/useNotifications.js`
- **문제**: `markAsRead` 실패 시 이미 `isRead: true`로 변경된 UI가 원상복구되지 않음.

> **2026-03-04 업데이트**: 리팩토링으로 mark-as-read 로직이 `applyReadToOne` 헬퍼로 통합됨. 롤백 구현 시 이 헬퍼의 역연산을 추가하면 됨.

- **작업**:
  - [ ] API 호출 전 이전 상태 스냅샷 저장
  - [ ] catch 블록에서 이전 상태로 롤백
- **예상 변경량**: 1 파일, ~15줄

### 3.7 요청 로깅 미들웨어

- **파일**: `server/index.js`
- **문제**: HTTP 요청 로거 없음. 프로덕션 디버깅/모니터링 어려움.
- **작업**:
  - [ ] `morgan` 패키지 추가
  - [ ] development: 'dev' 포맷, production: 'combined' 포맷
- **예상 변경량**: 1 파일, ~5줄
- **의존성**: morgan 패키지

---

## Phase 4: 핵심 기능 (Strategic)

> 앱의 본래 목적 구현 및 장기 확장성 확보

### 4.1 쇼핑 리스트 CRUD 구현

- **문제**: "Shopping List App"이지만 쇼핑 리스트 기능이 전혀 없음
- **작업**:
  - [ ] `schema.sql`에 `shopping_lists`, `list_items` 테이블 추가
  - [ ] `server/models/shoppingListModel.js` 생성
  - [ ] `server/routes/shoppingLists.js` - 리스트 CRUD
  - [ ] `server/routes/listItems.js` - 아이템 CRUD
  - [ ] 클라이언트 컴포넌트: 리스트 목록, 리스트 상세, 아이템 추가/체크/삭제
  - [ ] WebSocket 이벤트: 리스트 공유 시 실시간 동기화
  - [ ] 기존 알림 시스템과 연동 (아이템 추가/구매 시 알림)
- **예상 변경량**: 10+ 파일, ~500줄

> **2026-03-04 업데이트**: 가장 큰 작업이지만 앱의 존재 이유.

### 4.2 DB 마이그레이션 버전 관리

- **파일**: `server/db/migrate.js`
- **문제**: `CREATE TABLE IF NOT EXISTS` 방식이라 스키마 변경(컬럼 추가 등)이 기존 DB에 반영 안 됨
- **작업**:
  - [ ] 마이그레이션 도구 선택 (umzug, knex, 또는 수동 버전 테이블)
  - [ ] 기존 스키마를 v001로 마이그레이션 파일 변환
  - [ ] 이후 변경사항은 새 마이그레이션 파일로 관리
- **예상 변경량**: 3+ 파일, ~50줄
- **의존성**: Phase 4.1 (쇼핑 리스트 테이블 추가) 시 필수

### 4.3 테스트 커버리지 보강

- **누락 테스트 목록**:
  - [ ] metadata 10KB 초과 검증
  - [ ] Rate limiter 429 반환 테스트
  - [ ] 만료 JWT로 HTTP API 호출 테스트
  - [ ] 등록/로그인 응답에 `password_hash` 미포함 assertion
  - [ ] 페이지네이션 경계값 (limit=0, offset=-1)
  - [ ] 알림 삭제 WebSocket 이벤트 (Phase 1.4 이후)
- **예상 변경량**: 3-4 파일, ~80줄

---

## 의존성 그래프

```text
Phase 1.3 (401 처리) ──→ Phase 3.5 (Refresh Token)
Phase 1.4 (삭제 이벤트) ──→ Phase 4.3 (테스트 보강)
Phase 4.1 (쇼핑 리스트) ──→ Phase 4.2 (마이그레이션 도구)
```

## 설계 트레이드오프 참고

| 현재 설계 결정 | 장점 | 단점 |
|---------------|------|------|
| SQLite (better-sqlite3) | 제로 인프라, 동기 API, 빠른 프로토타이핑 | 동시 쓰기 제한, 수평 확장 불가 |
| 싱글 JWT (refresh 없음) | 단순한 인증 플로우 | 토큰 탈취 시 방어 불가 |
| DB lazy initialization | 테스트 monkey-patching 가능 | 첫 요청 시 약간의 지연 |
| `CREATE TABLE IF NOT EXISTS` | 초기 설정 심플 | 스키마 진화 불가능 |
| localStorage JWT | 구현 심플, SPA 친화적 | XSS 취약 (HttpOnly 쿠키가 더 안전) |
