# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-24
**Commit:** 0ed7bdf
**Branch:** practice

## OVERVIEW

Fridge photo → AI ingredient recognition → recipe generation. Python 3.14 / Streamlit multi-page app / SQLite / OpenRouter AI (free models). POC stage — Steps 1-3 complete.

## STRUCTURE

```
fridge-chef/
├── app.py                    # Streamlit entry — defines SESSION_STATE_DEFAULTS (canonical)
├── main.py                   # Alternative entry (rarely used)
├── pages/                    # Streamlit auto-discovers by filename prefix (1_, 2_, etc.)
│   ├── 1_🍳_재료_인식.py      # Vision: image upload → ingredient list
│   ├── 2_📖_레시피_생성.py    # Recipe: ingredients → AI recipes
│   ├── 3_👤_내_프로필.py      # Auth: register/login/profile
│   ├── 4_💾_저장된_레시피.py  # CRUD: saved recipes + share modal
│   └── 5_📊_대시보드.py       # Stats: cooking history + charts
├── services/                 # Business logic — see services/AGENTS.md
├── models/                   # ⚠️ NOT ORM models — plain dataclasses for API responses
│   └── recipe.py             # Recipe dataclass (confused with db/models.py)
├── db/                       # SQLAlchemy ORM + SQLite connection
│   ├── database.py           # Double-checked locking singleton engine; WAL mode + SQLite pragmas
│   ├── models.py             # ORM models (User, SavedRecipe, CookingHistory, etc.)
│   └── init_db.py            # Thread-safe init — called redundantly by every page
├── components/               # Streamlit UI components
│   ├── recipe_card.py        # Recipe display
│   ├── share_modal.py        # QR/SNS sharing — mutates session_state.share_recipe_id
│   ├── stats_widgets.py      # Dashboard stat cards
│   └── empty_state.py        # ⚠️ NOT exported in __init__.py, currently unused by pages
├── utils/                    # Helpers
│   ├── charts.py             # Plotly chart builders
│   ├── image.py              # PIL image validation/compression
│   └── parser.py             # RecipeParser — JSON extraction/validation for recipe API responses
└── tests/                    # 69 pytest tests — 6 files, no conftest.py
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new page | `pages/N_emoji_name.py` | Must add `sys.path.insert` hack + own `init_session_state()` |
| Add new service | `services/` | Update `services/__init__.py` exports manually |
| Add new component | `components/` | Update `components/__init__.py` exports manually |
| Change AI models | `services/config.py` | `VISION_MODEL`, `RECIPE_MODEL` constants |
| Modify DB schema | `db/models.py` | ORM models; NOT `models/` directory |
| Add API response type | `models/` | Plain dataclasses, NOT ORM |
| Auth flow | `services/auth.py` | bcrypt cost 12; uses `make_transient()` |
| Session state keys | `app.py` + each page's `init_session_state()` | Both must be updated (duplicated) |
| Test patterns | `tests/test_*.py` | Each file has own fixtures; no shared conftest |
| Environment config | `.env` | Only `OPENROUTER_API_KEY` required |

## CONVENTIONS

### Import Pattern (CRITICAL)
- **Pages**: Must prepend `sys.path.insert(0, str(Path(__file__).parent.parent))` then use absolute imports (`from services.X import ...`)
- **services/**: Mixed — `vision.py` uses relative (`from .config`), `recipe.py` uses absolute with sys.path hack
- **db/**: Absolute imports (`from db.database import ...`)
- **Rule**: When adding new files, follow the pattern of the directory you're in

### Language Convention
- UI text, user-facing strings: **Korean**
- Code comments, docstrings, variable names: **English**

### Session State as IPC Bus
Pages communicate exclusively via `st.session_state`. Key flows:

| Key | Writer | Reader | Flow |
|-----|--------|--------|------|
| `recognized_ingredients` | Page 1, Page 5 | Page 2 | Page 5 can pre-fill Page 2 via `st.switch_page()` |
| `generated_recipes` | Page 2 | Page 2 | Self-contained |
| `user_id`, `is_authenticated` | Page 3 | Pages 2,3,4,5 | Auth gate for save/history features |
| `share_recipe_id` | Page 4 | Page 4 + share_modal | Modal open/close control |
| `saved_recipes` | Page 4 | Page 4 | List of saved recipe dicts |
| `username` | Page 3 | Pages 3,4,5 | Logged-in username for display |

### ORM Object Rule
**NEVER return SQLAlchemy model instances from service methods without `make_transient()`**. Storing ORM objects in `st.session_state` causes `DetachedInstanceError`. Only `auth.py` does this correctly — if adding similar patterns elsewhere, copy that approach.

### JSON-in-Text Columns
`UserPreferences`, `SavedRecipe`, `CookingHistory` store lists as JSON-encoded `Text` columns with explicit `get_X()`/`set_X()` accessor methods. SQLite has no native array type.

## ANTI-PATTERNS (THIS PROJECT)

- **No linter, formatter, or type checker configured** — zero enforcement
- **No `conftest.py`** — DB fixtures copy-pasted across 4 of 6 test files (test_recipe.py and test_vision.py don't need DB)
- **Tests use production DB file** (`fridge_chef.db`), not `:memory:`
- **No API mocking** — tests guard with `if Config.validate():` which silently no-ops without API key
- **Dual retry** — `@retry_with_backoff(max_retries=3)` + `requests.Session` Retry adapter = up to 9 attempts
- **`init_database()` called by every page** — safe (singleton) but redundant
- **`SESSION_STATE_DEFAULTS` in app.py duplicated** by each page's `init_session_state()` — they diverge
- **`components/empty_state.py` exists but is unused** — pages write inline login-required logic instead
- **`sharing.py` BASE_URL hardcoded to `http://localhost:8501`** — POC only
- **`test_vision.py` / `test_recipe.py`** — some tests guard with `if Config.validate():` which silently no-ops without API key
- **Only 1 `# type: ignore`** in codebase: `api_utils.py:156` (`raise last_exception`)

## UNIQUE STYLES

- Cuisine distribution (`recommendation.py`) matches tags against hardcoded Korean strings: `["한식", "일식", "중식", "양식", "동남아", "기타"]`
- Image size threshold in Page 1 (1MB) is inconsistent with `Config.MAX_IMAGE_SIZE_MB` (10MB)
- `models/recipe.py` imported via `sys.path.insert` in `services/recipe.py` — only consumer

## COMMANDS

```bash
# Install
uv sync

# Run app
uv run streamlit run app.py

# Run tests (69 tests)
uv run pytest tests/ -v

# Init DB (usually auto-called)
uv run python -c "from db.init_db import init_database; init_database()"
```

## NOTES

- **Python 3.14 required** — `pyproject.toml` has `requires-python = ">=3.14"` (pre-release). `uv` only; `pip install` won't work for dev deps (uses PEP 735 `dependency-groups`)
- **No `[build-system]`** — not pip-installable. `uv run` only.
- **Free AI models** — may have rate limits, availability issues. Vision: `nvidia/nemotron-nano-12b-v2-vl:free`, Text: `nex-agi/deepseek-v3.1-nex-n1:free`
- **`models/` vs `db/models.py`** — naming collision. `models/recipe.py` = dataclass; `db/models.py` = ORM. Don't confuse them.
- **Process-global requests.Session** — `api_utils._session` is shared across all Streamlit user sessions (single process). Connection pool: 10.
