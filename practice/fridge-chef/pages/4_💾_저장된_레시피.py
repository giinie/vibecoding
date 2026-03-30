"""저장된 레시피 페이지 - Saved recipes management."""
import streamlit as st
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.init_db import init_database
from services.user import UserRecipeService
from services.recommendation import RecommendationService
from components.recipe_card import render_recipe_card
from components.share_modal import render_share_modal
from utils.session_recipes import deduplicate_saved_recipes

st.set_page_config(
    page_title="저장된 레시피 - Fridge Chef",
    page_icon="💾",
    layout="wide",
)

# Ensure database is initialized (singleton - safe to call multiple times)
init_database()


def init_session_state():
    """Initialize session state variables."""
    if "user_id" not in st.session_state:
        st.session_state.user_id = None
    if "is_authenticated" not in st.session_state:
        st.session_state.is_authenticated = False
    if "saved_recipes" not in st.session_state:
        st.session_state.saved_recipes = []
    if "share_recipe_id" not in st.session_state:
        st.session_state.share_recipe_id = None


def handle_cook(saved_recipe: dict):
    """Handle cooking completion."""
    if not st.session_state.is_authenticated:
        return

    recipe_data = saved_recipe.get("recipe_data", {})
    ingredients = recipe_data.get("ingredients", {})
    all_ingredients = ingredients.get("available", []) + ingredients.get("additional_needed", [])

    rec_service = RecommendationService(st.session_state.user_id)
    rec_service.record_cooking(
        saved_recipe_id=saved_recipe.get("id"),
        recipe_name=recipe_data.get("name", "레시피"),
        ingredients=all_ingredients,
    )
    st.success("요리 완료가 기록되었습니다! 🎉")


def handle_delete(saved_recipe: dict):
    """Handle recipe deletion."""
    if not st.session_state.is_authenticated:
        return

    service = UserRecipeService(st.session_state.user_id)
    if service.delete_recipe(saved_recipe["id"]):
        st.success("레시피가 삭제되었습니다.")
        st.rerun()


def handle_share(saved_recipe: dict):
    """Handle share action."""
    st.session_state.share_recipe_id = saved_recipe.get("id")


def handle_guest_delete(index: int):
    """Remove a guest-saved recipe from session state."""
    guest_recipes = deduplicate_saved_recipes(st.session_state.saved_recipes)
    if 0 <= index < len(guest_recipes):
        guest_recipes.pop(index)
        st.session_state.saved_recipes = guest_recipes
        st.success("임시 저장 레시피를 삭제했습니다.")
        st.rerun()


def render_rating_widget(saved_recipe: dict, key: str):
    """Render rating widget."""
    current_rating = saved_recipe.get("rating") or 0

    cols = st.columns(5)
    new_rating = current_rating

    for i in range(5):
        with cols[i]:
            if i < current_rating:
                if st.button("⭐", key=f"{key}_star_{i}"):
                    new_rating = i + 1
            else:
                if st.button("☆", key=f"{key}_empty_{i}"):
                    new_rating = i + 1

    if new_rating != current_rating:
        service = UserRecipeService(st.session_state.user_id)
        service.update_recipe(saved_recipe["id"], rating=new_rating)
        st.rerun()


