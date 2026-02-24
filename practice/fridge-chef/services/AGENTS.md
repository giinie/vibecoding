# SERVICES — Business Logic Layer

## OVERVIEW

All AI, auth, and data services. 9 files, ~1500 lines. Only `VisionService` and `Config` exported via `__init__.py` — all others require direct import.

## MODULE MAP

| File | Class/Functions | Dependencies | Notes |
|------|----------------|--------------|-------|
| `config.py` | `Config` (class) | `os`, `dotenv` | All constants: API URL, models, timeouts. Only `OPENROUTER_API_KEY` from env |
| `api_utils.py` | `get_api_session()`, `close_api_session()`, `validate_openrouter_response()`, `make_api_request()`, `@retry_with_backoff`, `APIError` | `requests`, `urllib3` | Process-global `_session` singleton. Connection pool: 10 |
| `vision.py` | `VisionService` | `config`, `api_utils` | Image → ingredient list via OpenRouter Vision API |
| `recipe.py` | `RecipeService` | `config`, `api_utils`, `models.recipe`, `utils.parser` | Ingredients → recipes. Uses `sys.path` hack for `models.recipe` import. `RecipeParser` is in `utils/parser.py` |
| `auth.py` | `AuthService` | `bcrypt`, `db.models`, `db.database` | Register/login/profile. `make_transient()` on all returned ORM objects |
| `user.py` | `UserRecipeService` | `db.models`, `db.database` | Save/list/delete recipes, cooking history, ingredient usage |
| `recommendation.py` | `RecommendationService` | `db.models`, `db.database` | Stats, cuisine distribution, personalized suggestions |
| `sharing.py` | `SharingService` | `db.models`, `db.database`, `qrcode` | Share links + QR codes. `BASE_URL` hardcoded to localhost |

## CRITICAL PATTERNS

### Dual Retry (⚠️ unintentional 9x retry)
Both `vision.py` and `recipe.py` have:
1. `@retry_with_backoff(max_retries=3)` decorator from `api_utils.py`
2. `self._session` from `get_api_session()` which mounts `Retry(total=3)` adapter

Result: up to 3 × 3 = 9 HTTP attempts per call. Be aware when debugging timeouts.

### `make_transient()` — Auth Only
Only `auth.py` calls `make_transient(user)` before returning ORM objects. If you add a new service that returns ORM objects for storage in `st.session_state`, you MUST do the same or you'll get `DetachedInstanceError`.

### Process-Global Session (`api_utils._session`)
`get_api_session()` returns a module-level `requests.Session` singleton. All `VisionService` and `RecipeService` instances across all Streamlit user sessions share this one session object. Thread-safe for reads, but be careful with any stateful mutations.

### Partial `__init__.py` Exports
`__init__.py` only exports `VisionService` and `Config`. Other services (`RecipeService`, `AuthService`, `UserRecipeService`, `RecommendationService`, `SharingService`) must be imported directly:
```python
from services.auth import AuthService        # ✓ correct
from services import AuthService             # ✗ ImportError
```
When adding a new service, either update `__init__.py` or document the direct import path.

### Import Style Split
- `vision.py`: relative imports (`from .config import Config`)
- `recipe.py`: absolute imports with `sys.path.insert` hack (`from services.config import Config`)
- **Prefer relative imports** for new services in this package

## JSON-in-Text Column Accessors
Services that read `UserPreferences`, `SavedRecipe`, or `CookingHistory` must use the ORM model's `get_X()`/`set_X()` methods — these columns are JSON-encoded `Text`, not native lists. Direct attribute access returns raw JSON strings.

## HARDCODED VALUES (potential config candidates)
- `recipe.py`: `temperature=0.7`, `max_tokens=4096` — inline in API call
- `sharing.py:14`: `BASE_URL = "http://localhost:8501"` — POC only
- `auth.py:12`: `COST_FACTOR = 12` — bcrypt rounds (acceptable, rarely changes)
- `config.py`: `API_TIMEOUT=60`, `MAX_IMAGE_SIZE_MB=10` — not env-configurable
