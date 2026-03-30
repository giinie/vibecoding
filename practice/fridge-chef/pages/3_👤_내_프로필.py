"""사용자 프로필 페이지 - User profile management."""
import streamlit as st
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.init_db import init_database
from services.auth import AuthService
from services.user import UserRecipeService
from utils.session_recipes import deduplicate_saved_recipes

st.set_page_config(
    page_title="내 프로필 - Fridge Chef",
    page_icon="👤",
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
    if "username" not in st.session_state:
        st.session_state.username = None
    if "saved_recipes" not in st.session_state:
        st.session_state.saved_recipes = []
    if "post_login_notice" not in st.session_state:
        st.session_state.post_login_notice = None


def import_guest_saved_recipes(user_id: int) -> tuple[int, int]:
    """Persist guest-saved recipes into the logged-in user's account."""
    guest_recipes = deduplicate_saved_recipes(st.session_state.get("saved_recipes"))
    if not guest_recipes:
        return 0, 0

    service = UserRecipeService(user_id)
    imported_count = 0
    for recipe_data in guest_recipes:
        if service.has_recipe(recipe_data):
            continue
        service.save_recipe(recipe_data)
        imported_count += 1

    st.session_state.saved_recipes = []
    return imported_count, len(guest_recipes)


def render_login_form():
    """Render login form."""
    st.markdown("### 🔐 로그인")

    with st.form("login_form"):
        username = st.text_input("아이디", placeholder="사용자명 입력")
        password = st.text_input("비밀번호", type="password", placeholder="비밀번호 입력")
        submitted = st.form_submit_button("로그인", type="primary", use_container_width=True)

        if submitted:
            if not username or not password:
                st.error("아이디와 비밀번호를 입력해주세요.")
            else:
                user = AuthService.login(username, password)
                if user:
                    st.session_state.user_id = user.id
                    st.session_state.is_authenticated = True
                    st.session_state.username = user.username
                    imported_count, guest_recipe_count = import_guest_saved_recipes(user.id)
                    if imported_count:
                        st.session_state.post_login_notice = (
                            f"임시 저장한 레시피 {imported_count}개를 계정에 저장했습니다."
                        )
                    elif guest_recipe_count:
                        st.session_state.post_login_notice = (
                            "임시 저장 레시피는 이미 계정에 있거나 모두 정리되어 추가 저장하지 않았습니다."
                        )
                    st.success("로그인 성공!")
                    st.rerun()
                else:
                    st.error("아이디 또는 비밀번호가 올바르지 않습니다.")


def calculate_password_strength(password: str) -> str:
    """Calculate password strength."""
    if len(password) < 4:
        return "weak"

    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in "!@#$%^&*()_+-=[]{}|;:',.<>?" for c in password)

    score = sum([has_upper, has_lower, has_digit, has_special])

    if len(password) >= 8 and score >= 3:
        return "strong"
    elif len(password) >= 6 and score >= 2:
        return "medium"
    return "weak"


def render_register_form():
    """Render registration form with real-time validation."""
    st.markdown("### 📝 회원가입")

    # Real-time validation (without form wrapper)
    username = st.text_input(
        "아이디",
        placeholder="4자 이상의 영문/숫자",
        key="reg_username"
    )

    # Username validation
    username_valid = False
    if username:
        if len(username) < 4:
            st.warning("⚠️ 아이디는 4자 이상이어야 합니다.")
        elif not username.replace("_", "").isalnum():
            st.warning("⚠️ 아이디는 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.")
        else:
            st.success("✅ 사용 가능한 아이디 형식입니다.")
            username_valid = True

    nickname = st.text_input(
        "닉네임",
        placeholder="표시될 이름",
        key="reg_nickname"
    )

    password = st.text_input(
        "비밀번호",
        type="password",
        placeholder="4자 이상 (8자 이상 권장)",
        key="reg_password"
    )

    # Password strength indicator
    password_valid = False
    if password:
        strength = calculate_password_strength(password)
        if strength == "weak":
            st.warning("⚠️ 비밀번호가 너무 약합니다. 4자 이상 입력해주세요.")
        elif strength == "medium":
            st.info("💡 보통 강도의 비밀번호입니다. 특수문자를 추가하면 더 안전합니다.")
            password_valid = True
        else:
            st.success("✅ 안전한 비밀번호입니다.")
            password_valid = True

    password_confirm = st.text_input(
        "비밀번호 확인",
        type="password",
        placeholder="비밀번호 재입력",
        key="reg_password_confirm"
    )

    # Password match check
    passwords_match = False
    if password_confirm:
        if password != password_confirm:
            st.error("❌ 비밀번호가 일치하지 않습니다.")
        else:
            st.success("✅ 비밀번호가 일치합니다.")
            passwords_match = True

    # Submit button (enabled only when all validations pass)
    can_submit = username_valid and password_valid and passwords_match

    st.markdown("")  # Spacing

    if st.button(
        "회원가입",
        type="primary",
        use_container_width=True,
        disabled=not can_submit
    ):
        user = AuthService.register(username, password, nickname)
        if user:
            st.success("🎉 회원가입이 완료되었습니다! 로그인해주세요.")
            st.balloons()
        else:
            st.error("❌ 이미 사용 중인 아이디입니다. 다른 아이디를 선택해주세요.")

    if not can_submit and (username or password or password_confirm):
        st.caption("💡 모든 항목을 올바르게 입력하면 회원가입 버튼이 활성화됩니다.")


