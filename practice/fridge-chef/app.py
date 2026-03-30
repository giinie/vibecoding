"""Fridge Chef - 냉장고 재료 기반 AI 레시피 추천 서비스

Main application entry point.
- Database initialization happens here (singleton pattern)
- Centralized session state management
"""
import streamlit as st

# Initialize database on app startup (singleton - only runs once)
from components.recipe_card import render_recipe_card
from db.init_db import init_database
from services.sharing import SharingService
init_database()

st.set_page_config(
    page_title="Fridge Chef",
    page_icon="🍳",
    layout="wide",
    initial_sidebar_state="expanded",
)


# Session state keys with default values for centralized management
SESSION_STATE_DEFAULTS = {
    "recognized_ingredients": [],
    "uploaded_image": None,
    "generated_recipes": [],
    "saved_recipes": [],
    "user_id": None,
    "is_authenticated": False,
    "username": None,
    "share_recipe_id": None,
}


def init_session_state():
    """Initialize session state variables with defaults.

    Uses centralized defaults dict for consistency across pages.
    """
    for key, default_value in SESSION_STATE_DEFAULTS.items():
        if key not in st.session_state:
            st.session_state[key] = default_value


def _get_query_value(key: str) -> str | None:
    """Safely read a single query-param value from Streamlit."""
    value = st.query_params.get(key)
    if isinstance(value, list):
        return value[0] if value else None
    return value


def render_shared_recipe_page(share_id: str) -> None:
    """Render a shared recipe entrypoint from a query parameter."""
    st.title("📤 공유된 레시피")
    shared_recipe = SharingService.get_shared_recipe(share_id)

    if not shared_recipe:
        st.error("공유 링크가 유효하지 않거나 더 이상 사용할 수 없습니다.")
    else:
        st.success("공유된 레시피를 불러왔습니다.")
        render_recipe_card(
            recipe_data=shared_recipe,
            show_actions=False,
            key_prefix=f"shared_{share_id}",
        )

    if st.button("🏠 메인으로 돌아가기"):
        st.query_params.clear()
        st.rerun()


def main():
    """Main application entry point."""
    init_session_state()

    share_id = _get_query_value("share_id")
    if share_id:
        render_shared_recipe_page(share_id)
        return

    st.title("🍳 Fridge Chef")
    st.subheader("냉장고 재료로 만드는 맞춤 레시피")

    st.markdown("""
    ### 사용 방법
    1. **재료 인식**: 냉장고 사진을 업로드하면 AI가 재료를 인식합니다
    2. **레시피 생성**: 인식된 재료로 맞춤 레시피를 추천받습니다
    3. **내 프로필**: 좋아하는 레시피를 저장하고 관리합니다

    ---

    왼쪽 사이드바에서 시작하세요!
    """)

    # Quick status
    if st.session_state.recognized_ingredients:
        st.success(f"인식된 재료: {len(st.session_state.recognized_ingredients)}개")
        st.write(", ".join(st.session_state.recognized_ingredients[:5]))
        if len(st.session_state.recognized_ingredients) > 5:
            st.write(f"... 외 {len(st.session_state.recognized_ingredients) - 5}개")


if __name__ == "__main__":
    main()
