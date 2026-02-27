# AmpCode Harness Skill Design

## Overview

A skill family (`amp-*`) that enables Claude Code to delegate tasks to AmpCode CLI, combining Claude's strengths with AmpCode's multi-model capabilities (GPT-5.3-Codex Deep mode, GPT-5.2 Oracle, Librarian remote search).

**Trigger**: Hybrid — Claude Code auto-detects delegation opportunities (with user confirmation) + manual `/amp` slash command.

## Requirements

- **Hybrid trigger**: Auto-detection + `/amp` manual invocation
- **User confirmation**: Auto-delegation asks user before executing (Amp credits are consumed)
- **Delegation scope**: Cross-model review, deep analysis, remote code reference, parallel subagents, large refactoring, team-shared review
- **Result handling**: Claude Code synthesizes Amp results into a comparative report
- **Installation**: Global (`~/.claude/skills/`)
- **Mandatory flags**: `--no-ide --no-notifications` on all `amp` CLI calls

## Architecture

```
User
  │
  ├─[auto] "리뷰해줘" → Claude Code detects → selects amp-* Skill
  │                       → asks user confirmation → executes
  │
  └─[manual] "/amp deep 분석해줘" → amp-delegate Skill
                                    → parses mode + prompt → executes

Claude Code (orchestrator)
  │
  ├─ amp-review     → Cross-model code review
  ├─ amp-deep       → Deep analysis (GPT-5.3-Codex)
  ├─ amp-research   → Remote codebase reference (Librarian)
  ├─ amp-parallel   → Parallel subagent file processing
  └─ amp-delegate   → Universal router + /amp entry point
        │
        ▼
  AmpCode CLI
    amp --no-ide --no-notifications [-m mode] -x "prompt"
```

## Skill Definitions

### 1. amp-delegate (Universal Router)

**Location**: `~/.claude/skills/amp-delegate/SKILL.md`

**Role**: Entry point for `/amp` manual calls and fallback for unmatched delegation.

**Description keywords**: delegate, amp, forward, AmpCode, 위임, send to amp

**Internal logic**:
1. Parse mode hint from prompt (`/amp deep ...`, `/amp rush ...`, default smart)
2. Execute: `amp --no-ide --no-notifications -m {mode} -x "{prompt}"`
3. Synthesize result and report to user

### 2. amp-review (Cross-Model Code Review)

**Location**: `~/.claude/skills/amp-review/SKILL.md`

**Role**: Delegate code review to GPT family for cross-model verification.

**Description keywords**: review, verify, second opinion, cross-check, validate, audit, blind spot, different perspective, 다른 관점, 검증, 교차 검증

**Internal logic**:
1. Collect review targets (git diff, specified files)
2. Construct review prompt with code context
3. Execute: `amp --no-ide --no-notifications -m deep -x "review prompt"`
4. Compare Amp results with Claude's own analysis in a comparison table

**Auto-trigger conditions**:
- User asks for "different perspective" or "second opinion"
- User mentions a specific non-Claude model (GPT, etc.)
- Security/architecture review where cross-validation adds value

### 3. amp-deep (Deep Analysis)

**Location**: `~/.claude/skills/amp-deep/SKILL.md`

**Role**: Delegate complex analysis tasks to GPT-5.3-Codex Deep mode (5-15 min autonomous thinking).

**Description keywords**: deep analysis, complex bug, root cause, refactoring plan, architecture, investigate, hard problem, thorny issue, 깊은 분석, 복잡한 버그, 근본 원인

**Internal logic**:
1. Construct detailed context prompt
2. Execute: `amp --no-ide --no-notifications -m deep --dangerously-allow-all -x "prompt"`
3. Timeout: 300 seconds (5 minutes)
4. Summarize and report results

**Auto-trigger conditions**:
- Multi-file bug with unclear root cause
- Large-scale refactoring planning
- Performance bottleneck investigation
- Architecture redesign requiring extended reasoning

### 4. amp-research (Remote Codebase Reference)

**Location**: `~/.claude/skills/amp-research/SKILL.md`

**Role**: Search remote codebases via AmpCode's Librarian tool.

