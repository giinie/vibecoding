<!-- Generated: 2026-02-25 | Updated: 2026-02-25 -->

# Fridge Chef

## Purpose
AI-powered recipe recommendation service that recognizes ingredients from fridge photos and generates personalized recipes. Built as a Streamlit multi-page application with SQLite persistence, targeting Korean-speaking users. Currently at POC stage with Steps 1-3 completed.

## Key Files

| File | Description |
|------|-------------|
| `app.py` | Streamlit main entry point; initializes DB (singleton), session state, and renders home page |
| `test_api.py` | Standalone OpenRouter API smoke test script (not part of pytest suite) |
| `pyproject.toml` | Project manifest: dependencies, Python >=3.14, dev deps (pytest) |
| `.env.example` | Template for required `OPENROUTER_API_KEY` environment variable |
| `CLAUDE.md` | Comprehensive project context for AI agents (tech stack, commands, architecture) |
| `PRD_step1.md` | Product requirements for Step 1 (ingredient recognition) |
| `PRD_step2.md` | Product requirements for Step 2 (recipe generation) |
| `PRD_step3.md` | Product requirements for Step 3 (user profiles and personalization) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `services/` | Business logic layer: API integrations, auth, recommendations (see `services/AGENTS.md`) |
| `db/` | Database layer: SQLAlchemy models, connection management, schema init (see `db/AGENTS.md`) |
| `components/` | Reusable Streamlit UI components: recipe cards, modals, widgets (see `components/AGENTS.md`) |
| `utils/` | Utility modules: image processing, JSON parsing, chart helpers (see `utils/AGENTS.md`) |
| `pages/` | Streamlit multi-page structure: 5 pages for the app flow (see `pages/AGENTS.md`) |
| `models/` | Data transfer objects: Recipe dataclass (see `models/AGENTS.md`) |
| `tests/` | Pytest test suite: 66 tests across 6 files (see `tests/AGENTS.md`) |
| `docs/` | Project documentation: work reports, collaboration proposals (see `docs/AGENTS.md`) |
| `.claude/` | Claude Code agent configurations |

## For AI Agents

### Working In This Directory
- **Language**: UI text in Korean, code comments and docstrings in English
- **Package manager**: `uv` (not pip). Always use `uv run` to execute commands
- **Python version**: 3.14+ required (uses `list[str]` union syntax `str | None`)
- **Entry point**: `uv run streamlit run app.py`
- **Environment**: Requires `.env` file with `OPENROUTER_API_KEY`
- **DB init**: Database auto-initializes on app startup via singleton in `app.py`

### Testing Requirements
- Run: `uv run pytest tests/ -v`
- 66 tests across 6 test files, all should pass
- Tests use mocking extensively (no real API calls)
- DB tests use in-memory SQLite fixtures

### Common Patterns
- **Singleton pattern**: DB engine (`db/database.py`), DB init (`db/init_db.py`)
- **Service classes**: Business logic encapsulated in stateless or user-scoped service classes
- **Session state**: Centralized defaults in `app.py` `SESSION_STATE_DEFAULTS` dict
- **Context manager**: `get_db()` for DB session lifecycle management
- **Retry with backoff**: API calls use `@retry_with_backoff` decorator
- **JSON in Text columns**: SQLAlchemy models store lists as JSON-serialized Text columns with getter/setter methods

### Architecture Flow
```
User -> Streamlit Pages (pages/) -> Service Layer (services/) -> External APIs (OpenRouter)
                                                              -> Database (db/)
Pages use Components (components/) and Utils (utils/)
Services use Models (models/) for data transfer
```

### Session State Keys (Cross-Page Communication)
| Key | Type | Set By | Used By |
|-----|------|--------|---------|
| `recognized_ingredients` | `list[str]` | Page 1 | Page 2 |
| `uploaded_image` | `bytes` | Page 1 | Page 1 |
| `generated_recipes` | `list[Recipe]` | Page 2 | Page 2, 4 |
| `saved_recipes` | `list` | Page 4 | Page 4 |
| `user_id` | `int` | Page 3 | Pages 3, 4, 5 |
| `is_authenticated` | `bool` | Page 3 | All pages |
| `username` | `str \| None` | Page 3 | Pages 3, 4, 5 |
| `share_recipe_id` | `int \| None` | Page 4 | Page 4 |

## Dependencies

### External
- `streamlit>=1.40.0` - Web framework (multi-page app)
- `sqlalchemy>=2.0.0` - ORM with declarative models
- `bcrypt>=4.2.0` - Password hashing (cost factor 12)
- `requests>=2.32.0` - HTTP client for OpenRouter API
- `pillow>=11.0.0` - Image validation and compression
- `plotly>=5.18.0` - Dashboard charts (bar, pie, heatmap)
- `qrcode[pil]>=7.4.0` - QR code generation for recipe sharing
- `python-dotenv>=1.0.0` - Environment variable loading

### AI Models (via OpenRouter)
- **Vision**: `nvidia/nemotron-nano-12b-v2-vl:free` - Ingredient recognition from images
- **Text**: `nex-agi/deepseek-v3.1-nex-n1:free` - Recipe generation

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->