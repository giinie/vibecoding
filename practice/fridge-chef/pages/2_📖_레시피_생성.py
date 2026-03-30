"""레시피 생성 페이지 - Step 2: Recipe generation from ingredients."""
import streamlit as st
import sys
from pathlib import Path

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.recipe import RecipeService
from services.config import Config
from services.user import UserRecipeService
from db.init_db import init_database
from models.recipe import Recipe
from utils.session_recipes import deduplicate_saved_recipes, recipe_signature, serialize_recipe_for_session

# Ensure database is initialized (singleton - safe to call multiple times)
init_database()

st.set_page_config(
    page_title="레시피 생성 - Fridge Chef",
    page_icon="📖",
    layout="wide",
)


def init_session_state():
    """Initialize session state variables."""
    if "recognized_ingredients" not in st.session_state:
        st.session_state.recognized_ingredients = []
    if "generated_recipes" not in st.session_state:
        st.session_state.generated_recipes = []
    if "saved_recipes" not in st.session_state:
        st.session_state.saved_recipes = []
    if "user_id" not in st.session_state:
        st.session_state.user_id = None
    if "is_authenticated" not in st.session_state:
        st.session_state.is_authenticated = False


def render_ingredient_section():
    """Render the ingredient display and edit section."""
    st.markdown("### 📦 인식된 재료")

    if not st.session_state.recognized_ingredients:
        st.warning("먼저 '재료 인식' 페이지에서 재료를 인식해주세요.")
        if st.button("🍳 재료 인식 페이지로 이동"):
            st.switch_page("pages/1_🍳_재료_인식.py")
        return False

    # Display ingredients as tags
    ingredients = st.session_state.recognized_ingredients.copy()
    cols = st.columns(min(len(ingredients), 6))
    for idx, ingredient in enumerate(ingredients):
        with cols[idx % 6]:
            st.markdown(f"🏷️ **{ingredient}**")

    # Quick edit option
    with st.expander("✏️ 재료 수정하기"):
        col1, col2 = st.columns([3, 1])
        with col1:
            new_ingredient = st.text_input(
                "재료 추가",
                placeholder="추가할 재료명",
                key="add_ingredient_recipe_page",
                label_visibility="collapsed",
            )
        with col2:
            if st.button("➕ 추가", key="add_btn_recipe"):
                if new_ingredient and new_ingredient not in st.session_state.recognized_ingredients:
                    st.session_state.recognized_ingredients.append(new_ingredient)
                    st.rerun()

        to_remove = st.multiselect(
            "삭제할 재료",
            options=st.session_state.recognized_ingredients,
            key="remove_ingredients_recipe",
        )
        if to_remove and st.button("🗑️ 삭제", key="remove_btn_recipe"):
            for item in to_remove:
                st.session_state.recognized_ingredients.remove(item)
            st.rerun()

    return True


def render_settings():
    """Render recipe generation settings."""
    st.markdown("### ⚙️ 레시피 설정")

    col1, col2 = st.columns(2)

    with col1:
        difficulty = st.selectbox(
            "난이도",
            options=["쉬움", "보통", "어려움"],
            index=1,
            help="원하는 요리 난이도를 선택하세요",
        )

    with col2:
        time_options = {
            "15분 이하": 15,
            "30분 이하": 30,
            "1시간 이하": 60,
            "제한 없음": 180,
        }
        time_label = st.selectbox(
            "조리 시간",
            options=list(time_options.keys()),
            index=1,
            help="최대 조리 시간을 선택하세요",
        )
        max_time = time_options[time_label]

    # Dietary preferences
    st.markdown("**식이 제한**")
    col1, col2, col3 = st.columns(3)
    with col1:
        vegetarian = st.checkbox("🥬 채식")
    with col2:
        low_sodium = st.checkbox("🧂 저염")
    with col3:
        diet = st.checkbox("💪 다이어트")

    dietary = []
    if vegetarian:
        dietary.append("채식")
    if low_sodium:
        dietary.append("저염")
    if diet:
        dietary.append("다이어트")

    # Exclude ingredients
    exclude_input = st.text_input(
        "제외할 재료 (쉼표로 구분)",
        placeholder="예: 땅콩, 새우",
        help="알레르기 등으로 제외할 재료를 입력하세요",
    )
    exclude = [x.strip() for x in exclude_input.split(",") if x.strip()] if exclude_input else []

    return {
        "difficulty": difficulty,
        "max_time": max_time,
        "dietary": dietary if dietary else None,
        "exclude": exclude if exclude else None,
    }


