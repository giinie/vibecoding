# AmpCode Harness Skill Family Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create 5 Claude Code Skills (`amp-delegate`, `amp-review`, `amp-deep`, `amp-research`, `amp-parallel`) that enable Claude Code to delegate tasks to AmpCode CLI.

**Architecture:** Each Skill is a standalone SKILL.md file in `~/.claude/skills/amp-*/`. Skills are triggered either automatically (via description keyword matching) or manually (`/amp`). All AmpCode invocations go through Bash with mandatory `--no-ide --no-notifications` flags.

**Tech Stack:** Claude Code Skills (SKILL.md format), Bash (amp CLI), AmpCode CLI

---

### Task 1: Verify AmpCode CLI Environment

**Files:**
- None (verification only)

**Step 1: Verify amp CLI is installed and accessible**

Run: `which amp && amp --version`
Expected: Path to amp binary + version string

**Step 2: Verify amp execute mode works**

Run: `amp --no-ide --no-notifications -x "Reply with only the word: OK"`
Expected: Output containing "OK"

**Step 3: Verify amp deep mode is available**

Run: `amp --no-ide --no-notifications -m deep -x "Reply with only the number: 42" 2>&1 | head -5`
Expected: Output containing "42" (may take longer due to deep thinking)
Note: If deep mode requires paid credits and fails, note this for error handling in Skills.

**Step 4: Create skills directory structure**

Run:
```bash
mkdir -p ~/.claude/skills/amp-delegate
mkdir -p ~/.claude/skills/amp-review
mkdir -p ~/.claude/skills/amp-deep
mkdir -p ~/.claude/skills/amp-research
mkdir -p ~/.claude/skills/amp-parallel
```
Expected: Directories created without error

---

### Task 2: Create amp-delegate Skill (Universal Router)

**Files:**
- Create: `~/.claude/skills/amp-delegate/SKILL.md`

**Step 1: Write the SKILL.md file**

```markdown
---
name: amp-delegate
description: >
  Delegate tasks to AmpCode CLI for multi-model AI assistance.
  Use this skill when explicitly invoked with /amp command, or when
  the user wants to send a task to AmpCode. Supports mode selection:
  /amp deep (GPT-5.3 Codex), /amp rush (fast/cheap), /amp smart (default Claude Opus).
  Keywords: /amp, delegate to amp, ampcode, send to amp, forward to amp,
  amp으로 위임, amp에게 맡겨, amp 사용
---

# AmpCode Delegate — Universal Router

## Purpose

Route tasks to AmpCode CLI. This is the manual entry point (`/amp`) and
fallback for general AmpCode delegation.

## Prerequisites

AmpCode CLI must be installed: `curl -fsSL https://ampcode.com/install.sh | bash`

## Workflow

### Step 1: Verify AmpCode CLI

Run `which amp` to verify installation. If not found, inform user:
"AmpCode CLI가 설치되어 있지 않습니다. 설치: `curl -fsSL https://ampcode.com/install.sh | bash`"

### Step 2: Parse Mode and Prompt

Parse the user's input for mode hints:
- `/amp deep ...` or "deep 모드" → mode = `deep`
- `/amp rush ...` or "rush 모드" → mode = `rush`
- `/amp smart ...` or no mode specified → mode = `smart` (default)

Extract the actual task prompt after the mode keyword.

### Step 3: Determine Prompt Strategy

Based on the task, decide how to pass context to Amp:
- **File review/analysis**: Pass file paths in prompt — Amp will read them directly
  - Example: `"Read src/index.js and analyze the architecture"`
- **Code snippet**: For small code (<100 lines), include inline
- **Large context**: Pipe via stdin
  - Example: `cat file.js | amp --no-ide --no-notifications -x "Review this code"`

### Step 4: Execute AmpCode

Run via Bash tool:

```bash
amp --no-ide --no-notifications -m {mode} -x "{constructed_prompt}"
```

Timeout guidelines:
- smart/rush mode: 120 seconds
- deep mode: 300 seconds (5 minutes)

If the command fails or times out, report the error and offer to handle
the task directly as Claude Code.

### Step 5: Synthesize and Report

Present the AmpCode result to the user with context:

```
## AmpCode 위임 결과

**모드**: {mode} ({model_name})
**작업**: {task_summary}

### Amp 응답
{amp_result}

### Claude 보충 분석
{any additional context or corrections from Claude's perspective}
```

## Error Handling

