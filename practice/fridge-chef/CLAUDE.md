# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

AI-powered recipe recommendation service that recognizes ingredients from fridge photos and generates personalized recipes. Built as a Streamlit multi-page application with SQLite persistence, targeting Korean-speaking users. Currently at POC stage with Steps 1-3 completed.

> For comprehensive project metadata, see [`AGENTS.md`](AGENTS.md).

## Project Overview

**Fridge Chef** - 냉장고 재료 기반 레시피 추천 서비스

사용자가 냉장고 사진을 업로드하면 AI가 재료를 인식하고, 해당 재료로 만들 수 있는 레시피를 추천해주는 웹 애플리케이션.

## Project Status

POC (Proof of Concept) - **Step 1~3 구현 완료**

### Development Phases
- **Step 1**: 이미지 기반 재료 인식 (`PRD_step1.md`) ✅
- **Step 2**: AI 레시피 생성 (`PRD_step2.md`) ✅
- **Step 3**: 사용자 프로필 및 개인화 (`PRD_step3.md`) ✅

## Technical Stack

| Component | Technology |
|-----------|------------|
| Language | Python 3.14.2 |
| Package Manager | uv |
| Web Framework | Streamlit |
| Database | SQLite (POC) |
| ORM | SQLAlchemy 2.0 |
| AI API | OpenRouter |
| Authentication | bcrypt (cost factor 12) |
| Charts | Plotly |
| QR Code | qrcode[pil] |

### AI Models (via OpenRouter)

> See [`AGENTS.md` → Dependencies → AI Models](AGENTS.md#ai-models-via-openrouter) for model details.

## Build/Run Commands

```bash
# Install dependencies
uv sync

# Run application
uv run streamlit run app.py

# Run with specific port
uv run streamlit run app.py --server.port 8501

# Run tests
uv run pytest tests/ -v

# Initialize database
uv run python -c "from db.init_db import init_database; init_database()"
```

## Architecture Overview

```
fridge-chef/
├── app.py                    # Streamlit main entry point
├── pages/                    # Streamlit multi-page structure
│   ├── 1_🍳_재료_인식.py      # Step 1: Image → Ingredients
│   ├── 2_📖_레시피_생성.py    # Step 2: Ingredients → Recipes
│   ├── 3_👤_내_프로필.py      # Step 3: User profile & auth
│   ├── 4_💾_저장된_레시피.py  # Step 3: Saved recipes management
│   └── 5_📊_대시보드.py       # Step 3: Statistics dashboard
├── services/                 # Business logic
│   ├── config.py             # Configuration management
│   ├── api_utils.py          # API utilities (retry, error handling)
│   ├── vision.py             # OpenRouter vision API
│   ├── recipe.py             # Recipe generation
│   ├── auth.py               # Authentication (bcrypt)
│   ├── user.py               # User recipe management
│   ├── recommendation.py     # Personalization & stats
│   └── sharing.py            # Social sharing & QR
├── db/                       # Database layer
│   ├── database.py           # SQLite connection
│   ├── models.py             # SQLAlchemy models
│   └── init_db.py            # Schema initialization
├── utils/                    # Utilities
│   ├── charts.py             # Plotly chart helpers
│   ├── image.py              # Image processing
│   └── parser.py             # JSON parsing
├── components/               # Reusable Streamlit components
│   ├── recipe_card.py        # Recipe display card
│   ├── share_modal.py        # Share modal with QR/SNS
│   ├── stats_widgets.py      # Dashboard stat widgets
│   └── empty_state.py        # Empty state placeholders
├── models/                   # Data models
│   └── recipe.py             # Recipe dataclass
└── tests/                    # Test files (66 tests)
    ├── test_vision.py
    ├── test_recipe.py
    ├── test_auth.py
    ├── test_user.py
    ├── test_recommendation.py
    └── test_sharing.py
```

## Database Models

| Model | Description |
|-------|-------------|
| `User` | 사용자 계정 (username, password_hash, nickname, skill_level) |
| `UserPreferences` | 식이 제한, 알레르기, 선호 요리, 제외 재료 |
| `SavedRecipe` | 저장된 레시피 (recipe_data JSON, tags, notes, rating) |
| `CookingHistory` | 요리 기록 (recipe_name, ingredients_used, rating) |
| `IngredientUsage` | 재료 사용 통계 (ingredient_name, usage_count) |

## Environment Configuration

`.env` 파일 필수 설정:

```env
OPENROUTER_API_KEY=your_api_key_here
```

## Key Dependencies

> See [`AGENTS.md` → Dependencies](AGENTS.md#dependencies) for the full dependency list with version constraints.

## Testing

```bash
# Run all tests
uv run pytest tests/ -v

# Run specific test file
uv run pytest tests/test_auth.py -v
```

> 66 tests across 6 files. See [`tests/AGENTS.md`](tests/AGENTS.md) for per-file breakdown.

## Session State Keys

> See [`AGENTS.md` → Session State Keys`](AGENTS.md#session-state-keys-cross-page-communication) for the full cross-page communication table.

## API Response Formats

### Vision API (재료 인식)
Prompt expects bullet-point list of ingredients in Korean.

### Recipe API (레시피 생성)
Response must be valid JSON with structure:
```json
{
  "recipes": [
    {
      "name": "string",
      "description": "string",
      "difficulty": "쉬움|보통|어려움",
      "cooking_time": number,
      "servings": number,
      "ingredients": { "available": [], "additional_needed": [] },
      "instructions": [],
      "tips": []
    }
  ]
}
```

## Key Features by Step

### Step 1: 재료 인식
- 이미지 업로드 (jpg, png, webp)
- OpenRouter Vision API로 재료 인식
- 재료 목록 편집 (추가/삭제)

### Step 2: 레시피 생성
- 인식된 재료 기반 레시피 추천
- 난이도, 요리 시간, 인분 수 표시
- 로그인 시 레시피 저장 가능

### Step 3: 사용자 프로필 & 개인화
- 회원가입/로그인 (bcrypt 해싱)
- 프로필 설정 (닉네임, 요리 실력)
- 식이 제한, 알레르기, 선호 요리 설정
- 레시피 저장, 태그, 메모, 평점
- 대시보드 (요리 통계, 캘린더 히트맵)
- 공유 기능 (URL, QR 코드, SNS)

## Cross References

| Document | Scope |
|----------|-------|
| [`AGENTS.md`](AGENTS.md) | Root project metadata, dependencies, session state, architecture flow |
| [`services/AGENTS.md`](services/AGENTS.md) | Business logic layer: API integrations, auth, recommendations |
| [`db/AGENTS.md`](db/AGENTS.md) | Database layer: models, connection management, schema |
| [`components/AGENTS.md`](components/AGENTS.md) | Reusable Streamlit UI components |
| [`utils/AGENTS.md`](utils/AGENTS.md) | Utility modules: image processing, JSON parsing, charts |
| [`pages/AGENTS.md`](pages/AGENTS.md) | Streamlit multi-page structure (5 pages) |
| [`models/AGENTS.md`](models/AGENTS.md) | Data transfer objects |
| [`tests/AGENTS.md`](tests/AGENTS.md) | Test suite: 66 tests across 6 files |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Project documentation and reports |

## Code Style Guidelines

- 사용자 문서 및 UI 텍스트: 한국어
- 코드 주석 및 개발 문서: 영어
- Type hints 사용 권장
- Docstrings in English