def render_profile_settings():
    """Render profile settings for logged-in user."""
    user = AuthService.get_user_by_id(st.session_state.user_id)
    prefs = AuthService.get_preferences(st.session_state.user_id)

    if not user:
        st.error("사용자 정보를 찾을 수 없습니다.")
        return

    st.markdown(f"### 👤 {user.nickname}님, 안녕하세요!")
    st.caption(f"요리 레벨: {get_skill_label(user.skill_level)}")

    st.divider()

    st.markdown("### ⚙️ 프로필 설정")

    # Basic Info
    with st.form("profile_form"):
        col1, col2 = st.columns(2)

        with col1:
            nickname = st.text_input("닉네임", value=user.nickname or "")

        with col2:
            skill_options = ["초보", "중급", "고급"]
            skill_map = {"beginner": "초보", "intermediate": "중급", "advanced": "고급"}
            reverse_skill_map = {"초보": "beginner", "중급": "intermediate", "고급": "advanced"}
            current_skill = skill_map.get(user.skill_level, "초보")
            skill_level = st.selectbox(
                "요리 실력",
                options=skill_options,
                index=skill_options.index(current_skill)
            )

        st.markdown("**식이 제한**")
        dietary_options = ["채식", "저염식", "저당", "글루텐프리", "할랄", "코셔"]
        current_dietary = prefs.get("dietary_preferences", [])
        dietary = []
        cols = st.columns(len(dietary_options))
        for i, option in enumerate(dietary_options):
            with cols[i]:
                if st.checkbox(option, value=option in current_dietary, key=f"diet_{option}"):
                    dietary.append(option)

        st.markdown("**알레르기**")
        allergies_str = st.text_input(
            "알레르기 재료 (쉼표로 구분)",
            value=", ".join(prefs.get("allergies", [])),
            placeholder="예: 땅콩, 갑각류, 계란"
        )
        allergies = [a.strip() for a in allergies_str.split(",") if a.strip()]

        st.markdown("**선호 요리**")
        cuisine_options = ["한식", "일식", "중식", "양식", "동남아", "인도", "멕시코"]
        current_cuisines = prefs.get("favorite_cuisines", [])
        cuisines = []
        cols = st.columns(len(cuisine_options))
        for i, option in enumerate(cuisine_options):
            with cols[i]:
                if st.checkbox(option, value=option in current_cuisines, key=f"cuisine_{option}"):
                    cuisines.append(option)

        st.markdown("**제외할 재료**")
        excluded_str = st.text_input(
            "제외할 재료 (쉼표로 구분)",
            value=", ".join(prefs.get("excluded_ingredients", [])),
            placeholder="예: 고수, 파"
        )
        excluded = [e.strip() for e in excluded_str.split(",") if e.strip()]

        submitted = st.form_submit_button("💾 저장하기", type="primary", use_container_width=True)

        if submitted:
            # Update profile
            AuthService.update_profile(
                st.session_state.user_id,
                nickname=nickname,
                skill_level=reverse_skill_map[skill_level]
            )
            # Update preferences
            AuthService.update_preferences(
                st.session_state.user_id,
                dietary_preferences=dietary,
                allergies=allergies,
                favorite_cuisines=cuisines,
                excluded_ingredients=excluded
            )
            st.success("프로필이 저장되었습니다!")

    st.divider()

    # Logout button
    col1, col2, col3 = st.columns([1, 1, 1])
    with col2:
        if st.button("🚪 로그아웃", use_container_width=True):
            st.session_state.user_id = None
            st.session_state.is_authenticated = False
            st.session_state.username = None
            st.rerun()


def get_skill_label(skill_level: str) -> str:
    """Get Korean label for skill level."""
    labels = {
        "beginner": "초보 🌱",
        "intermediate": "중급 🍳",
        "advanced": "고급 👨‍🍳",
    }
    return labels.get(skill_level, "초보 🌱")


def main():
    """Main page function."""
    init_session_state()

    st.title("👤 내 프로필")

    if st.session_state.post_login_notice:
        st.success(st.session_state.post_login_notice)
        st.session_state.post_login_notice = None

    if st.session_state.is_authenticated:
        render_profile_settings()
    else:
        st.markdown("로그인하여 레시피를 저장하고 개인화된 추천을 받아보세요!")

        tab1, tab2 = st.tabs(["로그인", "회원가입"])

        with tab1:
            render_login_form()

        with tab2:
            render_register_form()

        st.divider()

        st.info("💡 게스트 모드로도 재료 인식과 레시피 생성을 이용할 수 있습니다.")


if __name__ == "__main__":
    main()
