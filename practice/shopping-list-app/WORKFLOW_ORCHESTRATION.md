# Workflow Orchestration

## Planning
- Enter plan mode for **cross-file changes or architectural decisions** — not every multi-step task
- Write the plan to `tasks/todo.md` with checkable items before implementing
- **Always check official documentation limitations before designing with platform features (Team, Agent, MCP, etc.)** — especially critical for experimental features
- Check in with the user before starting implementation on non-trivial plans
- If execution goes sideways, STOP and re-plan — do not keep pushing forward

## Subagent Usage
- Spawn subagents **only when context isolation is explicitly needed**:
  - Parallel independent analysis (e.g., reviewing multiple modules simultaneously)
  - Research/exploration that would pollute the main context window
  - Adversarial review: one subagent implements, a separate reviewer subagent critiques
- One focused task per subagent — never multiplex unrelated concerns in a single subagent
- Do NOT spawn subagents for simple sequential tasks; keep the main context clean instead
- Prefer 2–3 targeted subagents over large swarms — you cannot effectively observe 10+ agents

## Task Execution
- Track progress by marking items complete in `tasks/todo.md` as you go
- Provide a high-level summary of changes at each major step
- Add a review section to `tasks/todo.md` when the task is complete

## Verification
- Never mark a task complete without proving it works
- Run tests, check logs, and demonstrate correctness before reporting done
- When relevant, diff behavior between main branch and your changes
- Ask yourself: "Would a staff engineer approve this?" before presenting results

## Bug Fixing
- When given a bug report: just fix it — no hand-holding required
- Point at logs, errors, and failing tests, then resolve them autonomously
- Fix failing CI tests without waiting to be told how
- Zero context switching required from the user

## Lessons & Self-Improvement
- After a user correction that reveals a **non-obvious or recurring pattern**, append it to `tasks/lessons.md`
- Format: `[date] Pattern: <what went wrong> → Rule: <how to prevent it>`
- Keep `tasks/lessons.md` concise — prune entries that no longer apply
- Promote frequently-violated rules directly into this file (CLAUDE.md) for permanent enforcement

> **Session Start Hook**: At the start of each session for this project, read `tasks/lessons.md`
> and apply relevant rules before proceeding. (Wire this via a `SessionStart` hook if possible.)

## Code Quality
- **Simplicity first**: make every change as minimal and targeted as possible
- No temporary fixes — find and address root causes, senior developer standards
- After completing a non-trivial change, ask once: "Is there a more elegant solution?"
  — If yes and it's low-risk, refactor. If not, ship what works.
- Do not apply elegance checks to simple, obvious fixes — avoid over-engineering

## Core Principles
- **Correctness > Elegance > Speed** — in that order
- Minimal impact: only touch code that must change; avoid introducing unrelated side effects
- No laziness: incomplete solutions and workarounds are not acceptable
