# AI-* Skills Review Report

> **Status**: All action items resolved (2026-03-07). CLI flags verified against `codex --help` and `gemini --help`.

**Date**: 2026-03-04
**Scope**: `ai-delegate`, `ai-research`, `ai-parallel`, `ai-review`, `ai-deep`
**Context**: `amp-*` -> `ai-*` renaming -- provider-agnostic AI CLI delegation skills
**Follow-up**: 2026-03-07 -- CLI help verification and fixes applied

---

## Overall Assessment: GOOD (all issues resolved)

The renaming from `amp-*` to `ai-*` was cleanly executed. All 5 skills are properly structured, internally consistent, and free of legacy references. CLI flags have been verified against official `--help` output and corrected where necessary.

---

## What's Working Well

| Item | Status | Notes |
|------|--------|-------|
| Renaming complete | OK | All 5 skills renamed, old `amp-*` directories removed |
| Legacy reference cleanup | OK | No `amp-delegate`, `amp-research`, etc. references remain in filesystem or CLAUDE.md |
| Internal cross-references | OK | All skills correctly reference `ai-delegate` (e.g., "See ai-delegate for template") |
| Frontmatter quality | OK | name, description, bilingual keywords (KR/EN) -- consistent across all skills |
| Provider-neutral design | OK | amp, codex, gemini all supported with correct CLI syntax |
| Security guardrails | OK | Full autonomy flags require explicit user confirmation |
| Role separation | OK | delegate(router), research(search), parallel(batch), review(cross-validation), deep(analysis) -- clean separation of concerns |

---

## Issues Found and Resolved

### Issue 1: Codex `--search` Flag Scope (BUG -- FIXED)

**Location**: `ai-research/SKILL.md:36,58`
**Severity**: BUG
**Resolved**: 2026-03-07

**Problem**: `codex exec --search "{query}"` -- `--search` is a top-level Codex flag, not an `exec` subcommand option.

**CLI verification** (`codex --help` / `codex exec --help`):
- `codex --search`: Valid top-level flag -- "Enable live web search. When enabled, the native Responses `web_search` tool is available to the model"
- `codex exec --search`: Invalid -- not listed in `exec` subcommand options

**Fix applied**:
```bash
# Before (broken)
codex exec --search "{query}"

# After (correct -- --search as top-level flag before exec subcommand)
codex --search exec "{query}"
```

---

### Issue 2: Gemini `--checkpointing` Flag Does Not Exist (BUG -- FIXED)

**Location**: `ai-parallel/SKILL.md:37,69`, `ai-delegate/SKILL.md:45`
**Severity**: BUG
**Resolved**: 2026-03-07

**Problem**: `--checkpointing` is not a valid Gemini CLI option. The original review (Issue 4) flagged `-p` + `--yolo` as contradictory but missed the non-existent `--checkpointing` flag entirely.

**CLI verification** (`gemini --help`):
- `-p, --prompt`: Valid -- "Run in non-interactive (headless) mode"
- `-y, --yolo`: Valid -- "Automatically accept all actions"
- `--checkpointing`: **Does not exist** in Gemini CLI options
- `--sandbox`: Valid alternative for isolated execution (requires Docker/Podman)

**`-p` + `--yolo` reassessment**: In headless mode (`-p`), tool execution may still require approval. `--yolo` auto-approves those actions. The combination is not necessarily contradictory -- it depends on Gemini's internal behavior. The original review's concern is noted but not confirmed as a bug.

**Fixes applied**:
```bash
# ai-parallel: removed --checkpointing
# Before
gemini -p --yolo --checkpointing "{prompt}"
# After
gemini -p --yolo "{prompt}"

# ai-delegate: replaced --checkpointing reference with --sandbox
# Before
- **Checkpointing**: `--checkpointing` for file snapshots before changes
# After
- **Sandbox**: `--sandbox` for isolated execution (requires Docker/Podman)
```

---

### Issue 3: Keyword Collision Risk (WARN -- FIXED)

**Location**: `ai-delegate/SKILL.md` frontmatter keywords
**Severity**: WARN
**Resolved**: 2026-03-07

**Problem**: Bare keywords `amp`, `codex`, `gemini` conflicted with OMC routing rules:
- Bare `codex` / `gemini` -> routes to `omc-teams` skill
- All three `claude codex gemini` -> routes to `ccg` skill

**Fix applied**: Removed bare `amp`, `codex`, `gemini`. Kept phrase-level keywords only:
```yaml
# Before
Keywords: /ai, delegate, forward, ..., amp, codex, gemini, ...

# After
Keywords: /ai, ai delegate, delegate, forward, ..., send to amp, send to codex,
  send to gemini, ...
```

---

### Issue 4: `/ai` Command Prefix Not Registered (WARN -- FIXED)

**Location**: `ai-delegate/SKILL.md` description and Step 2
**Severity**: WARN
**Resolved**: 2026-03-07

**Problem**: Description referenced `/ai deep`, `/ai codex` but actual skill name is `ai-delegate`.