| Error | Action |
|-------|--------|
| `amp` not found | Show installation instructions |
| Non-zero exit code | Show error output + offer Claude fallback |
| Timeout | Report timeout + handle task directly |
| Empty response | Retry once, then fallback to Claude |

## Mode Reference

| Mode | Model | Best For | Typical Duration |
|------|-------|----------|-----------------|
| smart | Claude Opus 4.6 | General tasks, quick edits | 10-60s |
| deep | GPT-5.3-Codex | Complex analysis, thorough investigation | 1-15min |
| rush | (varies) | Simple, well-defined tasks | 5-30s |
```

**Step 2: Verify the skill appears in Claude Code**

Restart Claude Code or run `/skills` to confirm `amp-delegate` appears in the skill list.

**Step 3: Test manual invocation**

Test with: `/amp 현재 디렉토리의 파일 구조를 설명해줘`
Expected: AmpCode executes and returns file structure analysis.

**Step 4: Commit**

```bash
cd ~/.claude/skills && git init 2>/dev/null
git add amp-delegate/SKILL.md
git commit -m "feat: add amp-delegate skill — universal AmpCode router"
```

---

### Task 3: Create amp-review Skill (Cross-Model Code Review)

**Files:**
- Create: `~/.claude/skills/amp-review/SKILL.md`

**Step 1: Write the SKILL.md file**

```markdown
---
name: amp-review
description: >
  Cross-model code review using AmpCode. Delegates code review to a different
  AI model family (GPT-5.3 via Deep mode or GPT-5.2 via Oracle) for independent
  verification. Use when: needing a second opinion on code quality, wanting
  cross-model validation of architecture decisions, security audit from a different
  perspective, reviewing Claude's own output for blind spots.
  Keywords: second opinion, cross-check, verify, validate, different perspective,
  다른 관점, 교차 검증, 세컨드 오피니언, GPT로 리뷰, 다른 모델로 확인,
  blind spot check, independent review, cross-model review
---

# AmpCode Review — Cross-Model Code Verification

## Purpose

Get a second opinion from a different AI model family. Claude (Opus 4.6) and
GPT-5.3-Codex have different strengths and blind spots. Cross-model review
catches issues that a single model might miss.

## When This Skill Triggers Automatically

Claude Code should consider using this skill when:
- User asks for "다른 관점" or "second opinion" on code
- User explicitly mentions GPT or a non-Claude model
- A security or architecture review would benefit from cross-validation
- Claude is uncertain about its own analysis and another perspective would help

**Before auto-triggering, always confirm with the user:**

```
이 작업은 AmpCode Deep(GPT-5.3-Codex)로 교차 검증하면 효과적일 것 같습니다.
다른 모델 가족의 관점에서 리뷰하여 blind spot을 찾아낼 수 있습니다.

  위임 유형: 크로스 모델 코드 리뷰
  모드: Deep (GPT-5.3-Codex)
  예상 이점: 다른 모델 가족의 독립적 관점

AmpCode로 위임할까요? (Amp 크레딧이 소비됩니다)
```

## Workflow

### Step 1: Collect Review Target

Determine what to review:
- If user specifies files → use those file paths
- If reviewing recent changes → run `git diff --name-only` to get changed files
- If reviewing a feature → identify relevant files from context

### Step 2: Construct Review Prompt

Build a focused review prompt for AmpCode:

```
You are reviewing code for quality, security, and architectural issues.
Focus on finding problems that might be missed by Claude/Anthropic models.

Review the following files in this project:
{file_paths}

Analyze for:
1. Security vulnerabilities (injection, auth bypass, data exposure)
2. Architectural issues (coupling, wrong abstractions, scalability)
3. Logic errors and edge cases
4. Performance concerns (N+1 queries, memory leaks, blocking operations)
5. Race conditions and concurrency issues

For each finding, provide:
- Severity: CRITICAL / WARNING / INFO
- File and approximate location
- Description of the issue
- Suggested fix

Be thorough. This is a cross-model verification — find things the original
developer (using Claude) might have missed.
```

### Step 3: Execute AmpCode Review

```bash
amp --no-ide --no-notifications -m deep -x "{review_prompt}"
```

Timeout: 300 seconds (deep mode can take time for thorough review).

### Step 4: Generate Comparative Report

After receiving Amp's review, Claude performs its own quick review of the
same files, then produces a synthesis:

