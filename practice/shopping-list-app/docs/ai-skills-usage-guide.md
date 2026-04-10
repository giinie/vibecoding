# AI-* 스킬 사용 가이드

> 외부 AI CLI 도구(Codex, Gemini, AmpCode)에 작업을 위임하는 스킬 모음입니다.

## 요약 (TL;DR)

| 하고 싶은 일 | 사용할 스킬 |
|-------------|-----------|
| 다른 AI 관점으로 코드 리뷰 | `/ai-review` |
| 원격 코드/패턴 검색 | `/ai-research` |
| 5개+ 파일 일괄 변환 | `/ai-parallel` |
| 복잡한 문제 심층 분석 | `/ai-deep` |
| 특정 프로바이더에 직접 위임 | `/ai-delegate codex\|gemini\|amp` |

모든 스킬은 Claude Code Agent Team으로 실행되며, 외부 CLI 실패 시 Claude가 직접 분석합니다 (최소 출력 보장).
codex 호출은 `/codex` 플러그인으로 자동 라우팅됩니다 (2026-04-01~, 구조화 JSON 출력 + 스레드 지속성).

---

## 역할 계층 (Role Hierarchy)

ai-* 스킬은 역할 계층에 따라 프로바이더를 선택합니다:

| 역할 | 에이전트 | 설명 |
|------|---------|------|
| **주체 (Principal)** | Claude Code | 기본 처리자. 대부분의 작업을 직접 수행. 모든 의사결정 담당. |
| **보조 (Sub-assistant)** | Codex, Gemini | 보완적 관점 제공, 병렬 처리, 검색 등 서브 작업 수행 |
| **최종병기 (Ultimate)** | amp | 복잡/핵심 작업에만 투입. 명시적 요청 또는 에스컬레이션 시에만 사용 |

**핵심 원칙**: Claude가 주체로서 판단하고, 필요할 때만 적절한 프로바이더에 위임합니다.

### 위임 판단 기준

| 위임하는 경우 | 직접 처리하는 경우 |
|-------------|----------------|
| 다른 모델의 관점이 필요할 때 (크로스 모델 리뷰) | 3개 미만 파일의 명확한 작업 |
| 외부 검색이 필요할 때 (Librarian, Google) | 로컬 도구(grep, LSP, 테스트)로 해결 가능할 때 |
| Claude가 2회 이상 시도 후 미해결 | 보안/컴플라이언스 감독이 필요할 때 |
| 5개 이상 파일의 동일 변환 | 공식 문서 조회 (context7 MCP 사용) |

---

## 스킬 목록

| 스킬 | 용도 | 기본 프로바이더 | 호출 예시 |
|------|------|---------------|----------|
| `ai-delegate` | 범용 위임 라우터 | codex (코드) / gemini (검색) | `/ai-delegate codex "이 코드 분석해줘"` |
| `ai-research` | 원격 코드베이스 검색 | gemini (Google 검색) | `/ai-research "React Server Components 구현 패턴"` |
| `ai-parallel` | 다중 파일 병렬 처리 | codex + gemini 병렬 분담 | `/ai-parallel "모든 CSS 파일을 Tailwind로 변환"` |
| `ai-review` | 크로스 모델 코드 리뷰 | codex + gemini 병렬 | `/ai-review "보안 취약점 검토"` |
| `ai-deep` | 복잡한 문제 심층 분석 | 에스컬레이션 단계별 | `/ai-deep "메모리 누수 원인 조사"` |

---

## 실행 모델: Claude Code Agent Team

Claude Code Agent Team 실행 모델은 2026-03-11 iteration-3에서 검증되었습니다.

### 왜 Team인가?

서브에이전트 환경에서 셸 메타문자(`<`, `>`, `|`, `$()`)가 Claude Code 권한 시스템에 의해 차단됩니다. Team teammate는 독립 Claude Code 프로세스로 실행되어 **모든 셸 명령을 제한 없이** 사용할 수 있습니다.

### 실행 흐름

```text
1. TeamCreate("ai-delegate-{provider}-{timestamp}")
2. TaskCreate("CLI 실행 작업")
3. Agent(team_name=..., name="cli-worker") → teammate 생성
4. Teammate가 CLI 실행 + 결과 보고
5. TeamDelete (성공/실패 모두 반드시 cleanup)
```