**Description keywords**: reference implementation, how others do it, library usage, open source example, pattern search, GitHub search, codebase search, 참조 구현, 오픈소스 예시

**Internal logic**:
1. Construct search prompt targeting Librarian tool
2. Execute: `amp --no-ide --no-notifications -x "Use librarian to search: {query}"`
3. Filter and contextualize results for current project

**Auto-trigger conditions**:
- User asks how something is implemented elsewhere
- Need to find library best practices
- Looking for reference implementations or patterns

### 5. amp-parallel (Parallel Subagent Processing)

**Location**: `~/.claude/skills/amp-parallel/SKILL.md`

**Role**: Batch-process multiple independent files via AmpCode's subagent system.

**Description keywords**: parallel, batch, multiple files, convert all, migrate, each file, simultaneously, concurrent, 병렬, 일괄, 모든 파일

**Internal logic**:
1. Collect target file list and task description
2. Execute: `amp --no-ide --no-notifications --dangerously-allow-all -x "Use N subagents to {task}: {files}"`
3. Report changed files and results

**Auto-trigger conditions**:
- 5+ files need the same transformation
- Batch migration or conversion tasks
- Independent file-level operations

## Auto-Detection Logic

### Trigger Matrix

| User Signal | Triggered Skill | Detection Basis |
|-------------|----------------|-----------------|
| "다른 관점에서 봐줘" | amp-review | "second opinion", "different perspective" |
| "복잡한 버그 추적" | amp-deep | "complex bug", "root cause", "investigate" |
| "다른 프로젝트 참조" | amp-research | "reference", "how others", "pattern search" |
| "이 파일들 전부 변환" (5+) | amp-parallel | "all files", "batch", "convert each" |
| `/amp ...` | amp-delegate | manual invocation |
| "GPT로 리뷰" | amp-review | explicit model request |
| "deep 모드로 분석" | amp-deep | explicit mode request |

### User Confirmation Flow

When auto-detecting, Claude Code presents:

```
이 작업은 AmpCode {mode}({model})로 위임하면 효과적일 것 같습니다.

  위임 유형: {type}
  모드: {Deep (GPT-5.3) | Smart (Claude Opus) | Rush}
  예상 이점: {benefit description}

진행할까요?
```

User approves → Skill executes. User declines → Claude Code handles internally.

## Synthesis Report Template

```markdown
## Amp 위임 결과 종합

**위임 유형**: {delegation type}
**모드**: {mode (model)}
**소요 시간**: {duration}

### Amp 분석 결과
{summarized Amp response}

### Claude 자체 분석과의 비교
| 항목 | Claude (Opus 4.6) | Amp ({model}) |
|------|-------------------|---------------|
| ... | ... | ... |

### 종합 권장사항
1. [양쪽 공통] Priority items
2. [한쪽만 지적] Items for further review
```

## Error Handling

| Error | Recovery |
|-------|----------|
| `amp` CLI not installed | Show installation guide |
| Amp credits exhausted | Report error + offer Claude-only fallback |
| Timeout (>5 min) | Abort + Claude handles internally |
| Amp execution error | Report error + Claude fallback |

## Prompt Size Strategy

When passing code to Amp:

1. **Small** (<100 lines): Inline in prompt argument
2. **Medium** (100-500 lines): Pipe via stdin
3. **Large** (>500 lines): Pass file paths — Amp reads files directly (recommended)

## Mandatory CLI Flags

All `amp` invocations MUST include:
- `--no-ide`: Prevent IDE connection attempts (causes delay/errors in programmatic mode)
- `--no-notifications`: Suppress sound notifications

Base command pattern:
```bash
amp --no-ide --no-notifications [-m mode] [-x] "prompt"
```

## Testing Strategy

| Test | Method |
|------|--------|
| CLI existence | `which amp` check |
| Basic execution | `amp --no-ide --no-notifications -x "echo test"` |
| Deep mode | `amp --no-ide --no-notifications -m deep -x "1+1?"` + timeout check |
| Large prompt | stdin pipe with file content |
| Error recovery | Simulate amp failure → verify Claude fallback |