```markdown
## 크로스 모델 코드 리뷰 결과

**리뷰 대상**: {files}
**Amp 모드**: Deep (GPT-5.3-Codex)

### 발견 사항 비교

| # | 항목 | Claude (Opus 4.6) | Amp (GPT-5.3) | 심각도 |
|---|------|-------------------|---------------|--------|
| 1 | {issue} | {found/missed} | {found/missed} | {severity} |
| ... | ... | ... | ... | ... |

### 양쪽 모두 발견 (높은 신뢰도)
{issues found by both models — high confidence, fix immediately}

### Amp만 발견 (추가 검토 필요)
{issues only Amp found — review and validate}

### Claude만 발견 (참고)
{issues only Claude found — likely valid but cross-check}

### 종합 권장사항
{prioritized action items}
```

## Error Handling

Same as amp-delegate. On failure, Claude performs its own review independently
and notes that cross-model verification was not available.
```

**Step 2: Test with a real code review**

Test with: "src/server/index.js를 다른 관점에서 리뷰해줘"
Expected: Claude detects amp-review trigger, asks confirmation, executes, synthesizes report.

**Step 3: Commit**

```bash
cd ~/.claude/skills
git add amp-review/SKILL.md
git commit -m "feat: add amp-review skill — cross-model code review"
```

---

### Task 4: Create amp-deep Skill (Deep Analysis)

**Files:**
- Create: `~/.claude/skills/amp-deep/SKILL.md`

**Step 1: Write the SKILL.md file**

```markdown
---
name: amp-deep
description: >
  Delegate complex analysis tasks to AmpCode Deep mode (GPT-5.3-Codex)
  for extended autonomous reasoning. Deep mode thinks for 5-15 minutes
  before acting, ideal for problems requiring thorough investigation.
  Use when: tracking complex multi-file bugs, planning large-scale
  refactoring, investigating performance bottlenecks, root cause analysis,
  architecture redesign, debugging race conditions or concurrency issues.
  Keywords: deep analysis, complex bug, root cause, refactoring plan,
  architecture analysis, investigate, hard problem, thorny issue,
  깊은 분석, 복잡한 버그, 근본 원인, 성능 병목, 대규모 리팩토링,
  difficult debug, extended reasoning, long thinking
---

# AmpCode Deep — Extended Autonomous Analysis

## Purpose

Leverage GPT-5.3-Codex Deep mode for problems requiring extended autonomous
thinking (5-15 minutes). Deep mode reads files extensively, plans thoroughly,
and works independently — complementing Claude's more interactive approach.

## When This Skill Triggers Automatically

Claude Code should consider using this skill when:
- A bug spans multiple files with unclear root cause
- Large-scale refactoring requires thorough codebase understanding first
- Performance investigation needs extensive profiling analysis
- Architecture redesign requires deep reasoning about trade-offs
- Claude itself is struggling with a complex problem after multiple attempts

**Before auto-triggering, always confirm with the user:**

```
이 작업은 AmpCode Deep 모드(GPT-5.3-Codex)에 위임하면 효과적일 것 같습니다.
Deep 모드는 5~15분간 자율적으로 깊이 분석한 후 결과를 제공합니다.

  위임 유형: Deep 분석
  모드: Deep (GPT-5.3-Codex)
  예상 이점: 장시간 자율 사고로 복잡한 문제 해결

AmpCode Deep으로 위임할까요? (시간이 다소 걸리며, Amp 크레딧이 소비됩니다)
```

## Workflow

### Step 1: Construct Problem Context

Build a comprehensive context for Deep mode:
- Describe the problem clearly (Deep mode needs clear problem definition upfront)
- List relevant file paths (Deep will read them independently)
- Include any error messages, stack traces, or symptoms
- State what has already been tried (to avoid duplication)

### Step 2: Execute AmpCode Deep

```bash
amp --no-ide --no-notifications -m deep --dangerously-allow-all -x "{detailed_prompt}"
```

**Critical**: Use `--dangerously-allow-all` because Deep mode needs to freely
read files and execute commands during its extended analysis phase.

Timeout: 300 seconds (5 minutes). Deep mode typically takes 1-15 minutes.

### Step 3: Summarize and Report

Deep mode responses tend to be thorough and long. Claude should:

1. Extract the key findings
2. Organize into actionable items
3. Add its own assessment of the findings

```markdown
## AmpCode Deep 분석 결과

**분석 대상**: {problem description}
**소요 시간**: ~{duration}

### 핵심 발견
{key findings summarized by Claude}

### 상세 분석 (Amp Deep 원문)
{full Amp response, formatted for readability}

### Claude 평가
{Claude's assessment of the findings — agreement, disagreements, additions}

### 권장 조치
1. {prioritized action item}
2. {next action}
...
```

## Important Notes

