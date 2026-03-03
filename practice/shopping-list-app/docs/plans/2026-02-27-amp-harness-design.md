# AI CLI Harness Skill Design (v2)

## Overview

A skill family (`ai-*`) that enables Claude Code to delegate tasks to external AI CLI tools — **AmpCode**, **OpenAI Codex**, **Google Gemini** — combining Claude's strengths with each tool's unique capabilities.

**Architecture**: "작업 스킬(what) + 프로바이더 실행기(how)" 분리 패턴.

## Requirements

- **Hybrid trigger**: Auto-detection + `/ai` manual invocation
- **User confirmation**: Auto-delegation always asks before executing
- **Multi-provider**: Amp, Codex, Gemini — single interface, provider selectable
- **Result handling**: Claude synthesizes external results into comparative reports
- **Installation**: Global (`~/.claude/skills/`)
- **Security**: Full autonomy requires explicit confirmation; read-only by default

## Architecture

```
User
  │
  ├─[auto] "리뷰해줘" → Claude Code detects → selects ai-* skill
  │                       → asks confirmation → picks provider → executes
  │
  └─[manual] "/ai deep ..." or "/ai codex ..." → ai-delegate skill
                                                  → parses provider + mode → executes

Claude Code (orchestrator)
  │
  ├─ ai-deep       → Deep analysis (any provider)
  ├─ ai-review     → Cross-model code review (any provider)
  ├─ ai-research   → Remote codebase reference (any provider)
  ├─ ai-parallel   → Parallel file processing (any provider)
  └─ ai-delegate   → Universal router + common conventions
        │
        ├─▶ AmpCode CLI    → amp --no-ide --no-notifications [-m mode] -x "prompt"
        ├─▶ Codex CLI      → codex exec [-a mode] "prompt"
        └─▶ Gemini CLI     → gemini -p [-m model] "prompt"
```

## Provider Reference

### AmpCode CLI (`amp`)

| Item | Value |
|------|-------|
| Install | `curl -fsSL https://ampcode.com/install.sh \| bash` |
| Non-interactive | `amp --no-ide --no-notifications -x "prompt"` |
| Mode select | `-m smart` (default), `-m deep`, `-m rush` |
| Full autonomy | `--dangerously-allow-all` |
| Unique | Librarian (remote codebase search), subagent parallelism, Oracle |

### OpenAI Codex CLI (`codex`)

| Item | Value |
|------|-------|
| Install | `npm install -g @openai/codex` |
| Non-interactive | `codex exec "prompt"` |
| Approval | `-a suggest` (default), `-a auto-edit`, `-a never` |
| Sandbox | `--sandbox read-only \| workspace-write \| full-auto` |
| Structured output | `--json` |
| Config override | `-c key=value` (e.g., `-c model_reasoning_effort=high`) |
| Resume | `codex exec resume --last "prompt"` |
| Unique | Sandboxed execution, apply_patch, built-in security |

### Google Gemini CLI (`gemini`)

| Item | Value |
|------|-------|
| Install | `npm install -g @google/gemini-cli` |
| Non-interactive | `gemini -p "prompt"` or `gemini "prompt"` |
| Auto-approve | `--yolo` (`-y`) |
| Model select | `-m gemini-2.5-flash`, `-m gemini-2.5-pro` |
| Structured output | `--output-format json` |
| Full context | `--all-files` (`-a`) |
| Checkpointing | `--checkpointing` (auto file snapshots) |
| Sandbox | `--sandbox` (Docker/Podman) |
| Unique | Flash model (fast/cheap), checkpointing, Google search |

## Skill Definitions

### 1. ai-delegate (Universal Router)

**Location**: `~/.claude/skills/ai-delegate/SKILL.md`

**Role**: Entry point for `/ai` manual calls, common conventions, provider CLI reference.

**Parse rules**:
- `/ai deep ...` → provider=amp, mode=deep
- `/ai codex ...` → provider=codex
- `/ai gemini ...` → provider=gemini
- `/ai rush ...` → provider=amp, mode=rush
- `/ai ...` → provider=amp, mode=smart (default)

**Contains**: Provider CLI reference, common conventions, error handling table,
security guard rails, prompt delivery strategy.

### 2. ai-deep (Deep Analysis)

**Location**: `~/.claude/skills/ai-deep/SKILL.md`

**Role**: Extended autonomous reasoning for complex problems.

**Default provider**: amp (deep mode)

**Provider commands**:
- amp: `amp --no-ide --no-notifications -m deep --dangerously-allow-all -x "prompt"`
- codex: `codex exec -a never -c model_reasoning_effort=high "prompt"`
- gemini: `gemini -p --yolo -m gemini-2.5-pro "prompt"`

