# 보안 감사 후속 조치 보고서

> **작성일**: 2026-02-16
> **브랜치**: `practice`
> **이전 작업**: Phase 1-4 보안 강화 (JWT, helmet, rate limiting, input validation, UUID 검증 등)
> **상태**: 완전 구현 완료. 결정 기록 용도로 보존.

---

## 배경

Phase 1-4 보안 강화 구현 후, 보안 전문가 + 코드 리뷰어의 최종 감사에서 코드 레벨 보안 갭이 발견되었다.
기존 아키텍처(helmet, rate limiting 등)는 양호하나, JWT 알고리즘 미지정, 타입 검증 누락, bcrypt 에러 노출 등 **세부 구현의 빈틈**을 메우는 작업이었다.

---

## 수행 내역

### Phase A: Critical Code Fixes (6건)

| # | 항목 | 파일 | 핵심 변경 |
|---|------|------|-----------|
| A-1 | JWT 알고리즘 명시 | `auth.js`, `middleware/auth.js`, `socketAuthMiddleware.js` | `sign()`에 `algorithm: 'HS256'`, `verify()`에 `algorithms: ['HS256']` |
| A-2 | typeof 타입 검증 | `notificationController.js` | `title`, `message`에 `typeof !== 'string'` 체크 추가 |
| A-3 | notification type 앱 레벨 검증 | `notificationController.js` | `VALID_TYPES` 배열로 DB 도달 전 조기 검증 |
| A-4 | bcrypt 에러 처리 | `userModel.js` | `verifyPassword()`에 try-catch, 실패 시 `false` 반환 |
| A-5 | 이메일 정규화 | `auth.js`, `userModel.js` | `toLowerCase().trim()` + `LOWER(email) = LOWER(?)` *[후속 변경 있음]* |
| A-6 | POST body user_id UUID 검증 | `notificationController.js` | URL param은 미들웨어로, body는 컨트롤러 내 직접 검증 |

> **A-5 후속 변경 (2026-02-23)**: 앱 레벨 정규화(`toLowerCase().trim()`)가 충분하므로 SQL을 `email=?` 직접 비교로 변경 — 인덱스 활용 개선.

### Phase B: Server Configuration Fixes (3건)

| # | 항목 | 파일 | 핵심 변경 |
|---|------|------|-----------|
| B-1 | Trust Proxy 설정 | `index.js` | `TRUST_PROXY` 환경변수 기반 opt-in |
| B-2 | NODE_ENV 에러 메시지 기본값 | `index.js` | `=== 'production'` → `=== 'development'` (fail-safe 전환) |
| B-3 | 프로덕션 로그 정리 | `socketManager.js` | userId 로깅을 개발 환경에서만 수행 |

### Phase C: 검증용 테스트 추가 (18건)

| # | 테스트 그룹 | 파일 | 테스트 수 |
|---|------------|------|-----------|
| C-1 | 입력 검증 (non-string, 길이 초과, 잘못된 type, non-UUID body) | `notification.api.test.js` | 6 |
| C-2 | UUID 검증 (GET/PATCH/DELETE param) | `notification.api.test.js` | 3 |
| C-3 | 인증 에지 케이스 (비밀번호 길이, 이메일 형식, 이름 길이, 이메일 정규화, 중복 가입, 대소문자 로그인) | `auth.test.js` (신규) | 9 |

---

## 변경 파일 요약

```diff
server/controllers/notificationController.js   | 16 ++-
server/index.js                                | 11 +-
server/middleware/auth.js                      |  2 +-
server/models/userModel.js                     |  8 +-
server/routes/auth.js                          | 14 ++-
server/websocket/socketAuthMiddleware.js       |  2 +-
server/websocket/socketManager.js              |  4 +-
tests/integration/notification.api.test.js     | 121 +++++++++
tests/integration/auth.test.js                 | 신규 파일
───────────────────────────────────────────────
9 files changed, +163, -15
```

---

## 테스트 결과

```text
Test Suites: 7 passed, 7 total
Tests:       69 passed, 69 total (기존 51 + 신규 18)
Time:        2.352s
```

---

## 적용 원칙

| 원칙 | 적용 사례 |
|------|-----------|
| **Defense in Depth** | notification type을 앱 레벨 + DB CHECK 이중 검증 |
| **Fail-Safe Defaults** | NODE_ENV 미설정 시 에러 메시지 숨김 |
| **Least Information** | bcrypt 에러를 잡아 사용자 존재 여부 추론 차단 |
| **Input Validation at Boundary** | typeof 검증, UUID 형식 검증, 이메일 정규화 |
| **Algorithm Pinning** | JWT sign/verify에 HS256 명시로 Algorithm Confusion 차단 |

---

## 범위 외 (별도 계획 필요)

| 항목 | 이유 | 상태 |
|------|------|------|
| JWT 토큰 폐기 메커니즘 | Redis/DB 블랙리스트 필요 (아키텍처 변경) | 미해결 |
| localStorage → httpOnly 쿠키 | 서버 세션 관리 전환 필요 | 미해결 |
| WebSocket Rate Limiting | 추가 미들웨어/라이브러리 필요 | 미해결 |
| 계정 열거 방지 (409 → 400) | UX 트레이드오프 논의 필요 | 미해결 |
| HTTPS 강제 | 배포 환경 의존적 | 미해결 |