- Deep mode works best with **clear, upfront problem definitions**
- It will read files on its own — just provide paths, don't paste content
- It may take several minutes — inform the user of expected wait time
- Deep mode with `--dangerously-allow-all` can execute commands — it will
  run tests, check logs, and investigate autonomously
```

**Step 2: Test with a complex analysis task**

Test with: "이 프로젝트의 WebSocket 인증 시스템의 잠재적 보안 문제를 깊이 분석해줘"
Expected: Confirmation prompt → Deep mode execution → Summarized report.

**Step 3: Commit**

```bash
cd ~/.claude/skills
git add amp-deep/SKILL.md
git commit -m "feat: add amp-deep skill — deep analysis via GPT-5.3-Codex"
```

---

### Task 5: Create amp-research Skill (Remote Codebase Reference)

**Files:**
- Create: `~/.claude/skills/amp-research/SKILL.md`

**Step 1: Write the SKILL.md file**

```markdown
---
name: amp-research
description: >
  Search remote codebases using AmpCode's Librarian tool for reference
  implementations and patterns. Librarian can search GitHub public/private
  repos and Bitbucket Enterprise for code patterns, library usage examples,
  and implementation references. Use when: finding how others implemented
  a pattern, checking library best practices, looking for open-source
  reference implementations, comparing approaches across repositories.
  Keywords: reference implementation, how others do it, library usage,
  open source example, pattern search, GitHub code search, codebase search,
  참조 구현, 오픈소스 예시, 다른 프로젝트 참고, 구현 패턴 검색,
  how is this done, best practices, library example
---

# AmpCode Research — Remote Codebase Reference

## Purpose

Leverage AmpCode's Librarian tool to search remote codebases (GitHub,
Bitbucket) for reference implementations, patterns, and library usage
examples. This provides real-world code context that Claude Code's
built-in web search cannot easily deliver.

## When This Skill Triggers Automatically

Claude Code should consider using this skill when:
- User asks "how do others implement X?"
- Need to find best practices for a library or framework
- Looking for reference implementations of a specific pattern
- Comparing implementation approaches across projects

**Before auto-triggering, always confirm with the user:**

```
이 작업은 AmpCode Librarian으로 원격 코드베이스를 검색하면 효과적일 것 같습니다.
GitHub/Bitbucket에서 참조 구현과 패턴을 찾아올 수 있습니다.

  위임 유형: 원격 코드베이스 참조
  검색 대상: {search query}
  예상 이점: 실제 프로덕션 코드의 구현 패턴 참조

AmpCode Librarian으로 검색할까요?
```

## Workflow

### Step 1: Formulate Search Query

Transform the user's request into a precise Librarian search:
- Identify the pattern, library, or concept to search for
- Include specific technical terms
- Scope to relevant languages/frameworks if possible

### Step 2: Execute Librarian Search

```bash
amp --no-ide --no-notifications -x "Use the librarian tool to search for: {detailed_query}. Find real-world implementations, show relevant code snippets, and explain the patterns used."
```

Timeout: 120 seconds.

### Step 3: Contextualize Results

Claude processes Librarian results and contextualizes for the current project:

```markdown
## 원격 코드베이스 참조 결과

**검색 쿼리**: {query}

### 발견된 패턴
{patterns found, organized by approach}

### 현재 프로젝트에 적용 가능한 부분
{how findings apply to our specific codebase and architecture}

### 권장 접근 방식
{recommended approach based on findings + Claude's analysis}
```
```

**Step 2: Test with a reference search**

Test with: "Express.js에서 rate limiting을 구현하는 패턴을 다른 프로젝트에서 참고해줘"
Expected: Confirmation → Librarian search → Contextualized results.

**Step 3: Commit**

```bash
cd ~/.claude/skills
git add amp-research/SKILL.md
git commit -m "feat: add amp-research skill — remote codebase reference via Librarian"
```

---

### Task 6: Create amp-parallel Skill (Parallel Subagent Processing)

**Files:**
- Create: `~/.claude/skills/amp-parallel/SKILL.md`

**Step 1: Write the SKILL.md file**

```markdown
---
name: amp-parallel
description: >
  Batch-process multiple independent files in parallel using AmpCode's
  subagent system. Each subagent works on one file/task independently
  and simultaneously, dramatically speeding up bulk operations.
  Use when: converting multiple files (e.g., CSS to Tailwind), applying
  the same transformation across many files, batch code migrations,
  parallel test fixes, mass file format conversions.
  Keywords: parallel, batch, multiple files, convert all, migrate all,
  each file, simultaneously, concurrent, bulk operation, mass update,
  병렬 처리, 일괄 변환, 모든 파일, 동시에, 대량 작업,
  batch convert, parallel process, subagent
