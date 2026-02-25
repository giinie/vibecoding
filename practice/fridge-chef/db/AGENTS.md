<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25 | Updated: 2026-02-25 -->

# db

## Purpose
Database layer: SQLAlchemy 2.0 ORM models, SQLite connection with WAL mode, and thread-safe schema initialization. All DB access in the app flows through `get_db()` context manager.

## Key Files

| File | Description |
|------|-------------|
| `database.py` | Singleton engine (`get_engine()`), `SessionLocal` factory, `get_db()` context manager (auto commit/rollback/close), SQLite WAL pragma config |
| `models.py` | 5 ORM models: `User`, `UserPreferences`, `SavedRecipe`, `CookingHistory`, `IngredientUsage` with cascade deletes and JSON getter/setter pairs |
| `init_db.py` | `init_database()`: thread-safe singleton (`Lock` + `_initialized` flag) calling `Base.metadata.create_all()` once |
| `__init__.py` | Barrel export: `get_session`, `get_db`, `engine`, all 5 ORM models |

## For AI Agents

### Working In This Directory
- ORM models live HERE; `models/recipe.py` is a separate DTO dataclass — do NOT confuse them
- Always access DB via `with get_db() as session:` — never create sessions manually
- When returning ORM objects outside session scope, call `make_transient(obj)` first
- `expire_on_commit=False` is set — objects remain accessible after commit

### Model Relationships
```
User ─1:1→ UserPreferences     (cascade: all, delete-orphan)
User ─1:N→ SavedRecipe         (cascade: all, delete-orphan)
User ─1:N→ CookingHistory      (cascade: all, delete-orphan)
User ─1:N→ IngredientUsage     (cascade: all, delete-orphan)
SavedRecipe ─1:N→ CookingHistory (ondelete="SET NULL")
```

### JSON-in-Text Column Pattern
Models store `list[str]` as JSON-serialized `Text` columns. Always use getter/setter pairs:
```python
# CORRECT
prefs.get_dietary_preferences()        # → list[str]
prefs.set_dietary_preferences(["채식"])  # ensure_ascii=False

# WRONG — never read/write the column directly
prefs.dietary_preferences = '["채식"]'
```

### SQLite Pragmas (auto-configured on connect)
- `journal_mode=WAL` — concurrent reads during writes
- `synchronous=NORMAL` — balanced safety/speed
- `cache_size=10000`, `mmap_size=256MB`, `temp_store=MEMORY`

### Key Indexes
| Table | Index | Columns |
|-------|-------|---------|
| `saved_recipes` | `idx_user_rating` | `user_id, rating` |
| `saved_recipes` | `idx_user_saved_at` | `user_id, saved_at` |
| `saved_recipes` | `idx_share_id` | `share_id` (unique) |
| `cooking_history` | `idx_date` | `cooked_at` |
| `ingredient_usage` | `idx_user_ingredient` | `user_id, ingredient_name` |

## Dependencies

### Internal
- None (this is a foundational module — other modules depend on it)

### External
- `sqlalchemy>=2.0.0` — ORM, engine, session management
- `json` (stdlib) — JSON serialization for Text columns

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->