### 주요 제약 사항

| 제약 | 설명 |
|------|------|
| **리더당 1 Team** | TeamCreate는 동시에 1개 Team만 허용. 병렬 실행 시 1 Team + N teammates 사용 |
| **서브에이전트 제한** | Agent tool은 서브에이전트에서 사용 불가 → inline flag (`-p "text"`) fallback |
| **최소 출력 보장** | 모든 외부 CLI 실패 시 Claude가 직접 분석 수행 → 항상 결과 제공 |

### 스킬별 Team 패턴

| 스킬 | Team 구성 | 설명 |
|------|----------|------|
| ai-delegate | 1 Team + 1 teammate | 단일 프로바이더 실행 |
| ai-review | 1 Team + 2 teammates | codex-worker + gemini-worker 병렬 |
| ai-parallel | 1 Team + 2 teammates | codex-worker + gemini-worker 병렬 |
| ai-deep | 1 Team + 1 teammate | 에스컬레이션 단계별 |
| ai-research | 1 Team + 1 teammate | 단일 프로바이더 검색 |

### 최소 출력 보장 (Minimum Output Guarantee)

모든 ai-* 스킬은 외부 CLI가 실패하더라도 반드시 결과를 제공합니다:

| 실패 상황 | 대응 |
|----------|------|
| CLI 미설치 | Claude 직접 분석 + 설치 안내 |
| Team 생성 실패 | inline flag 시도 → Claude 직접 분석 |
| 타임아웃 | Claude 직접 분석 (부분 결과 포함) |

보고서에 다음이 명시됩니다:
`[NOTE] External providers unavailable — Claude-only analysis.`

---

## Codex Plugin Integration (2026-04-01)

codex 프로바이더 선택 시, raw CLI 대신 `/codex` 플러그인 명령어를 통해 실행됩니다.
`codex --help` 인터페이스 발견 단계(~3초)가 생략되고, App-Server 프로토콜,
GPT-5.4 프롬프트 최적화, 구조화 JSON 출력, 스레드 지속성이 자동 적용됩니다.

| 작업 유형 | /codex 명령어 | 주요 플래그 |
|----------|-------------|-----------|
| 코드 리뷰 | `/codex:review` | `--wait --scope auto` |
| 적대적 리뷰 | `/codex:adversarial-review` | `--wait --scope auto` |
| 일반 작업/분석 | `/codex:rescue` | `--wait --fresh` |
| 파일 수정 작업 | `/codex:rescue` | `--wait --fresh --write` |
| 이전 스레드 이어가기 | `/codex:rescue` | `--wait --resume` |

**gemini/amp 경로는 기존 Adaptive Execution Protocol (Phase 1-4) 유지.**
teammate 컨텍스트에서 Skill tool 접근 가능 검증 완료 (2026-04-01).

---

## 빠른 시작

### 1. CLI 설치 확인

```bash
which codex && echo "OK" || echo "NOT FOUND"
which gemini && echo "OK" || echo "NOT FOUND"
which amp && echo "OK" || echo "NOT FOUND"
```

최소 하나 이상의 CLI가 설치되어 있어야 합니다.

### 2. 스킬 호출

Claude Code에서 슬래시 명령으로 호출합니다:

```text
/ai-delegate codex "이 함수의 성능을 분석해줘"
```

또는 자연어로 트리거할 수 있습니다:

```text
"이 코드를 다른 AI로 리뷰해줘"     -> ai-review 트리거
"React 훅 패턴 참조 구현 찾아줘"    -> ai-research 트리거
"src/ 아래 모든 JS 파일 변환해줘"   -> ai-parallel 트리거
"이 버그 근본 원인을 깊게 분석해줘"  -> ai-deep 트리거
```

### 3. 사용자 확인

모든 ai-* 스킬은 실행 전 확인을 요청합니다:

```text
이 작업을 외부 AI CLI에 위임합니다.

  프로바이더: codex
  권한 수준: read-only

진행할까요?
```

---

## 언제 어떤 스킬을 사용하는가?

### 의사결정 가이드