**Timeout**: 900 seconds

### 3. ai-review (Cross-Model Review)

**Location**: `~/.claude/skills/ai-review/SKILL.md`

**Role**: Code review from a different model family for cross-validation.

**Default provider**: amp (deep mode)

**Provider commands** (read-only, no full autonomy needed):
- amp: `amp --no-ide --no-notifications -m deep -x "prompt"`
- codex: `codex exec -a suggest --sandbox read-only "prompt"`
- gemini: `gemini -p -m gemini-2.5-pro "prompt"`

**Timeout**: 300 seconds

### 4. ai-research (Remote Codebase Reference)

**Location**: `~/.claude/skills/ai-research/SKILL.md`

**Role**: Search remote codebases for reference implementations.

**Default provider**: amp (Librarian tool)

**Provider commands** (read-only):
- amp: `amp --no-ide --no-notifications -x "Use librarian to search: {query}"`
- codex: `codex exec --search "prompt"`
- gemini: `gemini -p "prompt"`

**Timeout**: 180 seconds

### 5. ai-parallel (Parallel Batch Processing)

**Location**: `~/.claude/skills/ai-parallel/SKILL.md`

**Role**: Batch-process multiple independent files via external CLI.

**Default provider**: amp (subagent system)

**Provider commands** (full autonomy required):
- amp: `amp --no-ide --no-notifications --dangerously-allow-all -x "Use N subagents..."`
- codex: `codex exec -a never "prompt"`
- gemini: `gemini -p --yolo --checkpointing "prompt"`

**Timeout**: 900 seconds

## Auto-Detection Trigger Matrix

| User Signal | Triggered Skill | Default Provider |
|-------------|----------------|-----------------|
| "다른 관점에서 봐줘" / "second opinion" | ai-review | amp (deep) |
| "복잡한 버그 추적" / "root cause" | ai-deep | amp (deep) |
| "다른 프로젝트 참조" / "how others do it" | ai-research | amp |
| "이 파일들 전부 변환" (5+ files) | ai-parallel | amp |
| `/ai ...` | ai-delegate | amp (smart) |
| "GPT로 리뷰" | ai-review | amp (deep) |
| "Codex로 분석" | ai-deep | codex |
| "Gemini로 검색" | ai-research | gemini |

## Common Conventions

### User Confirmation Flow
```
이 작업을 외부 AI CLI에 위임합니다.

  프로바이더: {provider}
  실행 명령: {sanitized_command}
  권한 수준: {read-only | file write | full autonomy}
  ⚠️ 주의: {warnings if full autonomy enabled}

진행할까요?
```

### Error Handling

| Error | Recovery |
|-------|----------|
| CLI not installed | Show provider-specific install command |
| Auth error / token expired | Guide re-authentication |
| Credit/quota exhausted | Report + offer alternative provider or Claude fallback |
| Network error | Report + retry once, then fallback |
| Timeout | Report + Claude handles internally |
| Non-zero exit | Show stderr summary + Claude fallback |
| Empty response | Retry once, then fallback |
| Output truncated | Save to temp file + summarize |

### Prompt Size Strategy

| Size | Method | Notes |
|------|--------|-------|
| < 100 lines | Inline in CLI argument | All providers |
| 100-500 lines | stdin pipe | `cat file \| {cli}` |
| > 500 lines | Pass file paths | CLI reads directly (recommended) |

### Security Guard Rails

1. Full autonomy flags require explicit user confirmation
2. Check `git status` before write operations — warn if dirty
3. Scan target files for sensitive content (.env, keys, credentials)
4. Prefer read-only mode first; escalate only if needed
5. Never pass secrets in CLI prompts

### Timeout Guidelines

| Task Type | Timeout | Rationale |
|-----------|---------|-----------|
| Quick/rush | 120s | Simple, well-defined tasks |
| Standard | 180s | General delegation |
| Review/research | 300s | Read-only analysis |
| Deep analysis | 900s | Extended autonomous reasoning |
| Parallel batch | 900s | Multiple file processing |

## Changes from v1

| Area | v1 (amp-* only) | v2 (ai-* multi-provider) |
|------|-----------------|-------------------------|
| Naming | `amp-delegate`, `amp-deep`, ... | `ai-delegate`, `ai-deep`, ... |
| Providers | AmpCode only | Amp + Codex + Gemini |
| Model refs | Hardcoded ("GPT-5.3-Codex", "Opus 4.6") | Mode/provider-centric |
| Deep timeout | 300s (too short) | 900s |
| Error handling | Basic (4 cases) | Extended (8 cases) |
| Security | Minimal | Pre-exec checklist + guard rails |
| Common conventions | Duplicated across skills | Centralized in ai-delegate |