def render_recipe_card(recipe: Recipe, idx: int):
    """Render a single recipe card.

    Args:
        recipe: Recipe object to display.
        idx: Recipe index for unique keys.
    """
    with st.container():
        st.markdown(f"### 🍽️ {recipe.name}")
        st.caption(recipe.description)

        # Recipe metadata
        col1, col2, col3 = st.columns(3)
        with col1:
            st.markdown(f"⏱️ **{recipe.cooking_time}분**")
        with col2:
            difficulty_emoji = {"쉬움": "🟢", "보통": "🟡", "어려움": "🔴"}.get(recipe.difficulty, "🟡")
            st.markdown(f"{difficulty_emoji} **{recipe.difficulty}**")
        with col3:
            st.markdown(f"👥 **{recipe.servings}인분**")

        st.divider()

        # Ingredients
        col_left, col_right = st.columns(2)
        with col_left:
            st.markdown("**✅ 보유 재료**")
            if recipe.available_ingredients:
                st.write(", ".join(recipe.available_ingredients))
            else:
                st.caption("없음")

        with col_right:
            st.markdown("**🛒 필요 재료**")
            if recipe.additional_ingredients:
                st.write(", ".join(recipe.additional_ingredients))
            else:
                st.caption("추가 재료 없음")

        # Instructions
        with st.expander("📋 조리 순서 보기", expanded=False):
            for step in recipe.instructions:
                st.markdown(f"{step}")

        # Tips
        if recipe.tips:
            st.markdown("**💡 팁**")
            for tip in recipe.tips:
                st.info(tip)

        # Action buttons
        col1, col2 = st.columns(2)
        with col1:
            if st.button("💾 저장하기", key=f"save_{idx}", use_container_width=True):
                if st.session_state.is_authenticated:
                    # Save to database for logged-in users
                    service = UserRecipeService(st.session_state.user_id)
                    service.save_recipe(recipe.to_dict())
                    st.success("레시피가 저장되었습니다!")
                else:
                    # Save to session state for guests
                    recipe_data = serialize_recipe_for_session(recipe)
                    saved_recipes = deduplicate_saved_recipes(st.session_state.saved_recipes)
                    existing_signatures = {recipe_signature(saved) for saved in saved_recipes}
                    if recipe_signature(recipe_data) not in existing_signatures:
                        saved_recipes.append(recipe_data)
                        st.session_state.saved_recipes = saved_recipes
                        st.success("레시피가 저장되었습니다! (로그인하면 영구 저장됩니다)")
                    else:
                        st.session_state.saved_recipes = saved_recipes
                        st.info("이미 저장된 레시피입니다.")

        st.markdown("---")


def get_recipe_error_message(error: Exception) -> dict:
    """Convert recipe generation errors to user-friendly messages."""
    error_str = str(error).lower()

    if "timeout" in error_str:
        return {
            "title": "요청 시간이 초과되었습니다.",
            "suggestion": "재료 개수를 줄이거나, 잠시 후 다시 시도해주세요."
        }
    elif "rate" in error_str or "429" in error_str:
        return {
            "title": "서버가 바쁩니다.",
            "suggestion": "1분 후에 다시 시도해주세요."
        }
    else:
        return {
            "title": "레시피 생성 중 문제가 발생했습니다.",
            "suggestion": "잠시 후 다시 시도해주세요."
        }