| 질문 | 답변 | 추천 스킬 |
|------|------|----------|
| 다른 AI의 관점이 필요한가? | Yes | `/ai-review` (codex + gemini 병렬 리뷰) |
| 공식 문서를 찾는가? | Yes | context7 MCP 직접 사용 (위임 불필요) |
| 웹 검색이 필요한가? | Yes | `/ai-research` (gemini 기본) |
| 깊은 코드베이스 검색이 필요한가? | Yes | `/ai-research amp` (Librarian) |
| 5개+ 파일에 동일 작업이 필요한가? | Yes | `/ai-parallel` (codex + gemini 분담) |
| 5개 미만 파일인가? | Yes | Claude 직접 순차 처리 |
| 복잡한 문제를 깊이 분석해야 하는가? | Yes | Claude 1차 → 미해결 시 `/ai-deep` |
| 특정 프로바이더에 직접 위임하고 싶은가? | Yes | `/ai-delegate codex\|gemini\|amp "작업"` |

---

## 프로바이더 선택 기준

### Codex (`codex`) — 코드 작업 기본

- 샌드박스 실행으로 안전한 코드 분석
- `--search`(최상위 플래그)로 웹 검색 가능
- 구조화된 출력

### Gemini (`gemini`) — 검색/분석 기본

- Google 검색 통합으로 최적의 웹 검색
- Flash 모델로 빠르고 저렴한 처리
- 대용량 컨텍스트 윈도우

### AmpCode (`amp`) — 최종병기 (명시적 사용)

- Librarian으로 원격 코드베이스 검색
- `deep` 모드로 확장 추론
- 명시적 요청 또는 에스컬레이션 시에만 사용

### 프로바이더 선택 요약

| 상황 | 추천 프로바이더 | 이유 |
|------|---------------|------|
| 안전한 코드 리뷰 | codex | 샌드박스 격리 |
| 웹 기반 검색 | gemini | Google 검색 통합 |
| 빠른 단순 작업 | gemini (Flash) | 속도와 비용 효율 |
| 원격 코드 검색 | amp (Librarian) | GitHub/Bitbucket 직접 검색 |
| 심층 분석 | amp (deep) | 확장 추론 (에스컬레이션 후) |
| 크로스 모델 리뷰 | codex + gemini 병렬 | 다중 관점 확보 |
| 공식 문서 조회 | Claude (context7) | 위임 불필요 |

---

## 스킬별 상세 사용법

### ai-delegate: 범용 라우터

