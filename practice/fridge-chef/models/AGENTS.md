<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25 | Updated: 2026-02-25 -->

# models

## Purpose
Data transfer objects (DTOs) for the application. Contains the `Recipe` dataclass used to pass recipe data between the service layer and UI layer in a type-safe manner.

## Key Files

| File | Description |
|------|-------------|
| `recipe.py` | `Recipe` dataclass with `from_dict()` / `to_dict()` serialization methods |
| `__init__.py` | Barrel export: re-exports `Recipe` for convenient `from models import Recipe` |

## For AI Agents

### Working In This Directory
- Models here are pure Python dataclasses (not SQLAlchemy ORM models)
- ORM models live in `db/models.py` - do NOT confuse the two
- Use `@dataclass` with `field(default_factory=list)` for mutable defaults
- All fields have type hints

### Testing Requirements
- Recipe parsing is tested in `tests/test_recipe.py`
- Test `from_dict()` with partial/missing data to verify defaults

### Common Patterns
- `from_dict(cls, data: dict)` classmethod for JSON-to-object conversion
- `to_dict(self)` method for object-to-JSON conversion
- Default values for all optional fields (difficulty="보통", cooking_time=30, servings=2)

## Dependencies

### Internal
- None (this is a leaf module with no internal dependencies)

### External
- `dataclasses` (stdlib) - Dataclass decorator and field utilities

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
