# Todo

> **Status**: 전체 완료 (2026-05-04). 추가: user-scope + project-scope 지침 문서 정합성 강화 31건 처리.

## 사용자 지침 문서 정합성 강화 (2026-05-04)

출처: 사용자 검토 요청 (user-scope `~/.claude/` + project-scope 지침 문서 일괄 점검)

### user-scope 변경 (`~/.claude/`, this repo 외부 — 별도 백업/dotfiles 관리 권장)

- [x] CLAUDE.md (4 edits High/Medium + 2 edits Low) — `oh-my-claudecode:document-specialist` namespace fix, agent 카탈로그 확장, MCP Server Routing 신규 섹션, auto-memory advisory rule, Code Review 라벨 정리
- [x] USER_REQUIREMENTS.md (2 edits) — Windows pnpm symlink cross-link 추가, AI 에이전트 문서 영어 작성 대상 명시
- [x] CODE_QUALITY.md (1 edit) — 200/50줄 임계치 → 원칙형 표현
- [x] ENV_COMPATIBILITY.md (4 edits) — PowerShell 1급 시민화, `node -e $HOME` 함정 추가, Path separators shell-neutral 재구성, Symlinks nested list 통합

### project-scope 변경 (5개 파일, 18 edits)

- [x] CLAUDE.md (8 edits)
  - Skill Policy: Skill Routing + MCP Server Routing inheritance 명시
  - `oh-my-claudecode:code-reviewer` default agent 추가
  - Critical Rules: 데이터 검증 룰의 `MUST` 절제 (11→8건)
  - Doc sync 룰 강화 ("consider" → "run")
  - Windows PowerShell `Copy-Item` 안내
  - NODE_ENV 가능 값 3종 명시 (development/production/test)
  - TL;DR에 Critical Rules 하이퍼링크
  - Architecture 요약의 test count → dynamic 참조 (cross-file 일관성)
- [x] WORKFLOW_ORCHESTRATION.md (4 edits)
  - Planning에 `context7` MCP cross-link
  - Subagent Usage가 user-scope OMC override 메커니즘 참조
  - Verification 추상 self-check → 3-question 체크리스트
  - Lesson promotion 정량 기준 (3+ violations OR high blast radius)
- [x] tasks/lessons.md (1 rewrite) — promoted entry prune, 활성 lesson 0건 안내
- [x] docs/architecture.md (4 edits)
  - Database 섹션에 `schema.sql` source-of-truth 링크
  - WebSocket isTokenExpired() cross-ref → CLAUDE.md
  - Tests 카운트 → dynamic file pattern 참조 (drift 방지)
  - Key Reference Docs를 Evergreen vs Historical Reports로 분리
- [x] .claude/settings.json (1 rewrite)
  - stale `mcp__chrome-devtools__take_screenshot` 제거 → `mcp__claude-in-chrome__take_screenshot` 교체
  - 자주 쓰는 npm 명령 5개 권한 추가 (test, run, install, --prefix, npx jest)

### 검증

- [x] 17개 project-scope edit 적용 후 5개 파일 재읽기 — cross-file 정합성 확인
- [x] cross-scope 정합성 — user-scope 신규 항목(MCP Routing, code-reviewer default)이 project-scope에 정확히 반영
- [x] 후속 검토 — `tasks/todo.md` (이 항목 추가), `docs/ai-skills-usage-guide.md` (user-scope MCP routing과 이미 정합 → 수정 불필요)
- [x] `.mcp.json` 검증 — chrome-devtools MCP 미등록 확인 후 settings.json에서 안전 제거

### 후속 권장 사항

- user-scope `~/.claude/` 변경분은 별도 dotfiles 저장소로 백업 권장
- 다음 세션 시작 시 새 룰들이 자동 적용됨 (별도 reload 불필요)

---

## CLAUDE.md Architecture 섹션 분리 (2026-04-29)

