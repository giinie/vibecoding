<!-- Generated: 2026-04-08 | Updated: 2026-04-08 -->

# Fridge Chef Repository Guide

This file is the **repo-scope** instruction layer for Fridge Chef.
Keep it focused on repository-local facts, commands, and conventions.
Global user preferences belong in `~/.codex/USER_REQUIREMENTS.md`.

## Project Summary
- AI-powered Streamlit app that recognizes fridge ingredients from images and generates personalized recipes.
- Primary audience: Korean-speaking users.
- Current stage: POC with Steps 1-3 implemented.

## Local Conventions
- UI text: Korean.
- Agent-facing docs, code comments, and docstrings: English.
- Python toolchain: `uv`.
- When Node/JavaScript work is needed, prefer `pnpm`.
- Python 3.14+ is required.

## Runbook
- Start app: `uv run streamlit run app.py`
- Run tests: `uv run pytest tests/ -v`
- Required for app/API use: `.env` with `OPENROUTER_API_KEY`
- Tests mock external APIs and should not require real API credentials.
- Optional env: `APP_BASE_URL` for share links
- DB initializes automatically on app startup.
- If `bcrypt` or `pillow` imports break in the shared workspace env, recover with:
  - `uv sync --package fridge-chef --reinstall-package bcrypt --reinstall-package pillow`

## Verification
- Configured automated verification: `uv run pytest tests/ -v`
- No project-configured lint or typecheck command is defined as of 2026-05-06.
- Last verified test count: 79 collected / 79 passing with `uv run pytest tests/ -q` on 2026-05-06.

## Repository Map
- `app.py` — Streamlit entry point and session/bootstrap setup
- `pages/` — 5-page Streamlit flow
- `services/` — business logic and API integrations
- `db/` — SQLAlchemy models, engine, schema init
- `components/` — reusable Streamlit UI components
- `utils/` — image, JSON, and helper utilities
- `models/` — DTOs such as `Recipe`
- `tests/` — pytest suite
- `docs/` — historical reports and QA/reference docs

## Architecture
```text
User -> Streamlit Pages -> Services -> OpenRouter / Database
                    \-> Components / Utils / Models
```

## Important App State
Cross-page session state keys used by the app:
- `recognized_ingredients`
- `uploaded_image`
- `generated_recipes`
- `saved_recipes`
- `user_id`
- `is_authenticated`
- `username`
- `share_recipe_id`
- `post_login_notice`

## Testing Notes
- The repo currently has 79 pytest tests across 7 files.
- Tests rely heavily on mocking; no real API calls should be required.
- DB tests use in-memory SQLite fixtures.

## Known Patterns
- Singleton DB engine / init flow
- Stateless or user-scoped service classes
- Centralized Streamlit session defaults in `app.py`
- `get_db()` context manager for DB lifecycle
- Retry-with-backoff for API calls
- JSON serialized lists stored in SQLAlchemy text columns
