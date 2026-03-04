# AI-* Skills Review Report

> **상태**: 리뷰 완료. Action Items 미해결 — 다음 세션에서 처리 예정.

**Date**: 2026-03-04
**Scope**: `ai-delegate`, `ai-research`, `ai-parallel`, `ai-review`, `ai-deep`
**Context**: `amp-*` → `ai-*` renaming — provider-agnostic AI CLI delegation skills

---

## Overall Assessment: GOOD (minor improvements needed)

The renaming from `amp-*` to `ai-*` was cleanly executed. All 5 skills are properly structured, internally consistent, and free of legacy references.

---

## What's Working Well

| Item | Status | Notes |
|------|--------|-------|
| Renaming complete | OK | All 5 skills renamed, old `amp-*` directories removed |
| Legacy reference cleanup | OK | No `amp-delegate`, `amp-research`, etc. references remain in filesystem or CLAUDE.md |
| Internal cross-references | OK | All skills correctly reference `ai-delegate` (e.g., "See ai-delegate for template") |
| Frontmatter quality | OK | name, description, bilingual keywords (KR/EN) — consistent across all skills |
| Provider-neutral design | OK | amp, codex, gemini all supported with correct CLI syntax |
| Security guardrails | OK | Full autonomy flags require explicit user confirmation |
| Role separation | OK | delegate(router), research(search), parallel(batch), review(cross-validation), deep(analysis) — clean separation of concerns |

---

## Issues Found

### Issue 1: Keyword Collision Risk (WARN)

**Location**: `ai-delegate/SKILL.md` frontmatter keywords
**Severity**: WARN — may cause non-deterministic skill triggering

`ai-delegate` includes bare keywords `amp`, `codex`, `gemini`:

```yaml
Keywords: /ai, delegate, forward, 위임, send to amp, send to codex,
  send to gemini, amp, codex, gemini, 다른 AI로, 외부 AI
```

OMC's CLAUDE.md defines routing rules:
- Bare `codex` / `gemini` → routes to `omc-teams` skill
- All three `claude codex gemini` → routes to `ccg` skill

When a user says "codex로 리뷰해줘", it's ambiguous whether `omc-teams` or `ai-delegate` should trigger. The outcome is non-deterministic.

**Recommended Fix**: Remove bare `amp`, `codex`, `gemini` from keywords. Keep phrase-level keywords only:

```yaml
Keywords: /ai, delegate, forward, 위임, send to amp, send to codex,
  send to gemini, 다른 AI로, 외부 AI, ai delegate, ai deep, ai rush
```

---

### Issue 2: `/ai` Command Prefix Not Registered (WARN)

**Location**: `ai-delegate/SKILL.md` description and Step 2
**Severity**: WARN — documentation doesn't match actual invocation

The description references `/ai deep`, `/ai codex`, `/ai rush` as invocation patterns, but the actual skill name is `ai-delegate`. Users must type `/ai-delegate` (or rely on keyword matching), not `/ai`.

The Step 2 routing table assumes `/ai` prefix parsing:
```
/ai deep ...  → provider=amp, mode=deep
/ai codex ... → provider=codex
/ai rush ...  → provider=amp, mode=rush
```

These sub-command patterns only work if `ai-delegate` is already invoked and args are parsed. They won't work as standalone `/ai deep` invocations.

**Recommended Fix**: Update description to reflect actual skill name:

```yaml
description: >
  ...Use when explicitly invoked with /ai-delegate command...
  Supports: /ai-delegate deep, /ai-delegate codex, /ai-delegate gemini.
```

---

### Issue 3: Codex `--search` Flag Doesn't Exist (BUG)

**Location**: `ai-research/SKILL.md:58`
**Severity**: BUG — will cause CLI execution failure

```bash
# Current (broken)
codex exec --search "{query}"

# Correct
codex exec "Find reference implementations of {query}. Show code examples and explain patterns."
```

The `--search` flag is not a valid Codex CLI option. The `ai-delegate` base skill correctly documents the syntax as `codex exec "prompt"` without `--search`.

**Impact**: When this command runs, Codex CLI will throw an unknown flag error. The error handling in ai-delegate would catch it and fall back to Claude, negating the purpose of delegation.

---

### Issue 4: Gemini Flag Combination Issue (BUG)

**Location**: `ai-parallel/SKILL.md:69`
**Severity**: BUG — contradictory flags

```bash
# Current (questionable)
gemini -p --yolo --checkpointing "{prompt}"
```