**Fix applied**: Updated description and routing table to use `/ai-delegate`:
```yaml
# Before
Supports: /ai deep, /ai review, /ai rush, /ai codex, /ai gemini.

# After
Supports: /ai-delegate deep, /ai-delegate codex, /ai-delegate gemini.
```

---

## CLI Flag Verification Matrix (2026-03-07)

Verified against `codex --help`, `codex exec --help`, and `gemini --help`.

### Codex Flags

| Flag | Scope | Valid | Used In |
|------|-------|-------|---------|
| `exec "prompt"` | subcommand | Yes | all ai-* skills |
| `--search` | top-level only | Yes (NOT on exec) | ai-research |
| `-a suggest` | exec | Yes | ai-review |
| `-a never` | exec | Yes | ai-parallel, ai-deep |
| `--sandbox read-only` | exec | Yes | ai-review |
| `-c model_reasoning_effort=high` | exec | Yes | ai-deep |
| `--json` | exec | Yes | ai-delegate (reference) |

### Gemini Flags

| Flag | Valid | Used In |
|------|-------|---------|
| `-p` / `--prompt` | Yes | all ai-* skills |
| `-y` / `--yolo` | Yes | ai-parallel, ai-deep |
| `-m gemini-2.5-pro` | Yes | ai-review, ai-deep |
| `--sandbox` | Yes | ai-delegate (reference), ai-parallel (note) |
| `-o json` / `--output-format json` | Yes | ai-delegate (reference) |
| `--checkpointing` | **No** (removed) | was in ai-parallel, ai-delegate |

---

## Structural Analysis

### Skill Dependency Graph

```
ai-delegate (router/conventions hub)
+-- ai-research  (references ai-delegate for: template, conventions)
+-- ai-parallel  (references ai-delegate for: conventions, safety check)
+-- ai-review    (references ai-delegate for: template, conventions)
+-- ai-deep      (references ai-delegate for: conventions, safety check)
```

`ai-delegate` serves as the central hub defining:
1. Provider CLI syntax reference
2. User confirmation template
3. Pre-execution checklist
4. Error handling table
5. Prompt delivery strategy
6. Security guard rails

All other ai-* skills reference `ai-delegate` for shared conventions -- a clean hub-and-spoke pattern that avoids duplication.

### Provider Coverage Matrix

| Skill | amp | codex | gemini | Default |
|-------|-----|-------|--------|---------|
| ai-delegate | Full syntax | Full syntax | Full syntax | codex (code) / gemini (search) |
| ai-research | Librarian search | `--search` web search | Google integration | gemini |
| ai-parallel | 1 Team + 2 teammates | Sandboxed batch | Headless + yolo | codex + gemini (parallel split) |
| ai-review | Deep mode (GPT) | Read-only sandbox | Pro model | codex + gemini (parallel) |
| ai-deep | Deep + full autonomy | High reasoning effort | Pro + yolo | Escalation: Claude -> codex/gemini -> amp |

### Keyword Uniqueness Audit

| Skill | Unique Keywords | Collision Risk |
|-------|----------------|----------------|
| ai-delegate | `/ai`, `ai delegate`, `delegate`, `forward` | None (bare provider names removed) |
| ai-research | `reference implementation`, `codebase search` | None |
| ai-parallel | `parallel`, `batch`, `bulk operation` | None |
| ai-review | `second opinion`, `cross-check`, `cross-model` | None |
| ai-deep | `deep analysis`, `root cause`, `extended reasoning` | None |

---

## Key Insights

### 1. Subcommand-Scoped Flags

CLI tools often have different option sets per subcommand. `codex --search` is valid at the top level but not under `codex exec`. Always verify flags against the specific subcommand's `--help`, not just the top-level help.

### 2. Phantom Flags in Documentation

`--checkpointing` appeared in skill definitions but never existed in Gemini CLI. This likely originated from an outdated or incorrect source. **Always verify CLI flags against `--help` output before committing to skill definitions.**

### 3. Hub-and-Spoke Pattern for Skill Families

The ai-* skills use a clean architectural pattern: `ai-delegate` as the central conventions hub, with specialized skills referencing it. This avoids duplicating error handling, security rules, and prompt templates across 5 files. If conventions change, only `ai-delegate` needs updating.

### 4. Keyword Collision Prevention

When multiple skill systems (OMC plugins + custom user skills) coexist, single-word keywords become collision vectors. Use **phrase-level keywords** (e.g., "send to codex" instead of bare "codex") to avoid non-deterministic triggering.

---

## Action Items

- [x] Fix `ai-research` Codex command: move `--search` to top-level position (2026-03-07)
- [x] Fix `ai-parallel` Gemini command: remove non-existent `--checkpointing` flag (2026-03-07)
- [x] Fix `ai-delegate` Gemini reference: replace `--checkpointing` with `--sandbox` (2026-03-07)
- [x] Resolve `ai-delegate` keyword collision with OMC routing (2026-03-07)
- [x] Clarify `/ai` vs `/ai-delegate` invocation in description and routing table (2026-03-07)
- [x] Verify all CLI flags against `codex --help` and `gemini --help` (2026-03-07)
