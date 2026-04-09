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