---

# AmpCode Parallel — Batch File Processing with Subagents

## Purpose

Leverage AmpCode's subagent system to process multiple independent files
in parallel. While Claude Code processes files sequentially, AmpCode can
spawn N subagents to work on N files simultaneously.

## When This Skill Triggers Automatically

Claude Code should consider using this skill when:
- 5+ files need the same transformation
- A batch migration or conversion task is requested
- Independent file-level operations can be parallelized
- User explicitly asks for parallel or simultaneous processing

**Before auto-triggering, always confirm with the user:**

```
이 작업은 AmpCode 서브에이전트로 병렬 처리하면 효과적일 것 같습니다.
{N}개 파일을 동시에 처리하여 작업 시간을 단축할 수 있습니다.

  위임 유형: 병렬 서브에이전트 처리
  대상 파일 수: {N}개
  작업 내용: {task description}
  예상 이점: 순차 처리 대비 ~{N}배 빠른 처리

AmpCode 서브에이전트로 병렬 처리할까요?
```

## Workflow

### Step 1: Collect Target Files

Identify the files to process:
- From user's explicit file list
- From glob pattern (e.g., "all *.css files in src/")
- From git diff output

### Step 2: Define Transformation

Clearly describe what each subagent should do to each file.
All subagents receive the same instructions.

### Step 3: Execute Parallel Processing

```bash
amp --no-ide --no-notifications --dangerously-allow-all -x "Use {N} subagents to {task_description}. Target files: {file_list}. Each subagent handles one file independently."
```

**Critical**: Use `--dangerously-allow-all` because subagents need to
read and write files autonomously.

Timeout: 300 seconds (parallel work can take time).

### Step 4: Report Results

```markdown
## 병렬 처리 결과

**작업**: {task description}
**처리 파일 수**: {N}개
**소요 시간**: ~{duration}

### 처리 결과
| 파일 | 상태 | 비고 |
|------|------|------|
| {file1} | 완료 | — |
| {file2} | 완료 | 주의: {note} |
| ... | ... | ... |

### 변경 요약
{summary of all changes made}

### 검증 필요 사항
{items that should be manually verified or tested}
```

## Important Notes

- Only use for **independent** file operations (no inter-file dependencies)
- Subagents work in isolation — they cannot communicate with each other
- Always verify results after parallel processing (run tests, lint, etc.)
- For files with dependencies, use sequential processing instead
```

**Step 2: Test with a batch operation**

Test with: "tests/ 폴더의 모든 테스트 파일에서 사용된 테스트 패턴을 병렬로 분석해줘"
Expected: Confirmation → Parallel execution → Results table.

**Step 3: Commit**

```bash
cd ~/.claude/skills
git add amp-parallel/SKILL.md
git commit -m "feat: add amp-parallel skill — parallel subagent batch processing"
```

---

### Task 7: Integration Test — Full Workflow Verification

**Files:**
- None (verification only)

**Step 1: Verify all 5 skills appear in Claude Code**

Run `/skills` or check skill list. All should appear:
- amp-delegate
- amp-review
- amp-deep
- amp-research
- amp-parallel

**Step 2: Test manual invocation via /amp**

Test: `/amp 이 프로젝트에서 가장 중요한 파일 3개를 알려줘`
Expected: amp-delegate skill triggers → AmpCode executes → result displayed.

**Step 3: Test auto-trigger detection**

Test: "이 코드를 다른 관점에서도 검증해줘" (without /amp prefix)
Expected: Claude detects amp-review potential → asks user confirmation.

**Step 4: Test error handling**

Temporarily rename amp binary and verify fallback:
```bash
sudo mv /Users/giinie/.local/bin/amp /Users/giinie/.local/bin/amp.bak
# Test: /amp test
# Expected: "AmpCode CLI가 설치되어 있지 않습니다" message
sudo mv /Users/giinie/.local/bin/amp.bak /Users/giinie/.local/bin/amp
```

**Step 5: Final commit with all skills**

```bash
cd ~/.claude/skills
git add -A
git commit -m "feat: complete amp-harness skill family (5 skills)

- amp-delegate: Universal router + /amp entry point
- amp-review: Cross-model code review (GPT-5.3)
- amp-deep: Deep analysis delegation (GPT-5.3-Codex)
- amp-research: Remote codebase reference (Librarian)
- amp-parallel: Parallel subagent batch processing"
```
