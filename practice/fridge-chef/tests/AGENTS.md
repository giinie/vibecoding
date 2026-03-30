<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25 | Updated: 2026-02-25 -->

# tests

## Purpose
Pytest test suite with 79 tests covering service modules plus session-state helper utilities. Tests use extensive mocking to avoid real API calls and isolated in-memory SQLite for database tests.

## Key Files

| File | Description |
|------|-------------|
| `test_vision.py` | 8 tests: VisionService, image encoding, ingredient parsing, API error handling |
| `test_recipe.py` | 16 tests: RecipeService, JSON parsing, recipe validation, sanitization, prompt building |
| `test_auth.py` | 18 tests: AuthService registration, login, password hashing, profile/preference CRUD, account deletion, validation rules |
| `test_user.py` | 9 tests: UserRecipeService save/get/update/delete recipes, tagging, sorting |
| `test_recommendation.py` | 9 tests: RecommendationService stats, cooking calendar, ingredient usage, streak calculation |
| `test_sharing.py` | 12 tests: SharingService share link generation, QR codes, text formatting, enable/disable sharing, ownership checks |
| `test_session_recipes.py` | 5 tests: guest session recipe serialization, normalization, signature, and deduplication |
| `__init__.py` | Empty package marker |

## For AI Agents

### Working In This Directory
- Run all tests: `uv run pytest tests/ -v`
- Run single file: `uv run pytest tests/test_auth.py -v`
- All API calls are mocked - tests never hit real endpoints
- DB-dependent tests create isolated in-memory SQLite with fresh schema per test via `tests/conftest.py`
- Tests follow Arrange-Act-Assert pattern

### Testing Requirements
- All 79 tests must pass before committing
- When adding new service methods, add corresponding tests
- Mock external dependencies, not internal modules
- Test both success and error paths

### Common Patterns
- `@patch("services.vision.get_api_session")` for mocking API sessions
- `@patch.object(AuthService, "hash_password")` for deterministic hashing in tests
- Fixtures: shared in-memory DB autouse fixture from `tests/conftest.py`, sample user/recipe data
- `pytest.raises(APIError)` for error path testing
- Parametrized tests for multiple input variations

## Dependencies

### Internal
- `services/` - All service classes under test
- `db/` - Models and database setup for integration tests
- `models/` - Recipe dataclass for test data construction

### External
- `pytest>=8.0.0` - Test framework (dev dependency)
- `unittest.mock` (stdlib) - Mocking (patch, MagicMock)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
