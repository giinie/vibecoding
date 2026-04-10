# Todo

<!-- Track tasks here. Check items as completed. -->

## Codex 리뷰 지적사항 수정 (2026-04-09)

출처: Codex review on `practice` branch working tree diff

### [P1] 기존 구매 데이터 `purchased_at` 백필 누락
- [x] `server/db/migrate.js` — 마이그레이션에 백필 쿼리 추가
  - `ALTER TABLE` 직후 `UPDATE shopping_items SET purchased_at = created_at WHERE is_purchased = 1 AND purchased_at IS NULL` 실행
  - 멱등성: `hasPurchasedAt` 분기 안에서만 실행되므로 이미 컬럼이 있는 DB에서는 스킵

### [P2] 구매 상태 변경 시 추천 캐시 무효화 누락
- [x] `server/controllers/shoppingItemController.js` — `togglePurchased()` 성공 후 `clearRecommendationCache(req.userId)` 호출
  - 모델이 아닌 컨트롤러 레벨에서 처리 (기존 WebSocket emit 패턴과 동일)
  - `recommendationService.clearCache(userId)` 재사용

### Review
- 전체 테스트 통과 (15 suites, 145 tests) ✓

---

## Codex 리뷰 지적사항 (2026-04-10)

출처: Codex review on `practice` branch, last 3 days diff against `a42c15d^`

### [P2] 추천 패널 미사용 시 불필요한 API 호출
- [ ] `client/src/App.js:42-49` — `useRecommendations(userId)`가 로그인 직후 무조건 마운트됨
  - 패널을 열지 않아도 `/api/recommendations/:userId`를 호출하여 불필요한 Claude API 비용/지연 발생
  - 수정 방향: 패널 열림 상태를 조건으로 lazy fetch하거나, hook에 `enabled` 플래그 추가

### [P2] 추천 아이템 추가 버튼 더블클릭 레이스 컨디션
- [ ] `client/src/hooks/useRecommendations.js:25-30` — `addingIds` 가드가 빠른 연속 클릭을 차단하지 못함
  - `setAddingIds()`가 비동기라 React 리렌더 전에 두 번째 클릭이 가드를 통과 → 중복 아이템 생성
  - 수정 방향: `useRef`로 즉시 동기 가드 구현하거나, 함수형 업데이트 `setAddingIds(prev => ...)` 활용

### [P2] 새로고침 시 서버 캐시가 무효화되지 않음
- [ ] `server/services/recommendationService.js:134-137` — 캐시 TTL 1시간 동안 동일한 추천 반환
  - 사용자가 새로고침 버튼을 눌러도 서버 캐시가 그대로라 이전 추천이 재등장
  - 수정 방향: refresh 요청 시 해당 userId 캐시를 강제 삭제하거나, 쿼리 파라미터로 캐시 우회 옵션 추가
