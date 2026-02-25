<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25 | Updated: 2026-02-25 -->

# services

## Purpose
Business logic layer containing all service classes. Each service encapsulates a specific domain: vision AI, recipe generation, authentication, user management, personalized recommendations, and social sharing. Services interact with the database layer (`db/`) and external APIs (OpenRouter).

## Key Files

| File | Description |
|------|-------------|
| `config.py` | `Config` class: centralized configuration from env vars (API keys, model names, limits) |
| `api_utils.py` | Shared API utilities: `APIError` exception, `get_api_session()` connection pooling, `make_api_request()` HTTP POST with error handling, `retry_with_backoff` decorator, `validate_openrouter_response()` content extraction, `close_api_session()` cleanup |
| `vision.py` | `VisionService`: sends fridge images to OpenRouter Vision API, parses ingredient lists |
| `recipe.py` | `RecipeService`: generates recipes from ingredients via OpenRouter Text API, returns `Recipe` objects |
| `auth.py` | `AuthService`: user registration, login, profile/preferences CRUD (bcrypt hashing, cost=12) |
| `user.py` | `UserRecipeService`: saved recipe CRUD, tagging, rating, favorites, sorting |
| `recommendation.py` | `RecommendationService`: cooking stats, calendar heatmap, ingredient usage tracking, streak calculation |
| `sharing.py` | `SharingService`: share link generation, QR codes, formatted text for SNS, enable/disable sharing |
| `__init__.py` | Barrel export: `VisionService`, `Config` |

## For AI Agents

### Working In This Directory
- Each service is a class with static methods (AuthService, SharingService) or instance methods requiring user_id (UserRecipeService, RecommendationService)
- API-calling services (VisionService, RecipeService) use the shared session from `api_utils.py`
- Always use `@retry_with_backoff` decorator for API calls
- DB access is done via `get_db()` context manager from `db/database.py`
- Config values come from `Config` class, never hardcoded

### Testing Requirements
- Each service has a corresponding test file in `tests/`
- Mock all external API calls (never make real HTTP requests in tests)
- Mock DB sessions for database-dependent tests
- Test error paths and edge cases (empty inputs, API failures)

### Common Patterns
- `@retry_with_backoff(max_retries=3, initial_delay=1.0)` for API resilience
- `validate_openrouter_response(result)` to extract content from API responses
- `with get_db() as session:` for all database operations
- `make_transient(user)` to detach ORM objects from session before returning
- JSON getter/setter pairs on models (e.g., `get_tags()` / `set_tags()`)

## Dependencies

### Internal
- `db/database.py` - `get_db()` context manager, `get_session()`
- `db/models.py` - SQLAlchemy ORM models (User, SavedRecipe, etc.)
- `models/recipe.py` - `Recipe` dataclass for data transfer
- `utils/parser.py` - `RecipeParser` for JSON extraction from API responses

### External
- `requests` - HTTP client (with session pooling via `HTTPAdapter`)
- `bcrypt` - Password hashing
- `qrcode` - QR code generation
- `python-dotenv` - Environment variable loading

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->