# Fridge Chef Step 2 구현 작업 보고서

**작성일**: 2025-12-26
**작업자**: Claude Code (Opus 4.5)

---

## 1. 작업 개요

### 1.1 작업 목표
Fridge Chef 프로젝트의 Step 2 "AI 레시피 생성" 기능 구현

### 1.2 작업 범위
- 재료 기반 레시피 생성 AI 연동
- 요리 설정 옵션 (난이도, 시간, 식이제한)
- 레시피 카드 UI 컴포넌트
- Step 1과의 세션 상태 연동

> **후속 구현 메모**: 현재 구현에서는 비로그인 사용자가 저장한 레시피를 `st.session_state.saved_recipes`에 `list[dict]` 형태로 임시 저장하고, 로그인 시 계정으로 이관합니다.

---

## 2. 사용된 도구 (Tools)

### 2.1 파일 작업 도구

| Tool | 용도 | 사용 횟수 |
|------|------|-----------|
| **Read** | PRD 및 기존 코드 분석 | 다수 |
| **Write** | 새 파일 생성 | 4+ |
| **Edit** | 기존 파일 수정 | 5+ |
| **Glob** | 파일 패턴 검색 | 일부 |

### 2.2 실행 도구

| Tool | 용도 | 주요 명령어 |
|------|------|-------------|
| **Bash** | 테스트 실행 | `uv run pytest tests/ -v` |

---

## 3. 작업 과정

### Phase 1: 요구사항 분석
1. `PRD_step2.md` 파일 읽기
2. Step 1에서 전달되는 재료 데이터 구조 확인
3. 레시피 출력 JSON 스키마 설계

### Phase 2: Recipe 서비스 구현

**services/recipe.py 주요 구성요소**:

```python
class RecipeService:
    """OpenRouter API를 통한 레시피 생성 서비스"""

    MODEL = "nex-agi/deepseek-v3.1-nex-n1"
    API_URL = "https://openrouter.ai/api/v1/chat/completions"

    def generate_recipes(
        self,
        ingredients: list[str],
        settings: dict | None = None,
    ) -> list[dict]:
        """재료 목록으로 레시피 생성"""
```

**레시피 생성 설정 옵션**:
```python
settings = {
    "difficulty": "쉬움" | "보통" | "어려움",
    "max_cooking_time": 30,  # 분 단위
    "dietary_restrictions": ["채식", "저염식", ...],
    "recipe_count": 3,  # 생성할 레시피 수
}
```

### Phase 3: 프롬프트 엔지니어링

**시스템 프롬프트**:
```
당신은 전문 요리사입니다. 주어진 재료로 만들 수 있는 맛있는 레시피를 추천해주세요.
반드시 아래 JSON 형식으로만 응답해주세요.
```

**JSON 출력 스키마**:
```json
{
  "recipes": [
    {
      "name": "레시피 이름",
      "difficulty": "쉬움|보통|어려움",
      "cooking_time": 30,
      "servings": 2,
      "ingredients": {
        "available": ["재료1", "재료2"],
        "additional_needed": ["추가 재료1"]
      },
      "instructions": [
        "1. 첫 번째 단계",
        "2. 두 번째 단계"
      ],
      "tips": ["요리 팁1", "요리 팁2"]
    }
  ]
}
```

### Phase 4: UI 페이지 구현

**pages/2_📖_레시피_생성.py 주요 기능**:

1. **요리 설정 사이드바**:
   ```python
   with st.sidebar:
       difficulty = st.select_slider("난이도", ["쉬움", "보통", "어려움"])
       max_time = st.slider("최대 조리 시간", 10, 120, 30)
       dietary = st.multiselect("식이 제한", ["채식", "비건", "저염식", ...])
   ```

2. **레시피 생성 흐름**:
   ```python
   if st.button("🍳 레시피 생성"):
       ingredients = st.session_state.recognized_ingredients
       settings = {"difficulty": difficulty, "max_cooking_time": max_time, ...}
       recipes = recipe_service.generate_recipes(ingredients, settings)
       st.session_state.generated_recipes = recipes
   ```

3. **레시피 카드 표시**:
   - 레시피 이름 및 기본 정보
   - 필요 재료 (보유/추가 구매 구분)
   - 조리 단계 (순서대로 표시)
   - 요리 팁

### Phase 5: 레시피 카드 컴포넌트

**components/recipe_card.py**:
```python
def render_recipe_card(recipe: dict, key_prefix: str = "") -> None:
    """레시피 카드 UI 렌더링"""
    with st.container():
        st.subheader(f"🍽️ {recipe['name']}")

        # 메타 정보
        cols = st.columns(3)
        cols[0].metric("난이도", recipe["difficulty"])
        cols[1].metric("조리 시간", f"{recipe['cooking_time']}분")
        cols[2].metric("인분", f"{recipe['servings']}인분")

        # 재료 표시
        st.markdown("**📦 필요 재료**")
        # ... 보유 재료 / 추가 재료 구분 표시

        # 조리 단계
        st.markdown("**👨‍🍳 조리 순서**")
        for i, step in enumerate(recipe["instructions"], 1):
            st.markdown(f"{i}. {step}")
```

---

## 4. 기술적 결정 사항

### 4.1 Text 모델 선택
- **선택**: `nex-agi/deepseek-v3.1-nex-n1`
- **이유**: 무료 API, 한국어 레시피 생성 품질 우수, JSON 출력 안정적