def main():
    """Main page function."""
    init_session_state()

    st.title("💾 저장된 레시피")

    if not st.session_state.is_authenticated:
        guest_recipes = deduplicate_saved_recipes(st.session_state.saved_recipes)
        st.session_state.saved_recipes = guest_recipes

        st.info("현재는 이 브라우저에 임시 저장된 레시피만 볼 수 있습니다. 로그인하면 계정에 영구 저장됩니다.")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("👤 로그인하기", use_container_width=True):
                st.switch_page("pages/3_👤_내_프로필.py")
        with col2:
            if st.button("📖 레시피 생성하기", use_container_width=True):
                st.switch_page("pages/2_📖_레시피_생성.py")

        if not guest_recipes:
            st.warning("임시 저장된 레시피가 없습니다.")
            return

        st.divider()
        st.markdown(f"### 💾 임시 저장 {len(guest_recipes)}개")

        for idx, recipe_data in enumerate(guest_recipes):
            with st.container():
                render_recipe_card(
                    recipe_data=recipe_data,
                    show_actions=False,
                    key_prefix=f"guest_saved_{idx}",
                )
                if st.button("🗑️ 임시 저장 삭제", key=f"guest_delete_{idx}", use_container_width=True):
                    handle_guest_delete(idx)
        return

    service = UserRecipeService(st.session_state.user_id)

    # Filters
    col1, col2, col3 = st.columns([2, 1, 1])

    with col1:
        search = st.text_input("🔍 검색", placeholder="레시피 이름으로 검색")

    with col2:
        all_tags = service.get_all_tags()
        tag_options = ["전체"] + all_tags
        selected_tag = st.selectbox("태그 필터", options=tag_options)

    with col3:
        sort_options = {
            "최근 저장순": ("saved_at", False),
            "오래된 순": ("saved_at", True),
            "높은 평점순": ("rating", False),
        }
        sort_label = st.selectbox("정렬", options=list(sort_options.keys()))
        sort_by, ascending = sort_options[sort_label]

    st.divider()

    # Get recipes
    tag_filter = None if selected_tag == "전체" else selected_tag
    recipes = service.get_saved_recipes(tag=tag_filter, sort_by=sort_by, ascending=ascending)

    # Search filter
    if search:
        recipes = [
            r for r in recipes
            if search.lower() in r["recipe_data"].get("name", "").lower()
        ]

    if not recipes:
        st.info("저장된 레시피가 없습니다. 레시피 생성 페이지에서 레시피를 저장해보세요!")
        if st.button("📖 레시피 생성하기"):
            st.switch_page("pages/2_📖_레시피_생성.py")
        return

    st.markdown(f"### 📚 총 {len(recipes)}개의 레시피")

    # Display recipes
    for idx, saved_recipe in enumerate(recipes):
        recipe_data = saved_recipe["recipe_data"]

        with st.container():
            # Recipe header with rating
            col1, col2 = st.columns([3, 1])
            with col1:
                st.markdown(f"### 🍽️ {recipe_data.get('name', '레시피')}")
            with col2:
                render_rating_widget(saved_recipe, f"rate_{idx}")

            # Cooking count
            cook_count = service.get_cooking_count(saved_recipe["id"])
            if cook_count > 0:
                st.caption(f"🍳 {cook_count}회 요리함")

            # Recipe details
            render_recipe_card(
                recipe_data=recipe_data,
                saved_recipe=saved_recipe,
                show_actions=True,
                on_cook=handle_cook,
                on_share=handle_share,
                on_delete=handle_delete,
                key_prefix=f"saved_{idx}",
            )

            # Edit tags/notes
            with st.expander("✏️ 메모 및 태그 편집"):
                with st.form(f"edit_form_{idx}"):
                    new_tags = st.text_input(
                        "태그 (쉼표로 구분)",
                        value=", ".join(saved_recipe.get("tags", [])),
                        placeholder="예: 한식, 간단요리, 다이어트"
                    )
                    new_notes = st.text_area(
                        "메모",
                        value=saved_recipe.get("notes") or "",
                        placeholder="레시피에 대한 메모를 남겨보세요"
                    )

                    if st.form_submit_button("저장"):
                        tags = [t.strip() for t in new_tags.split(",") if t.strip()]
                        service.update_recipe(
                            saved_recipe["id"],
                            tags=tags,
                            notes=new_notes
                        )
                        st.success("수정되었습니다!")
                        st.rerun()

            # Share modal
            if st.session_state.share_recipe_id == saved_recipe["id"]:
                render_share_modal(
                    recipe_data=recipe_data,
                    saved_recipe_id=saved_recipe["id"],
                    user_id=st.session_state.user_id,
                    key_prefix=f"share_{idx}",
                )


if __name__ == "__main__":
    main()
