# Fridge Chef — Product Requirements Document

## System Overview

**Fridge Chef**는 냉장고 사진을 업로드하면 AI가 재료를 인식하고, 해당 재료로 만들 수 있는 맞춤형 레시피를 추천하는 한국어 웹 애플리케이션이다. Streamlit 기반 멀티페이지 앱으로 구동되며, SQLite에 사용자 데이터를 영속화하고 OpenRouter API를 통해 Vision(이미지 인식)과 Text(레시피 생성) AI 모델을 호출한다.

비로그인(게스트) 상태에서도 재료 인식과 레시피 생성이 가능하며, 로그인 시 레시피 저장, 평점, 태그/메모, 요리 기록, 통계 대시보드, 공유(QR/SNS) 등 개인화 기능이 활성화된다.

**주요 사용자**: 한국어를 사용하는 가정 요리인. 냉장고에 있는 재료를 활용해 무엇을 만들지 고민하는 상황에서 빠르게 레시피를 얻고 싶어 하는 사람.

## Module Overview

| Module | Pages | Core Functionality |
|--------|-------|--------------------|
| 홈 | 메인 페이지 | 서비스 소개, 공유 레시피 진입, 인식 재료 요약 |
| 재료 인식 | 1페이지 | 이미지 업로드/카메라 촬영 → AI 재료 인식 → 재료 편집 |
| 레시피 생성 | 2페이지 | 인식된 재료 기반 AI 레시피 3개 생성, 설정 필터, 레시피 카드 표시 |
| 사용자 프로필 | 3페이지 | 회원가입/로그인, 프로필 설정, 식이 제한/알레르기/선호 요리 |
| 저장된 레시피 | 4페이지 | 레시피 목록 조회/검색/필터, 평점, 태그/메모 편집, 공유, 요리 완료 기록 |
| 대시보드 | 5페이지 | 요리 통계, 캘린더 히트맵, 재료 사용 TOP10, 요리 카테고리 분포, 맞춤 추천 |

## Page Inventory

| # | Page Name | Route | Module | Doc Link |
|---|-----------|-------|--------|----------|
| 0 | 홈 (Home) | `/` | 홈 | [→](./pages/00-home.md) |
| 1 | 재료 인식 | `/재료_인식` | 재료 인식 | [→](./pages/01-ingredient-recognition.md) |
| 2 | 레시피 생성 | `/레시피_생성` | 레시피 생성 | [→](./pages/02-recipe-generation.md) |
| 3 | 내 프로필 | `/내_프로필` | 사용자 프로필 | [→](./pages/03-user-profile.md) |
| 4 | 저장된 레시피 | `/저장된_레시피` | 저장된 레시피 | [→](./pages/04-saved-recipes.md) |
| 5 | 대시보드 | `/대시보드` | 대시보드 | [→](./pages/05-dashboard.md) |
| S | 공유 레시피 | `/?share_id=xxx` | 공유 | [→](./pages/00-home.md#shared-recipe) |

## Global Notes

### Authentication Model

- **게스트 모드**: 로그인 없이 재료 인식, 레시피 생성 가능. 레시피 저장은 브라우저 세션(session state)에만 유지.
- **로그인 모드**: bcrypt 해시 기반 인증. 레시피 DB 영속 저장, 요리 기록, 통계, 공유 기능 활성화.
- **게스트→로그인 전환**: 로그인 시 세션에 임시 저장된 레시피를 자동으로 계정에 가져옴(중복 제외).

### Common Interaction Patterns

- 모든 API 호출은 `@retry_with_backoff` 데코레이터(최대 3회, 지수 백오프)로 보호됨.
- API 키 미설정 시 페이지 진입 즉시 에러 메시지 표시 후 `st.stop()`.
- 에러 메시지는 사용자 친화적 한국어로 변환(네트워크/타임아웃/레이트리밋/API키 에러 구분).
- 레시피 생성 요청 시 진행 바 + 상태 텍스트로 진행 상황 표시.
- Streamlit `st.switch_page()`로 페이지 간 이동.

### Cross-Page Data Flow

- **recognized_ingredients**: Page 1에서 설정 → Page 2에서 소비
- **generated_recipes**: Page 2에서 생성 → Page 2, 4에서 표시
- **saved_recipes**: Page 2(게스트 저장), Page 3(로그인 시 가져오기) → Page 2, 3, 4에서 표시
- **user_id / is_authenticated / username**: Page 3에서 설정 → 모든 페이지에서 참조
- **share_recipe_id**: Page 4에서 설정 → Page 4 공유 모달 표시 제어
- **post_login_notice**: Page 3 로그인 완료 시 설정 → Page 3에서 1회 표시 후 제거

### API Configuration

- **OpenRouter Vision Model**: `nvidia/nemotron-nano-12b-v2-vl:free` — 이미지→재료 인식
- **OpenRouter Text Model**: `nex-agi/deepseek-v3.1-nex-n1` — 재료→레시피 생성
- **Base URL**: `https://openrouter.ai/api/v1/chat/completions`
- **Timeout**: 60초
- **이미지 제한**: 최대 10MB, JPG/PNG/WebP