### 4.2 JSON 출력 보장
- **Few-shot 예제**: 프롬프트에 예시 JSON 포함
- **JSON 파싱 에러 처리**: 마크다운 코드 블록 제거 후 파싱
- **Fallback**: 파싱 실패 시 빈 레시피 목록 반환

### 4.3 재료 매칭 로직
```python
def categorize_ingredients(recipe_ingredients: list, available: list) -> dict:
    """보유 재료와 추가 필요 재료 분류"""
    available_set = set(i.lower() for i in available)
    return {
        "available": [i for i in recipe_ingredients if i.lower() in available_set],
        "additional_needed": [i for i in recipe_ingredients if i.lower() not in available_set]
    }
```

---

## 5. 생성된 파일 목록

| 디렉토리 | 파일 | 설명 |
|----------|------|------|
| `pages/` | `2_📖_레시피_생성.py` | 레시피 생성 페이지 |
| `services/` | `recipe.py` | Recipe 생성 서비스 |
| `components/` | `recipe_card.py` | 레시피 카드 컴포넌트 |

---

## 6. 수정된 파일 목록

| 파일 | 수정 내용 |
|------|-----------|
| `pyproject.toml` | 추가 의존성 확인 |
| `app.py` | 메인 페이지 네비게이션 업데이트 |

---

## 7. API 연동 상세

### 7.1 OpenRouter API 구조

**Request**:
```json
{
  "model": "nex-agi/deepseek-v3.1-nex-n1",
  "messages": [
    {"role": "system", "content": "시스템 프롬프트"},
    {"role": "user", "content": "재료: 당근, 양파, 대파\n설정: 난이도 쉬움, 30분 이내"}
  ],
  "response_format": {"type": "json_object"}
}
```

**Response 처리**:
```python
response_text = response["choices"][0]["message"]["content"]
# 마크다운 코드 블록 제거
if "```json" in response_text:
    response_text = response_text.split("```json")[1].split("```")[0]
recipes = json.loads(response_text)["recipes"]
```

### 7.2 에러 처리
- JSON 파싱 실패 시 로그 기록 및 빈 결과 반환
- API 타임아웃 시 재시도 안내
- 재료 부족 시 추가 재료 구매 안내

---

## 8. UI/UX 설계

### 8.1 페이지 레이아웃
```
┌─────────────────────────────────────────────────────────┐
│  📖 레시피 생성                                          │
├───────────────┬─────────────────────────────────────────┤
│  [사이드바]    │  ┌─────────────────────────────────────┐ │
│               │  │ 📦 선택된 재료: 당근, 양파, 대파     │ │
│  난이도:      │  ├─────────────────────────────────────┤ │
│  [쉬움]       │  │        [🍳 레시피 생성]              │ │
│               │  ├─────────────────────────────────────┤ │
│  조리시간:    │  │ ┌─────────────────────────────────┐ │ │
│  [30분]       │  │ │ 🍽️ 당근 볶음                    │ │ │
│               │  │ │ 난이도: 쉬움 | 시간: 15분        │ │ │
│  식이 제한:   │  │ │ 재료: 당근, 양파...              │ │ │
│  [ ] 채식     │  │ │ 1. 당근을 채 썬다               │ │ │
│  [ ] 저염     │  │ │ 2. 팬에 기름을 두른다           │ │ │
│               │  │ └─────────────────────────────────┘ │ │
└───────────────┴─────────────────────────────────────────┘
```

### 8.2 사용자 흐름
1. Step 1에서 재료 목록 확인
2. 사이드바에서 요리 설정 조정
3. "레시피 생성" 버튼 클릭
4. AI가 생성한 레시피 카드 확인
5. 원하는 레시피 선택 및 저장 (Step 3)

---

## 9. 세션 상태 연동

### 9.1 Step 1 → Step 2 데이터 흐름
```python
# Step 1에서 설정
st.session_state.recognized_ingredients = ["당근", "양파", "대파"]

# Step 2에서 사용
ingredients = st.session_state.get("recognized_ingredients", [])
if not ingredients:
    st.warning("먼저 재료 인식을 진행해주세요.")
    st.page_link("pages/1_🍳_재료_인식.py", label="재료 인식으로 이동")
```

### 9.2 Step 2 → Step 3 데이터 흐름
```python
# Step 2에서 설정
st.session_state.generated_recipes = recipes

# Step 3에서 저장 시 사용
recipe_to_save = st.session_state.generated_recipes[selected_index]
```

---

## 10. 테스트 케이스

```python
# tests/test_recipe.py
class TestRecipeService:
    def test_generate_recipes_basic(self):
        """기본 레시피 생성 테스트"""

    def test_generate_recipes_with_settings(self):
        """설정 옵션 적용 테스트"""

    def test_json_parsing_robustness(self):
        """JSON 파싱 에러 처리 테스트"""

    def test_empty_ingredients(self):
        """빈 재료 목록 처리 테스트"""
```

---

## 11. 향후 개선 사항

1. **레시피 품질 향상**: 더 상세한 프롬프트 엔지니어링
2. **영양 정보 추가**: 칼로리, 영양소 계산 기능
3. **레시피 필터링**: 알레르기, 선호도 기반 필터
4. **요리 타이머**: 각 단계별 타이머 기능
5. **재료 대체 추천**: 없는 재료의 대체품 추천
6. **레시피 평점**: 사용자 평가 기반 품질 개선

---

*본 보고서는 Claude Code (Opus 4.5)에 의해 자동 생성되었습니다.*
