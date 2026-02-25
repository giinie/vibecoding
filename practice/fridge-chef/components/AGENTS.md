<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-25 | Updated: 2026-02-25 -->

# components

## Purpose
Reusable Streamlit UI components used across multiple pages. Provides consistent recipe display cards, sharing modals, statistics widgets, and empty state placeholders. All components are pure rendering functions (no business logic).

## Key Files

| File | Description |
|------|-------------|
| `recipe_card.py` | `render_recipe_card()`: displays recipe with metadata, ingredients, instructions, actions (save/cook/share/delete with confirmation) |
| `share_modal.py` | `render_share_modal()`: share dialog with link, formatted text, QR code, and SNS buttons (KakaoTalk, Twitter, Facebook) |
| `stats_widgets.py` | `render_stat_card()` and `render_stats_row()`: dashboard metric cards using `st.metric()` |
| `empty_state.py` | Contextual empty states: `render_no_ingredients_state()`, `render_no_recipes_state()`, `render_no_cooking_history_state()`, `render_login_required_state()` with navigation actions |
| `__init__.py` | Barrel export: `render_recipe_card`, `render_share_modal`, `render_stat_card`, `render_stats_row` |

## For AI Agents

### Working In This Directory
- Components are stateless rendering functions, NOT classes
- All functions take data as input and call `st.*` methods directly
- Use `key_prefix` parameter to avoid Streamlit widget key collisions when multiple instances render
- Components handle their own layout via `st.columns()`
- Delete actions include a two-step confirmation flow using session state

### Testing Requirements
- Components are UI-only; testing requires Streamlit testing framework or manual verification
- Business logic should NOT be in components - keep it in `services/`

### Common Patterns
- `key_prefix: str = ""` parameter on every component for unique widget keys
- Callback pattern: `on_save`, `on_cook`, `on_share`, `on_delete` callables passed as props
- `st.expander()` for collapsible sections (instructions, share modal)
- `st.columns()` for horizontal layouts
- `unsafe_allow_html=True` for custom-styled empty states
- `st.switch_page()` for navigation from empty states

## Dependencies

### Internal
- `services/sharing.py` - `SharingService` used in `share_modal.py` for link/QR generation

### External
- `streamlit` - All UI rendering
- `urllib.parse` - URL encoding for SNS share links

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->