def generate_recipes(settings: dict):
    """Generate recipes with progress feedback."""
    # Show expected time
    st.info("⏱️ 레시피 생성에는 약 10-20초가 소요됩니다.")

    # Progress tracking
    progress_bar = st.progress(0)
    status_text = st.empty()

    try:
        # Step 1: Preparation
        status_text.text("📦 재료 정보를 분석하고 있습니다...")
        progress_bar.progress(20)

        service = RecipeService()

        # Step 2: API Call
        status_text.text("🍳 AI가 맛있는 레시피를 고민하고 있습니다...")
        progress_bar.progress(50)

        recipes = service.generate_recipes(
            ingredients=st.session_state.recognized_ingredients,
            difficulty=settings["difficulty"],
            max_time=settings["max_time"],
            dietary=settings["dietary"],
            exclude=settings["exclude"],
        )

        # Step 3: Process results
        status_text.text("📋 레시피를 정리하고 있습니다...")
        progress_bar.progress(90)

        if recipes:
            st.session_state.generated_recipes = recipes
            progress_bar.progress(100)
            status_text.empty()
            progress_bar.empty()
            st.success(f"✅ {len(recipes)}개의 레시피를 찾았습니다!")
            st.balloons()
        else:
            progress_bar.empty()
            status_text.empty()
            st.warning("⚠️ 레시피를 찾지 못했습니다.")
            st.info("💡 재료를 더 추가하거나, 설정을 변경해보세요.")

    except ValueError as e:
        progress_bar.empty()
        status_text.empty()
        st.error("❌ 서비스 설정에 문제가 있습니다.")
        st.info("💡 관리자에게 문의해주세요.")
    except Exception as e:
        progress_bar.empty()
        status_text.empty()
        error_info = get_recipe_error_message(e)
        st.error(f"❌ {error_info['title']}")
        st.info(f"💡 {error_info['suggestion']}")


def main():
    """Main page function."""
    init_session_state()

    st.title("📖 레시피 생성")
    st.markdown("인식된 재료로 맛있는 레시피를 추천받으세요!")

    # Check API configuration
    if not Config.validate():
        st.error("❌ API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.")
        st.stop()

    st.divider()

    # Left column: Ingredients and Settings
    col_left, col_right = st.columns([1, 2])

    with col_left:
        has_ingredients = render_ingredient_section()

        if has_ingredients:
            st.divider()
            settings = render_settings()

            st.divider()

            col1, col2 = st.columns(2)
            with col1:
                if st.button("🍳 레시피 생성하기", type="primary", use_container_width=True):
                    generate_recipes(settings)

            with col2:
                if st.session_state.generated_recipes:
                    if st.button("🔄 다시 생성", use_container_width=True):
                        generate_recipes(settings)

    with col_right:
        if st.session_state.generated_recipes:
            st.markdown("### 🍽️ 추천 레시피")
            for idx, recipe in enumerate(st.session_state.generated_recipes):
                render_recipe_card(recipe, idx)
        elif has_ingredients:
            st.info("👈 왼쪽에서 설정을 선택하고 '레시피 생성하기' 버튼을 클릭하세요.")

    # Show saved recipes info in sidebar
    st.sidebar.markdown("---")
    if st.session_state.is_authenticated:
        st.sidebar.markdown(f"👤 로그인됨")
        if st.sidebar.button("💾 저장된 레시피 보기"):
            st.switch_page("pages/4_💾_저장된_레시피.py")
    else:
        if st.session_state.saved_recipes:
            st.sidebar.markdown(f"💾 임시 저장: **{len(st.session_state.saved_recipes)}개**")
            if st.sidebar.button("💾 임시 저장 보기"):
                st.switch_page("pages/4_💾_저장된_레시피.py")
        st.sidebar.info("로그인하면 레시피를 영구 저장할 수 있습니다.")
        if st.sidebar.button("👤 로그인하기"):
            st.switch_page("pages/3_👤_내_프로필.py")


if __name__ == "__main__":
    main()
