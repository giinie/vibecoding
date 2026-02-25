<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25 | Updated: 2026-02-25 -->

# pages

## Purpose
Streamlit multi-page application pages. Each file represents a navigable page in the sidebar. Files are named with number prefixes and emoji icons following Streamlit's multi-page convention. Pages orchestrate services, components, and session state to deliver the user experience.

## Key Files

| File | Description |
|------|-------------|
| `1_🍳_재료_인식.py` | Step 1: Image upload, vision API call, ingredient list editing (add/remove) |
| `2_📖_레시피_생성.py` | Step 2: Recipe generation from ingredients, difficulty/time filters, recipe saving |
| `3_👤_내_프로필.py` | Step 3: Registration/login forms, profile editing, dietary preferences, account management |
| `4_💾_저장된_레시피.py` | Step 3: Saved recipe list with filtering/sorting, tags, notes, ratings, sharing, delete |
| `5_📊_대시보드.py` | Step 3: Statistics dashboard with ingredient chart, cuisine pie chart, cooking calendar heatmap |

## For AI Agents

### Working In This Directory
- Filenames follow Streamlit convention: `{number}_{emoji}_{name}.py` - the number controls sidebar order
- Each page uses `st.session_state` for cross-page data passing (see root AGENTS.md for key map)
- Pages check `st.session_state.is_authenticated` for auth-gated features
- Use empty state components from `components/empty_state.py` when data is missing
- All user-facing text is in Korean

### Testing Requirements
- Pages are not directly unit-tested; test underlying services and components instead
- Manual testing: run `uv run streamlit run app.py` and navigate through pages
- Verify session state flows: Page 1 (ingredients) -> Page 2 (recipes) -> Page 4 (saved)

### Common Patterns
- Auth guard: `if not st.session_state.get("is_authenticated"):` with `render_login_required_state()`
- Service instantiation: `service = UserRecipeService(st.session_state.user_id)`
- Recipe card rendering via `render_recipe_card()` with callback functions
- `st.rerun()` after state changes to refresh the page
- `st.form()` for registration/login to batch inputs

### Page Data Flow
```
Page 1 (재료 인식) --[recognized_ingredients]--> Page 2 (레시피 생성)
Page 2 (레시피 생성) --[save recipe to DB]-----> Page 4 (저장된 레시피)
Page 3 (내 프로필)  --[user_id, is_authenticated]--> Pages 4, 5
Page 5 (대시보드)   <--[reads from DB]------------ CookingHistory, IngredientUsage
```

## Dependencies

### Internal
- `services/` - All service classes (VisionService, RecipeService, AuthService, etc.)
- `components/` - UI components (recipe_card, share_modal, stats_widgets, empty_state)
- `utils/charts.py` - Plotly chart generation for dashboard
- `models/recipe.py` - Recipe dataclass

### External
- `streamlit` - All page rendering and session state management

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
