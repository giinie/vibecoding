# Lessons Learned

<!-- Format: [date] Pattern: <what went wrong> → Rule: <how to prevent it> -->

[2026-03-12] [promoted → WORKFLOW_ORCHESTRATION.md Planning 섹션] Pattern: ai-review SKILL.md specified "create 2 Teams simultaneously" but Claude Code official docs already stated "One team per session" limitation. Designing without checking docs led to runtime failure. → Rule: **Always check official documentation limitations before designing/implementing features that rely on platform capabilities (Team, Agent, MCP, etc.).** Especially critical for experimental features which tend to have more constraints.