`-p` enables non-interactive (piped) mode, while `--yolo` is an auto-approve flag for interactive mode. Using both together is contradictory:
- In `-p` mode, there are no approval prompts to auto-approve
- `--yolo` is redundant when `-p` is present

**Recommended Fix**:
```bash
# For non-interactive batch (preferred for scripted execution)
gemini -p --checkpointing "{prompt}"

# OR for interactive with auto-approve
gemini --yolo --checkpointing "{prompt}"
```

---

## Structural Analysis

### Skill Dependency Graph

```
ai-delegate (router/conventions hub)
├── ai-research  (references ai-delegate for: template, conventions)
├── ai-parallel  (references ai-delegate for: conventions, safety check)
├── ai-review    (references ai-delegate for: template, conventions)
└── ai-deep      (references ai-delegate for: conventions, safety check)
```

`ai-delegate` serves as the central hub defining:
1. Provider CLI syntax reference
2. User confirmation template
3. Pre-execution checklist
4. Error handling table
5. Prompt delivery strategy
6. Security guard rails

All other ai-* skills reference `ai-delegate` for shared conventions — a clean hub-and-spoke pattern that avoids duplication.

### Provider Coverage Matrix

| Skill | amp | codex | gemini | Default |
|-------|-----|-------|--------|---------|
| ai-delegate | Full syntax | Full syntax | Full syntax | amp (smart) |
| ai-research | Librarian search | ~~--search~~ (bug) | Google integration | amp |
| ai-parallel | Subagent parallel | Sandboxed batch | ~~-p + --yolo~~ (bug) | amp |
| ai-review | Deep mode (GPT) | Read-only sandbox | Pro model | amp (deep) |
| ai-deep | Deep + full autonomy | High reasoning effort | Pro + yolo | amp (deep) |

### Keyword Uniqueness Audit

| Skill | Unique Keywords | Shared/Risky Keywords |
|-------|----------------|----------------------|
| ai-delegate | `/ai`, `delegate`, `위임`, `외부 AI` | `amp`, `codex`, `gemini` (OMC conflict) |
| ai-research | `reference implementation`, `참조 구현`, `오픈소스 예시` | (clean) |
| ai-parallel | `parallel`, `batch`, `병렬 처리`, `일괄 변환` | (clean) |
| ai-review | `second opinion`, `cross-check`, `세컨드 오피니언` | (clean) |
| ai-deep | `deep analysis`, `깊은 분석`, `근본 원인` | (clean) |

Only `ai-delegate` has keyword collision risk. The other 4 skills have clean, unique keyword sets.

---

## Key Insights

### 1. Keyword Collision in Multi-Skill Ecosystems

When multiple skill systems (OMC plugins + custom user skills) coexist, single-word keywords become collision vectors. OMC uses longest-match priority ("claude codex gemini" → ccg, bare "codex" → omc-teams). Custom skills should use **phrase-level keywords** (e.g., "send to codex" instead of bare "codex") to avoid non-deterministic triggering.

### 2. CLI Flag Accuracy is Critical for Delegation Skills

External tool delegation skills live or die by CLI flag accuracy. An incorrect flag (like `--search` for Codex) causes immediate execution failure. Since these skills include error-handling fallback to Claude, the failure is silent — the user thinks delegation happened but Claude actually handled it. **Always verify CLI flags against official documentation before committing to skill definitions.**

### 3. Hub-and-Spoke Pattern for Skill Families

The ai-* skills use a clean architectural pattern: `ai-delegate` as the central conventions hub, with specialized skills referencing it. This avoids duplicating error handling, security rules, and prompt templates across 5 files. If conventions change, only `ai-delegate` needs updating. This is the recommended pattern for skill families.

### 4. Non-Interactive vs Interactive Flag Sets

CLI tools typically have two distinct flag sets:
- **Non-interactive** (scripted): `-p`, `exec`, pipe-friendly
- **Interactive** (human): `--yolo`, `-a auto-edit`, auto-approve

Mixing flags from both sets (e.g., `-p --yolo`) is a common mistake. Each ai-* skill should consistently choose one mode per provider and stick to it.

---

## Action Items (for future resolution)

- [ ] Fix `ai-research` Codex command: remove `--search` flag
- [ ] Fix `ai-parallel` Gemini command: remove contradictory `-p` + `--yolo`
- [ ] Resolve `ai-delegate` keyword collision with OMC routing
- [ ] Clarify `/ai` vs `/ai-delegate` invocation in description
- [ ] Verify all CLI flags against latest provider documentation (amp, codex, gemini)