## CLAUDE.md Architecture 섹션 분리 (2026-04-29)

출처: 프로젝트 스코프 사용자 지침 검토 결과(P2 권고 #1) — CLAUDE.md 253줄 → 컨텍스트 토큰 절감 목적

### 배경
- `## Architecture` 섹션(파일 트리 + Security 구현 디테일 + API 표 + Tests + Documentation 포인터)이 자주 변하지 않음에도 항상 컨텍스트에 로드됨
- Critical Rules / Key Patterns(WHY 주석)는 회귀 방지에 직접 관여하므로 CLAUDE.md에 유지
- 전제: AI 에이전트는 정확한 파일 경로/엔드포인트가 필요할 때만 architecture를 읽으면 됨

### 변경
- [x] `docs/architecture.md` 신규 작성 — Server file tree + DB/WebSocket 세부사항 + Security + Client file tree + Tests + API Endpoints + Key Reference Docs
  - 문서 상단에 "When to read / NOT to read" 가이드 명시
  - 언어: 영어 (사용자 글로벌 지침: AI 에이전트 참조 문서는 영어)
- [x] `CLAUDE.md`의 `## Architecture` 섹션을 stub으로 교체
  - 링크 + 4-bullet "At a glance" 요약 (Backend / Frontend / Tests / Security)
  - 약 124줄 → 약 8줄로 축소

### 검증
- [x] CLAUDE.md 줄 수 비교 (before: 253 → after: 137, 약 46% 감소)
- [x] Architecture 참조 깨짐 없음 — `## Architecture` 헤더는 stub으로 유지되어 CLAUDE.md:27의 "Architecture section" 참조 호환
- [x] CLAUDE.md 정보 손실 없음 — TL;DR / Critical Rules / Key Patterns / Env Vars 모두 그대로, Architecture 디테일만 이전
- [x] sync-docs 분석 통과 — file tree(13+13), 테스트 카운트(10+5), API 엔드포인트(10) 모두 코드와 100% 일치
- [x] CHANGELOG.md `[Unreleased]` 섹션에 `### 2026-04-29 > Docs` 항목 추가 (sync-docs 권고 반영)

## Codex 리뷰 지적사항 수정 (2026-04-09)

출처: Codex review on `practice` branch working tree diff

### [P1] 기존 구매 데이터 `purchased_at` 백필 누락
- [x] `server/db/migrate.js` — 마이그레이션에 백필 쿼리 추가
  - `ALTER TABLE` 직후 `UPDATE shopping_items SET purchased_at = created_at WHERE is_purchased = 1 AND purchased_at IS NULL` 실행
  - 멱등성: `hasPurchasedAt` 분기 안에서만 실행되므로 이미 컬럼이 있는 DB에서는 스킵

### [P2] 구매 상태 변경 시 추천 캐시 무효화 누락
- [x] `server/controllers/shoppingItemController.js` — `togglePurchased()` 성공 후 `clearRecommendationCache(req.userId)` 호출
  - 모델이 아닌 컨트롤러 레벨에서 처리 (기존 WebSocket emit 패턴과 동일)
  - `recommendationService.clearCache(userId)` 재사용

### Review
- 전체 테스트 통과 (15 suites, 145 tests) ✓

---

## Codex 리뷰 지적사항 (2026-04-10)

출처: Codex review on `practice` branch, last 3 days diff against `a42c15d^`

### [P2] 추천 패널 미사용 시 불필요한 API 호출
- [x] `client/src/App.js:42-49` — `useRecommendations(userId)`가 로그인 직후 무조건 마운트됨
  - 패널을 열지 않아도 `/api/recommendations/:userId`를 호출하여 불필요한 Claude API 비용/지연 발생
  - 수정: `enabled` 플래그 추가, `{ enabled: showRecommendations }` 전달

### [P2] 추천 아이템 추가 버튼 더블클릭 레이스 컨디션
- [x] `client/src/hooks/useRecommendations.js:25-30` — `addingIds` 가드가 빠른 연속 클릭을 차단하지 못함
  - `setAddingIds()`가 비동기라 React 리렌더 전에 두 번째 클릭이 가드를 통과 → 중복 아이템 생성
  - 수정: `useRef` 동기 가드 + `setAddingIds` UI 렌더링용 유지

### [P2] 새로고침 시 서버 캐시가 무효화되지 않음
- [x] `server/services/recommendationService.js:134-137` — 캐시 TTL 1시간 동안 동일한 추천 반환
  - 사용자가 새로고침 버튼을 눌러도 서버 캐시가 그대로라 이전 추천이 재등장
  - 수정: `?refresh=true` 쿼리 파라미터로 서버 캐시 강제 무효화

---

## 구현 계획: 추천 기능 P2 수정 3건 (2026-04-11)

### Fix 1. 패널 미사용 시 불필요 API 호출 제거

**원인**: `useRecommendations(userId)`가 `AppContent` 마운트 시점에 `useEffect → loadRecommendations()` 무조건 실행
**수정 범위**: `useRecommendations.js`, `App.js`

- [x] 1-1. `useRecommendations`에 `enabled` 파라미터 추가
  - 시그니처: `useRecommendations(userId, { enabled = false } = {})`
  - `useEffect` 내에서 `enabled`가 `true`일 때만 `loadRecommendations()` 호출
  - `enabled`를 deps에 추가 → false→true 전환 시 자동 fetch
- [x] 1-2. `App.js`에서 `showRecommendations`를 `enabled`로 전달
  - `useRecommendations(userId, { enabled: showRecommendations })`

### Fix 2. 추가 버튼 더블클릭 레이스 컨디션 수정

**원인**: `setAddingIds()`가 비동기(React 배칭) → 리렌더 전 두 번째 클릭이 `addingIds.has()` 가드 통과
**수정 범위**: `useRecommendations.js`

- [x] 2-1. `useRef`로 동기 가드 추가
  - `const addingRef = useRef(new Set())` 선언
  - `addRecommendedItem` 진입 시 `addingRef.current.has(item.id)` 체크 (동기)
  - 가드 통과 후 즉시 `addingRef.current.add(item.id)` (동기 잠금)
  - finally에서 `addingRef.current.delete(item.id)` (동기 해제)
  - `setAddingIds`는 UI 렌더링용으로 유지
- [x] 2-2. `useCallback` deps에서 `addingIds` 제거
  - ref 기반이므로 `addingIds` 의존성 불필요 → `[]`로 변경

### Fix 3. 새로고침 시 서버 캐시 강제 무효화

**원인**: `generateRecommendations()`가 캐시 존재 시 즉시 반환, 클라이언트 새로고침이 캐시를 우회할 수단 없음
**수정 범위**: `recommendationController.js`, `recommendationApi.js`, `useRecommendations.js`

- [x] 3-1. 컨트롤러에 `refresh` 쿼리 파라미터 지원
  - `req.query.refresh === 'true'` → `clearCache(userId)` 호출 후 `generateRecommendations()` 실행
- [x] 3-2. 클라이언트 `fetchRecommendations()`에 `refresh` 옵션 추가
  - `fetchRecommendations(userId, { refresh })` → URL에 `?refresh=true` 쿼리스트링 추가
- [x] 3-3. `useRecommendations`의 `refresh` 함수가 서버 캐시 무효화 옵션 전달
  - `refresh` 호출 시 `fetchRecommendations(userId, { refresh: true })`
  - 초기 로드(패널 열림)는 캐시 사용: `fetchRecommendations(userId)` (refresh 없음)

### 테스트

- [x] 4-1. 통합 테스트 추가: `GET /api/recommendations/:userId?refresh=true`가 캐시 무시 확인
- [x] 4-2. 전체 테스트 통과 확인 (`npm test`) — 15 suites, 146 tests ✓

### 추가 수정

- [x] `lru-cache` v5.1.1 호환성 수정: `{ LRUCache }` → default import, `ttl` → `maxAge`, `delete` → `del`, `clear` → `reset`

---

## 문서 품질 개선: enhance-docs HIGH 이슈 (2026-04-11)

출처: `/enhance:enhance-docs` 분석 결과, HIGH 8건 수정

### [Group A] tasks/todo.md (HIGH #1, #8) — 독립 실행 가능

- [x] A-1. 2026-04-10 섹션의 미체크 3개 항목 `[x]`로 변경 (실제 구현 완료됨)
- [x] A-2. 파일 상단에 완료 상태 명시 — 에이전트 재작업 방지

### [Group B] CLAUDE.md (HIGH #2, #3, #4) — 독립 실행 가능

- [x] B-1. `### Server` 아래 Database/WebSocket 100+ 단어 단일 bullet → 서브 bullet으로 분리 (RAG 청킹 개선)
- [x] B-2. `### Documentation (docs/)` 섹션 → `### Key Reference Docs` + 테이블로 변경
- [x] B-3. `@WORKFLOW_ORCHESTRATION.md` 인라인 참조 → 명시적 마크다운 링크로 변경

### [Group C] CHANGELOG.md (HIGH #5, #6) — 독립 실행 가능

- [x] C-1. `[Unreleased]` 아래 날짜 서브헤딩 → `#### Fixed (2026-04-11)` / `#### Added (2026-04-09)` 포맷으로 병합
- [x] C-2. `docs/ai-skills-usage-guide.md`의 `~/.claude/skills/` 경로에 `(global Claude Code config, not in this repo)` 주석 추가

### [Group D] docs/ai-skills-usage-guide.md (HIGH #7) — 독립 실행 가능

- [x] D-1. `<details>` HTML 접이식 블록 → 표준 마크다운 `## 검증 이력` 섹션으로 변환 (RAG 파이프라인 가시성 확보)

---

## 문서 품질 개선: enhance-docs MEDIUM 이슈 (2026-04-11)

출처: `/enhance:enhance-docs` 분석 결과, MEDIUM 16건 중 15건 수정 (M12는 C-2에서 기완료)

### CLAUDE.md (M1–M4)

- [x] M1. TL;DR에 `ANTHROPIC_API_KEY must be unset in tests` 추가
- [x] M2. 추천 관련 bullet 2개를 `### Recommendation Feature` 서브섹션으로 분리
- [x] M3. `useRecommendations.js` 파일맵 설명 축약 (일관성)
- [x] M4. Recommendations API 표 셀 축약 + 각주 분리

### CHANGELOG.md (M5–M6)

- [x] M5. 날짜 헤딩 괄호 부제 4개 제거 (일관성)
- [x] M6. `[0.2.0]` forward reference 축약 `*(superseded in 2026-03-04)*`

### WORKFLOW_ORCHESTRATION.md (M7–M9)

- [x] M7. Session Start를 blockquote에 통합
- [x] M8. 에이전트 전용 bullet에 `**Operational Notes (Agent)**` 라벨 추가
- [x] M9. `this file(WORKFLOW_ORCHESTRATION.md)` → `this file` 괄호 제거

### tasks/lessons.md (M10)

- [x] M10. 승격 완료 항목을 한 줄 메모로 축약

### docs/ai-skills-usage-guide.md (M11, M13)

- [x] M11. `[아키텍처](#아키텍처)` 한국어 앵커 → 텍스트 참조로 변경
- [x] M13. `## 아키텍처` 섹션을 `## 역할 계층` 직후로 이동 (고주의 콘텐츠 상단 배치)

### docs/security-cross-verification-2026-03-07.md (M14–M15)

- [x] M14. N-4 업데이트 노트 blockquote → bold 접두사로 변경
- [x] M15. 요약 표 아래 각주 추가 (N-4 partially resolved 상세)
