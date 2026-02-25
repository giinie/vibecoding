<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25 | Updated: 2026-02-25 -->

# utils

## Purpose
Utility modules providing image processing, AI response JSON parsing, and Plotly chart generation. Used by services and pages — no business logic.

## Key Files

| File | Description |
|------|-------------|
| `image.py` | `ImageProcessor` class: `validate_image()` (size/format check), `get_content_type()` (MIME), `compress_image()` (LANCZOS resize + JPEG compression) |
| `parser.py` | `RecipeParser` class: `extract_json()` (```json``` → dict, with fallbacks), `validate_recipe_data()` (5 required fields), `sanitize_recipe()` (defaults + normalization) |
| `charts.py` | 4 Plotly functions: `create_ingredient_bar_chart()`, `create_cuisine_pie_chart()`, `create_cooking_calendar()` (heatmap), `create_stats_metric()` |
| `__init__.py` | Barrel export: `ImageProcessor` only (charts and parser imported directly) |

## For AI Agents

### Working In This Directory
- `ImageProcessor` settings come from `Config` class (`MAX_IMAGE_SIZE_MB`, `SUPPORTED_FORMATS`) — never hardcode
- `RecipeParser.extract_json()` tries 3 strategies in order: ` ```json...``` `, ` ```...``` `, raw JSON parse
- Chart functions return `plotly.graph_objects.Figure` — render with `st.plotly_chart(fig)` in pages
- `__init__.py` only exports `ImageProcessor`; import others directly: `from utils.parser import RecipeParser`

### Common Patterns
```python
# Image processing pipeline (Page 1)
valid, error_msg = ImageProcessor.validate_image(file_bytes, filename)
if valid:
    compressed = ImageProcessor.compress_image(file_bytes, max_dimension=1024)

# Recipe JSON extraction (RecipeService)
data = RecipeParser.extract_json(api_response_text)
if data and RecipeParser.validate_recipe_data(data):
    clean = RecipeParser.sanitize_recipe(data)
```

## Dependencies

### Internal
- `services/config.py` — `Config.MAX_IMAGE_SIZE_MB`, `Config.SUPPORTED_FORMATS`

### External
- `pillow>=11.0.0` — Image validation and compression (image.py)
- `plotly>=5.18.0` — Chart generation (charts.py)
- `json`, `re`, `calendar` (stdlib) — Parsing and calendar logic

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
