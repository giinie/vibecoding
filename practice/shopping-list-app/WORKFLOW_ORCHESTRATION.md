# Workflow Orchestration

> Planning, execution, and verification rules for AI-assisted development workflows. Subagent usage, task tracking, bug fixing, and code quality standards.

**Session Start**: If `tasks/lessons.md` exists, read it and apply relevant rules before proceeding.

## Planning
- Enter plan mode for **cross-file changes or architectural decisions** — not every multi-step task
- Write the plan to `tasks/todo.md` with checkable items before implementing
- **Always check official documentation limitations before designing with platform features (Team, Agent, MCP, etc.)** — especially critical for experimental features. Use `context7` MCP for SDK/framework docs (per `~/.claude/MCP_ROUTING.md` §6 Tie-Breaking).
- Check in with the user before starting implementation on non-trivial plans
- If execution goes sideways, STOP and re-plan — do not keep pushing forward
- When the session is in "work without stopping for clarifying questions" mode (set via system reminder or explicit user instruction):
  - Record the assumption inline in the response, then proceed
  - **Irreversible actions still require explicit confirmation**: DB schema migrations, network calls with external side effects, destructive shell commands (`rm -rf`, `git reset --hard`, `git push --force`), production deploys, secret/credential changes

## Subagent Usage

> Overrides user-scope OMC `<delegation_rules>` (aggressive delegation) — see user-scope `CLAUDE.md` "OMC Delegation Override" section, which explicitly defers to project policy when present.

- Spawn subagents **only when context isolation is explicitly needed**:
  - Parallel independent analysis (e.g., reviewing multiple modules simultaneously)
  - Research/exploration that would pollute the main context window
  - Adversarial review: one subagent implements, a separate reviewer subagent critiques
- One focused task per subagent — never multiplex unrelated concerns in a single subagent
- Do NOT spawn subagents for simple sequential tasks; keep the main context clean instead
- Prefer 2–3 targeted subagents over large swarms — you cannot effectively observe 10+ agents
- **Targeted search → direct tools first**: For known file paths, specific patterns, or directory exploration, use Glob/Grep/Read directly. Explore subagents are for broad, open-ended codebase questions only.
- **Subagent gate failure**: Explore agents may return empty results due to plugin skill gate conflicts (superpowers SUBAGENT-STOP vs EXTREMELY-IMPORTANT). If an agent returns gate-check output instead of actual results, switch to direct tools immediately — do not retry the same agent.
- **Esc+Esc interrupt vs permission denial**: When a user interrupts a running Agent with Esc double-tap, Claude Code reports `"The user doesn't want to proceed"` — identical to a permission denial. Do not assume a hook or permission system blocked the call. Agent tool calls are auto-approved and do not show approval prompts.

## Task Execution
- Track progress by marking items complete in `tasks/todo.md` as you go
- Provide a high-level summary of changes at each major step
- Add a review section to `tasks/todo.md` when the task is complete

## Verification
- Never mark a task complete without proving it works
- Run tests, check logs, and demonstrate correctness before reporting done
- When relevant, diff behavior between main branch and your changes
- Before presenting results, run a 3-question self-check:
  1. Tests pass?
  2. Is the WHY of new code clear (annotation in Key Patterns if applicable)?
  3. No Critical Rules violated?

## Bug Fixing
- When given a bug report: just fix it — no hand-holding required for localized fixes.
- If the fix requires cross-file changes or architectural decisions, escalate to Planning first.
- Point at logs, errors, and failing tests, then resolve them autonomously
- Fix failing CI tests without waiting to be told how
- Zero context switching required from the user

## Lessons & Self-Improvement

> **Where to record**: project-specific patterns (this codebase's file paths, repo conventions, gotchas) → `tasks/lessons.md`. Cross-project user/tool feedback (toolchain quirks, OMC behavior, environment) → user-scope auto-memory at `~/.claude/projects/<slug>/memory/`. If a pattern applies beyond this project, prefer auto-memory.

- After a user correction that reveals a **non-obvious or recurring pattern**, append it to `tasks/lessons.md` (project-scope) or save it as a feedback memory (cross-project).
- Format for `tasks/lessons.md`: `[date] Pattern: <what went wrong> → Rule: <how to prevent it>`
- Keep `tasks/lessons.md` concise — prune entries that no longer apply
- Promote rules to this file (WORKFLOW_ORCHESTRATION.md) when violated 3+ times across sessions, OR when a single violation has high blast radius (e.g., security, data loss, irreversible state changes)

## Code Quality

> Inherits `~/.claude/CODE_QUALITY.md` (Simplicity First + Surgical Changes).
> This section adds project-specific deltas only — do not restate user-scope rules.

**Priority override**: `Correctness > Simplicity > Elegance > Speed` — inserts Correctness at the top. The remaining order stays compatible with the user-scope "Simplicity First" principle.

- No temporary fixes — find and address root causes
- After a non-trivial change, ask once about **code just written in this session**:
  "Is there a more elegant solution?" — If yes and low-risk, refactor. Else ship.
- Elegance checks do NOT apply to:
  - Simple, obvious fixes (no over-engineering)
  - Pre-existing code (follows the user-scope Surgical Changes rule)
- See also: Bug Fixing