모든 ai-* 스킬의 허브 역할 (구조는 [아키텍처](#아키텍처) 참조).

```bash
/ai-delegate codex "이 함수의 시간 복잡도를 계산해줘"
/ai-delegate gemini "API 응답 구조를 설계해줘"
/ai-delegate amp "인증 모듈의 보안 취약점을 분석해줘"
/ai-delegate deep "확장 추론으로 아키텍처 분석"
```

**라우팅 규칙**:
- `codex` -> Codex CLI (코드 작업 기본)
- `gemini` -> Gemini CLI (검색/분석 기본)
- `amp` -> AmpCode CLI (명시적 요청 시)
- `deep` -> amp deep 모드
- `rush` -> amp rush 모드
- 미지정 (코드 작업) -> codex
- 미지정 (검색 작업) -> gemini

---

### ai-research: 원격 코드베이스 검색

다른 프로젝트의 구현 패턴을 검색할 때 사용합니다.

**트리거 키워드**: "참조 구현", "다른 프로젝트 참고", "오픈소스 예시", "best practices"

```bash
/ai-research "Socket.io 인증 미들웨어 구현 패턴"
/ai-research "Express.js rate limiting 모범 사례"
```

**검색 유형별 프로바이더**:
| 검색 유형 | 프로바이더 |
|----------|----------|
| 웹 검색 | gemini (기본) |
| npm/GitHub 패턴 | codex |
| 깊은 코드베이스 검색 | amp (Librarian) |
| 공식 문서 | Claude (context7 MCP) — 위임 불필요 |

---

### ai-parallel: 다중 파일 병렬 처리

5개 이상의 파일에 동일한 변환을 적용할 때 사용합니다.

**트리거 키워드**: "모든 파일", "일괄 변환", "병렬 처리", "대량 작업"

```bash
/ai-parallel "src/components/ 아래 모든 .jsx 파일을 TypeScript로 변환"
/ai-parallel "tests/ 아래 모든 테스트 파일에 setup/teardown 추가"
```

**파일 수 기준**:
| 파일 수 | 전략 |
|--------|------|
| < 5 | Claude 직접 순차 처리 |
| 5-20 | codex + gemini 병렬 분담 |
| 20+ | codex + gemini + amp (사용자 확인) |

---

### ai-review: 크로스 모델 코드 리뷰

다른 AI 모델의 관점에서 코드를 리뷰받을 때 사용합니다.

**트리거 키워드**: "세컨드 오피니언", "다른 관점", "교차 검증", "cross-check"

```bash
/ai-review "server/middleware/auth.js 보안 리뷰"
/ai-review "최근 변경사항 전체 리뷰"
```

**실행 전략**: Claude + codex (`/codex:review` 플러그인) + gemini 3개 병렬 리뷰 후 비교 보고서 생성
codex-worker는 구조화 JSON 출력(verdict, findings[], severity, file, line, confidence)을 반환합니다.

**결과 형식** -- 3자 비교 테이블:

```text
| # | 항목          | Claude | Codex | Gemini | 심각도   |
|---|--------------|--------|-------|--------|---------|
| 1 | SQL injection | 발견   | 발견  | 미발견  | CRITICAL |
| 2 | 입력 검증 누락 | 미발견  | 발견  | 발견   | WARNING  |
```

**amp 포함**: `/ai-review amp "..."` 또는 "amp도 포함해서" 라고 지정한 경우에만

---

### ai-deep: 복잡한 문제 심층 분석

근본 원인 조사, 대규모 리팩토링 계획 등 장시간 분석이 필요할 때 사용합니다.

**트리거 키워드**: "깊은 분석", "근본 원인", "복잡한 버그", "성능 병목", "대규모 리팩토링"

```bash
/ai-deep "WebSocket 연결이 간헐적으로 끊기는 원인 조사"
/ai-deep "notificationModel.js의 N+1 쿼리 성능 병목 분석"
```

**에스컬레이션 단계**:
| 단계 | 에이전트 | 조건 |
|------|---------|------|
| Level 1 | Claude | 단일 파일, 알려진 패턴, < 3 파일 |
| Level 2 | codex / gemini | Claude 1차 시도 실패 후 |
| Level 3 | amp (deep) | Level 2 미해결, Librarian 필요 |

**기본 프로바이더 선택 가이드** (사용자가 지정하지 않은 경우):
| 작업 유형 | 기본 프로바이더 | 이유 |
|----------|--------------|------|
| 성능/프로파일링 | gemini | 대규모 컨텍스트로 트레이스 분석 |
| 버그 근본 원인 (스택 트레이스) | codex | 구조화된 출력 |
| 아키텍처/설계 | amp | 확장 추론 |
| 일반 멀티파일 분석 | codex | 샌드박스, 안전한 기본값 |

---

## 공통 규칙

### 권한 수준

| 수준 | 의미 | 사용 스킬 |
|------|------|----------|
| Read-only | 파일 읽기만 가능 | ai-research, ai-review |
| File write | 파일 수정 가능 | ai-parallel |
| Full autonomy | 파일 수정 + 명령 실행 | ai-deep (Level 3) |

Full autonomy 플래그는 **반드시 사용자 확인** 후 사용됩니다.
단, 사용자가 프로바이더를 명시한 명령의 경우(예: `/ai-delegate codex review X`) 확인을 생략할 수 있습니다.

### CLI Exclusivity Rule

ai-* 스킬은 **외부 모델의 교차 관점**을 얻기 위해 존재합니다. 따라서 외부 CLI 호출을 내장 MCP 도구(exa, tavily, WebSearch 등)로 대체해서는 안 됩니다.

- **금지**: `mcp__exa__web_search_exa`, `mcp__tavily__tavily_search`, WebSearch/WebFetch 등으로 대체
- **예외**: context7 MCP는 공식 문서 조회(ai-research Step 1)에만 허용
- Team 생성 실패 시 MCP로 조용히 대체하지 말고 한계를 명확히 보고

### 폴백 체인

```text
codex (/codex plugin) -> codex (raw CLI fallback) -> gemini -> amp -> Claude fallback
```

가장 안전한(샌드박스) 프로바이더부터 시도하고, 최종적으로 Claude가 직접 처리합니다.
codex 플러그인 실패 시 raw CLI를 한 번 시도한 후 gemini로 넘어갑니다.

### 타임아웃

conventions.md의 Effort Levels(공통 규약)에 대응합니다:

| Effort Level | 작업 유형 | 시간 |
|-------------|----------|------|
| low | Quick/rush | 120초 |
| medium | 표준 (research, delegate) | 180초 |
| high | 코드 리뷰, 아키텍처 분석 | 600초 |
| max | 심층 분석, 병렬 처리 | 900초 |

### 에러 대응

| 상황 | 동작 |
|------|------|
| CLI 미설치 | 설치 명령 안내 |
| 인증 만료 | 재인증 가이드 |
| 크레딧 소진 | 다음 프로바이더 시도 |
| 타임아웃 | 다음 프로바이더 또는 Claude 직접 처리 |
| 빈 응답 | 1회 재시도 후 다음 프로바이더 |

---

## 아키텍처

```text
ai-delegate (허브: 역할 계층, Team 실행 모델, 보안 규칙, 폴백 체인)
  |
  +-- /codex plugin ── codex 호출 시 자동 라우팅 (review, rescue)
  |     (gemini/amp은 기존 adaptive protocol 유지)
  |
  +-- ai-research  (원격 검색: gemini 기본, amp Librarian 에스컬레이션)
  +-- ai-parallel  (배치 처리: 1 Team + 2 teammates 병렬 분담)
  +-- ai-review    (크로스 리뷰: 1 Team + 2 teammates 병렬, Claude 종합)
  +-- ai-deep      (심층 분석: 에스컬레이션 단계 Level 1-3)
```

`ai-delegate`가 역할 계층과 공통 규칙을 정의하고, 나머지 4개 스킬이 이를 참조하는 **허브-앤-스포크** 구조입니다. 스킬 파일 위치: `~/.claude/skills/ai-*/SKILL.md` (global Claude Code config, not in this repo)

---

## 검증 이력

이 가이드의 실행 모델은 iteration-3 E2E 테스트에서 검증되었습니다.

### iteration-3 (2026-03-11~12)

| 날짜 | 테스트 | 결과 | 비고 |
|------|--------|------|------|
| 2026-03-11 | Phase 0: teammate 권한 | PASS | `<`, `>`, `\|` 모두 허용 |
| 2026-03-11 | Test A: 단일 codex | PASS | Team lifecycle 정상 |
| 2026-03-11 | Test B: fallback chain | PASS | Minimum Output Guarantee 동작 |
| 2026-03-12 | Test C: ai-review 병렬 | PASS | 1 Team + 2 teammates 병렬 성공 |
| 2026-03-11 | Test D: 서브에이전트 | PARTIAL | Agent tool 미지원 → inline fallback |
| 2026-03-12 | SKILL.md 동기화 Test A: 단일 codex | PASS | stdin redirect `<` 정상, Team lifecycle 정상 |
| 2026-03-12 | SKILL.md 동기화 Test B: 병렬 리뷰 | PASS | 1 Team + 2 teammates (codex + gemini) 병렬 성공 |
| 2026-03-12 | SKILL.md 동기화 Test C: MOG fallback | PASS | CLI 미설치 시 Claude 직접 분석 + `[NOTE]` 메시지 |

### Codex Plugin Integration (2026-04-01)

| 날짜 | 테스트 | 결과 | 비고 |
|------|--------|------|------|
| 2026-04-01 | Teammate Skill tool 접근 | PASS | teammate에서 Skill("/codex:setup") 성공 |
| 2026-04-01 | ai-delegate codex via /codex plugin | PASS | Skill("/codex:rescue --wait --fresh") 경로로 보안 분석 완료 |
| 2026-04-01 | ai-review 병렬 교차 검증 | PASS | codex-worker(/codex:review) + gemini-worker(adaptive) 병렬 성공, 9개 이슈 탐지 |

상세 결과: `ai-delegate-workspace/` 디렉토리 참조 (`.gitignore` 대상, 로컬에서만 확인 가능)
