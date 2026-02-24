# Fridge Chef

냉장고 재료 기반 AI 레시피 추천 서비스

사용자가 냉장고 사진을 업로드하면 AI가 재료를 인식하고, 해당 재료로 만들 수 있는 맛있는 레시피를 추천해줍니다.

## 주요 기능

| 단계 | 기능 | 설명 |
|------|------|------|
| Step 1 | 재료 인식 | 냉장고 사진에서 AI가 재료를 자동 인식 |
| Step 2 | 레시피 생성 | 인식된 재료로 맞춤 레시피 추천 |
| Step 3 | 개인화 | 사용자 프로필, 레시피 저장, 통계 대시보드 |

## 기술 스택

- **Language**: Python 3.14.2
- **Package Manager**: uv
- **Web Framework**: Streamlit
- **Database**: SQLite + SQLAlchemy 2.0
- **AI API**: OpenRouter (Vision + Text 모델)

## 빠른 시작

### 1. 환경 설정

```bash
# 저장소 클론
git clone <repository-url>
cd fridge-chef

# 의존성 설치
uv sync
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 OpenRouter API 키를 설정하세요:

```env
OPENROUTER_API_KEY=your_api_key_here
```

> OpenRouter API 키는 [openrouter.ai](https://openrouter.ai/)에서 발급받을 수 있습니다.

### 3. 데이터베이스 초기화

```bash
uv run python -c "from db.init_db import init_database; init_database()"
```

### 4. 애플리케이션 실행

```bash
uv run streamlit run app.py
```

브라우저에서 `http://localhost:8501`로 접속하세요.

## 프로젝트 구조

```
fridge-chef/
├── app.py                      # Streamlit 메인 엔트리
├── pages/                      # Streamlit 멀티페이지
│   ├── 1_🍳_재료_인식.py        # Step 1: 이미지 → 재료
│   ├── 2_📖_레시피_생성.py      # Step 2: 재료 → 레시피
│   ├── 3_👤_내_프로필.py        # Step 3: 사용자 프로필
│   ├── 4_💾_저장된_레시피.py    # Step 3: 레시피 관리
│   └── 5_📊_대시보드.py         # Step 3: 통계 대시보드
├── services/                   # 비즈니스 로직
│   ├── vision.py               # OpenRouter Vision API
│   ├── recipe.py               # 레시피 생성 서비스
│   ├── auth.py                 # 인증 서비스
│   ├── user.py                 # 사용자 서비스
│   ├── recommendation.py       # 추천 엔진
│   └── sharing.py              # 공유 기능
├── db/                         # 데이터베이스 레이어
│   ├── database.py             # SQLite 연결
│   ├── models.py               # SQLAlchemy 모델
│   └── init_db.py              # 스키마 초기화
├── components/                 # UI 컴포넌트
│   ├── recipe_card.py          # 레시피 카드
│   ├── share_modal.py          # 공유 모달
│   └── stats_widgets.py        # 통계 위젯
├── utils/                      # 유틸리티
│   ├── charts.py               # Plotly 차트 헬퍼
│   ├── image.py                # PIL 이미지 검증/압축
│   └── parser.py               # 레시피 API 응답 JSON 파싱
├── tests/                      # 테스트
│   ├── test_auth.py            # 인증 테스트
│   ├── test_user.py            # 사용자 테스트
│   ├── test_recipe.py          # 레시피 테스트
│   ├── test_vision.py          # 비전 테스트
│   ├── test_recommendation.py  # 추천 테스트
│   └── test_sharing.py         # 공유 테스트
├── PRD_step1.md                # Step 1 요구사항
├── PRD_step2.md                # Step 2 요구사항
├── PRD_step3.md                # Step 3 요구사항
└── docs/                       # 문서
    └── WORK_REPORT*.md         # 작업 보고서
```

## 개발 가이드

### 테스트 실행

```bash
# 전체 테스트
uv run pytest tests/ -v

# 특정 테스트 파일
uv run pytest tests/test_auth.py -v

# 커버리지 포함
uv run pytest tests/ -v --cov=services
```

### 코드 스타일

- **UI 텍스트**: 한국어
- **코드 주석**: 영어
- **Type hints**: 권장
- **Docstrings**: 영어

### 세션 상태 키

Streamlit 세션 상태에서 사용되는 주요 키:

| Key | Type | Description |
|-----|------|-------------|
| `recognized_ingredients` | `list[str]` | 인식된 재료 목록 |
| `uploaded_image` | `bytes` | 업로드된 이미지 |
| `generated_recipes` | `list[dict]` | 생성된 레시피 |
| `saved_recipes` | `list[dict]` | 저장된 레시피 목록 |
| `user_id` | `int` | 로그인된 사용자 ID |
| `is_authenticated` | `bool` | 로그인 상태 |
| `username` | `str` | 로그인된 사용자 이름 |
| `share_recipe_id` | `int` | 공유 대상 레시피 ID |

### 데이터베이스 모델

```python
# 주요 모델
User              # 사용자 계정
UserPreferences   # 식이 선호도
SavedRecipe       # 저장된 레시피
CookingHistory    # 요리 기록
IngredientUsage   # 재료 사용 통계
```

## API 사용량

OpenRouter 무료 모델 사용:

| 용도 | 모델 |
|------|------|
| 이미지 인식 | `nvidia/nemotron-nano-12b-v2-vl:free` |
| 레시피 생성 | `nex-agi/deepseek-v3.1-nex-n1:free` |

## 문제 해결

### 일반적인 문제

**Q: API 키 오류가 발생합니다**
```
A: .env 파일에 OPENROUTER_API_KEY가 올바르게 설정되었는지 확인하세요.
```

**Q: 데이터베이스 오류가 발생합니다**
```bash
# 데이터베이스 재초기화
rm fridge_chef.db
uv run python -c "from db.init_db import init_database; init_database()"
```

**Q: 재료가 인식되지 않습니다**
```
A: 이미지가 선명한지 확인하고, 재료가 잘 보이도록 촬영해주세요.
   수동으로 재료를 추가할 수도 있습니다.
```

### 포트 충돌

기본 포트(8501)가 사용 중인 경우:

```bash
uv run streamlit run app.py --server.port 8502
```

## 기여 가이드

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 라이선스

This project is licensed under the MIT License.

## 연락처

프로젝트 관련 문의사항은 이슈를 통해 남겨주세요.

---

**개발 현황**: Step 1, 2, 3 완료 (POC 단계)
**테스트 커버리지**: 69 tests passing
