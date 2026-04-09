# 홈 (Home)

> **Route:** `/`
> **Module:** 홈
> **Generated:** 2026-04-08

## Overview

애플리케이션의 랜딩 페이지. 서비스 소개, 사용 방법 안내, 현재 인식된 재료 요약을 제공한다. 공유 링크(`?share_id=xxx`)로 접속 시 공유 레시피를 직접 표시한다.

## Layout

```
┌─────────────────────────────────────────┐
│          🍳 Fridge Chef                 │
│   냉장고 재료로 만드는 맞춤 레시피      │
├─────────────────────────────────────────┤
│         사용 방법 안내                   │
│  1. 재료 인식 → 2. 레시피 생성 → 3. 저장 │
├─────────────────────────────────────────┤
│  인식된 재료 요약 (있을 경우)            │
│  "인식된 재료: 5개 — 계란, 부추, ..."   │
├─────────────────────────────────────────┤
│  왼쪽 사이드바: Streamlit 페이지 네비게이션 │
└─────────────────────────────────────────┘
```

## Fields

| Region | Element | Type | Notes |
|--------|---------|------|-------|
| Header | 제목 | Text | "🍳 Fridge Chef" |
| Header | 부제 | Text | "냉장고 재료로 만드는 맞춤 레시피" |
| 사용 방법 | 3단계 안내 | Markdown | 1. 재료 인식, 2. 레시피 생성, 3. 내 프로필 |
| 인식 재료 | 요약 | Success box | 인식된 재료 수 + 상위 5개 + "외 N개" |

## Interactions

### Page Load
- 세션 상태 초기화(`init_session_state`): 8개 키에 기본값 설정
- `?share_id` 쿼리 파라미터 존재 시 → 공유 레시피 페이지 렌더링 (메인 콘텐츠 대체)

### Shared Recipe Entry (`?share_id`)

- **Trigger**: URL에 `share_id` 파라미터 포함 시
- **Behavior**: `SharingService.get_shared_recipe(share_id)`로 레시피 조회
  - 유효: 레시피 카드 렌더링(저장/공유 버튼 숨김)
  - 무효: "공유 링크가 유효하지 않거나 더 이상 사용할 수 없습니다." 에러
- **Navigation**: "🏠 메인으로 돌아가기" 버튼 → 쿼리 파라미터 제거 후 `st.rerun()`

### 인식 재료 요약

- **Trigger**: `st.session_state.recognized_ingredients`에 항목이 있을 때
- **Behavior**: 재료 개수 + 상위 5개 재료명 표시, 5개 초과 시 "외 N개" 표시

## API Dependencies

| API | Method | Path | Trigger | Notes |
|----|--------|------|---------|-------|
| Get Shared Recipe | GET | (DB query) | `?share_id` 파라미터 | `SharingService.get_shared_recipe()` |

## Page Relationships

- **From**: 사이드바 네비게이션 (Streamlit 자동 생성)
- **To**: Page 1 (재료 인식), Page 2 (레시피 생성), Page 3 (내 프로필)
- **Data coupling**: `recognized_ingredients`를 읽어 요약 표시

## Business Rules

- 홈 페이지는 로그인 여부에 관계없이 항상 접근 가능
- 공유 레시피 페이지도 로그인 없이 볼 수 있음 (저장/공유 버튼은 숨김)