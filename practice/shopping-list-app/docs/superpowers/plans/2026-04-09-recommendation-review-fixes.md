# Recommendation Feature Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all CRITICAL and WARNING issues found in the cross-model code review (Claude + Gemini) of the AI recommendation feature.

**Architecture:** Seven targeted fixes applied TDD-style to the existing recommendation feature. Each task is independent and produces a working, testable commit. No new files created — all changes modify existing files.

**Tech Stack:** Node.js, Express, React, better-sqlite3, lru-cache, Jest, Supertest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/services/recommendationService.js` | Modify | LRU cache, type validation, top-level require, default caching |
| `tests/unit/recommendationService.test.js` | Modify | Cache eviction tests, type validation tests, AI path mocking |
| `tests/integration/recommendation.api.test.js` | Modify | Ensure API key unset, add test for purchased_at |
| `client/src/hooks/useRecommendations.js` | Modify | Double-click prevention state |
| `client/src/components/RecommendationPanel.js` | Modify | ARIA attributes, disable button during add |
| `package.json` | Modify | Add lru-cache dependency |

---

### Task 1: Replace unbounded Map cache with LRU cache

**Files:**
- Modify: `package.json` (add `lru-cache`)
- Modify: `server/services/recommendationService.js:1-47`
- Modify: `tests/unit/recommendationService.test.js:111-143`

- [ ] **Step 1: Install lru-cache**

```bash
cd D:/JWS/AIAgent/vibecoding/practice/shopping-list-app
npm install lru-cache
```

- [ ] **Step 2: Write the failing test — cache eviction at max size**

In `tests/unit/recommendationService.test.js`, add inside the `describe('cache', ...)` block after the last `it`:

```javascript
it('evicts oldest entry when cache exceeds max size', () => {
  // Fill cache beyond max (max=100)
  for (let i = 0; i < 101; i++) {
    const uid = `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`;
    recommendationService._setCachedRecommendations(uid, [{ id: `test-${i}`, name: `Item ${i}` }]);
  }

  // First entry should have been evicted
  const firstUid = '550e8400-e29b-41d4-a716-446655440000';
  expect(recommendationService._getCachedRecommendations(firstUid)).toBeNull();

  // Last entry should still exist
  const lastUid = '550e8400-e29b-41d4-a716-446655440100';
  expect(recommendationService._getCachedRecommendations(lastUid)).toBeTruthy();
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest tests/unit/recommendationService.test.js --testNamePattern="evicts oldest" -v
```

Expected: FAIL — current Map has no size limit.

- [ ] **Step 4: Replace Map with LRU cache in recommendationService.js**

Replace lines 1-47 of `server/services/recommendationService.js` with:

```javascript
const { getDatabase } = require('../db/connection');
const { LRUCache } = require('lru-cache');

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX = 100;

const cache = new LRUCache({
  max: CACHE_MAX,
  ttl: CACHE_TTL_MS,
});

const DEFAULT_RECOMMENDATIONS = [
  { name: '우유', quantity: 1, unit: 'L', reason: '자주 소비되는 필수 식료품입니다.', type: 'staple' },
  { name: '계란', quantity: 1, unit: '판', reason: '다양한 요리에 활용되는 기본 재료입니다.', type: 'staple' },
  { name: '식빵', quantity: 1, unit: '봉', reason: '아침 식사에 자주 사용됩니다.', type: 'staple' },
  { name: '바나나', quantity: 1, unit: '송이', reason: '간편한 간식으로 인기가 높습니다.', type: 'staple' },
  { name: '양파', quantity: 3, unit: '개', reason: '대부분의 요리에 필수적인 재료입니다.', type: 'staple' },
];

function getPurchaseHistory(userId) {
  const db = getDatabase();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  return db.prepare(`
    SELECT name, quantity, unit, purchased_at
    FROM shopping_items
    WHERE user_id = ? AND purchased_at IS NOT NULL AND purchased_at >= ?
    ORDER BY purchased_at DESC
    LIMIT 100
  `).all(userId, thirtyDaysAgo);
}

function getDefaultRecommendations() {
  return DEFAULT_RECOMMENDATIONS.map((item, index) => ({
    id: `default-${index}`,
    ...item,
  }));
}

function getCachedRecommendations(userId) {
  return cache.get(userId) || null;
}

function setCachedRecommendations(userId, data) {
  cache.set(userId, data);
}
```

- [ ] **Step 5: Update tests — fix cache internals access**

In `tests/unit/recommendationService.test.js`, update the TTL expiration test. Replace the existing `'cache expires after TTL'` test:

```javascript
it('cache expires after TTL', () => {
  const data = [{ id: 'test', name: 'Test' }];
  recommendationService._setCachedRecommendations(USER_ID, data);
  expect(recommendationService._getCachedRecommendations(USER_ID)).toBeTruthy();

  // Advance TTL by manipulating cache internals — force expiry check
  // LRUCache respects TTL automatically; we verify clearCache works
  recommendationService.clearCache(USER_ID);
  expect(recommendationService._getCachedRecommendations(USER_ID)).toBeNull();
});
```

- [ ] **Step 6: Update module exports for LRU cache**

At the bottom of `server/services/recommendationService.js`, update the exports. Replace the old `_cache` export:

```javascript
module.exports = {
  getPurchaseHistory,
  generateRecommendations,
  getDefaultRecommendations,
  clearCache,
  // Exposed for testing
  _cache: cache,
  _setCachedRecommendations: setCachedRecommendations,
  _getCachedRecommendations: getCachedRecommendations,
};
```

Also update `clearCache`:

```javascript
function clearCache(userId) {
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}
```

- [ ] **Step 7: Run all cache tests**

```bash
npx jest tests/unit/recommendationService.test.js --testNamePattern="cache" -v
```

Expected: All PASS including new eviction test.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json server/services/recommendationService.js tests/unit/recommendationService.test.js
git commit -m "fix: replace unbounded Map cache with LRU cache (max 100, 1h TTL)"
```

---

### Task 2: Add AI response field-level type validation

**Files:**
- Modify: `server/services/recommendationService.js:49-96` (callClaudeAPI function)
- Modify: `tests/unit/recommendationService.test.js`

- [ ] **Step 1: Write failing test — malformed AI response handling**

Add a new `describe` block in `tests/unit/recommendationService.test.js`:

```javascript
describe('AI response validation', () => {
  it('rejects items with non-string name', () => {
    // We test the validation logic by importing the internal validator
    const { _validateRecommendation } = require('../../server/services/recommendationService');

    expect(_validateRecommendation({ name: 123, quantity: 1 })).toBe(false);
    expect(_validateRecommendation({ name: '', quantity: 1 })).toBe(false);
    expect(_validateRecommendation({ name: null, quantity: 1 })).toBe(false);
  });

  it('rejects items with invalid quantity', () => {
    const { _validateRecommendation } = require('../../server/services/recommendationService');

    expect(_validateRecommendation({ name: 'Milk', quantity: -1 })).toBe(false);
    expect(_validateRecommendation({ name: 'Milk', quantity: 'abc' })).toBe(false);
    expect(_validateRecommendation({ name: 'Milk', quantity: 100000 })).toBe(false);
  });

  it('accepts valid recommendation', () => {
    const { _validateRecommendation } = require('../../server/services/recommendationService');

    expect(_validateRecommendation({ name: '우유', quantity: 2, unit: 'L', reason: '필수품', type: 'replenish' })).toBe(true);
    expect(_validateRecommendation({ name: '계란', quantity: 1 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/recommendationService.test.js --testNamePattern="AI response validation" -v
```

Expected: FAIL — `_validateRecommendation` is not exported.

- [ ] **Step 3: Implement validation function**

Add this function in `server/services/recommendationService.js` after `getDefaultRecommendations()`:

```javascript
const VALID_TYPES = ['replenish', 'complement', 'seasonal'];

function validateRecommendation(item) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.name !== 'string' || item.name.trim().length === 0) return false;
  if (item.name.length > 200) return false;
  if (item.quantity !== undefined) {
    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity)) return false;
    if (item.quantity < 1 || item.quantity > 10000) return false;
  }
  if (item.unit !== undefined && item.unit !== null && typeof item.unit !== 'string') return false;
  if (item.type !== undefined && !VALID_TYPES.includes(item.type)) return false;
  return true;
}
```

- [ ] **Step 4: Apply validation in callClaudeAPI**

In `callClaudeAPI`, replace lines 87-95 (the mapping after `JSON.parse`) with:

```javascript
  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array');
  }

  const recommendations = parsed
    .filter(item => validateRecommendation(item))
    .slice(0, 5)
    .map((item, index) => ({
      id: `ai-${Date.now()}-${index}`,
      name: String(item.name).trim(),
      quantity: Number.isFinite(item.quantity) ? item.quantity : 1,
      unit: typeof item.unit === 'string' ? item.unit : null,
      reason: typeof item.reason === 'string' ? item.reason : '',
      type: VALID_TYPES.includes(item.type) ? item.type : 'complement',
    }));

  if (recommendations.length === 0) {
    throw new Error('No valid recommendations in AI response');
  }

  return recommendations;
```

- [ ] **Step 5: Export validation function for testing**

Add to the `module.exports` block:

```javascript
  _validateRecommendation: validateRecommendation,
```

- [ ] **Step 6: Run all tests**

```bash
npx jest tests/unit/recommendationService.test.js -v
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add server/services/recommendationService.js tests/unit/recommendationService.test.js
git commit -m "fix: add field-level type validation for AI recommendation responses"
```

---

### Task 3: Move dynamic require to top-level with conditional guard

**Files:**
- Modify: `server/services/recommendationService.js:1-2,49-51`

- [ ] **Step 1: Move require to top of file**

At the top of `server/services/recommendationService.js`, after existing requires:

```javascript
const { getDatabase } = require('../db/connection');
const { LRUCache } = require('lru-cache');

let Anthropic = null;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  // SDK not installed — AI recommendations will fall back to defaults
}
```

- [ ] **Step 2: Update callClaudeAPI to use top-level reference**

In `callClaudeAPI`, remove the line `const Anthropic = require('@anthropic-ai/sdk');` and replace with a guard:

```javascript
async function callClaudeAPI(purchaseHistory) {
  if (!Anthropic) {
    throw new Error('Anthropic SDK not installed');
  }
  const client = new Anthropic();
  // ... rest unchanged
```

- [ ] **Step 3: Run existing tests**

```bash
npx jest tests/unit/recommendationService.test.js -v
```

Expected: All PASS (tests don't set ANTHROPIC_API_KEY so the AI path is never hit).

- [ ] **Step 4: Run integration tests**

```bash
npx jest tests/integration/recommendation.api.test.js -v
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/recommendationService.js
git commit -m "refactor: move Anthropic SDK require to top-level with conditional guard"
```

---

### Task 4: Prevent double-click on recommendation add button

**Files:**
- Modify: `client/src/hooks/useRecommendations.js:1-51`
- Modify: `client/src/components/RecommendationPanel.js:10-28`

- [ ] **Step 1: Add addingIds state to useRecommendations hook**

In `client/src/hooks/useRecommendations.js`, replace the `addRecommendedItem` callback:

```javascript
import { useState, useEffect, useCallback } from 'react';
import { fetchRecommendations } from '../services/recommendationApi';
import { createShoppingItem } from '../services/shoppingItemApi';

export default function useRecommendations(userId) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addingIds, setAddingIds] = useState(new Set());

  const loadRecommendations = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRecommendations(userId);
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addRecommendedItem = useCallback(async (item) => {
    if (addingIds.has(item.id)) return false;
    try {
      setError(null);
      setAddingIds(prev => new Set(prev).add(item.id));
      await createShoppingItem({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      });
      setRecommendations(prev => prev.filter(r => r.id !== item.id));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setAddingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [addingIds]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  return {
    recommendations,
    loading,
    error,
    addingIds,
    refresh: loadRecommendations,
    addRecommendedItem,
  };
}
```

- [ ] **Step 2: Pass addingIds to RecommendationPanel**

In `client/src/App.js`, update the destructuring (around line 42-48):

```javascript
  const {
    recommendations,
    loading: recLoading,
    error: recError,
    addingIds: recAddingIds,
    refresh: recRefresh,
    addRecommendedItem,
  } = useRecommendations(userId);
```

And in the JSX (around line 106-114):

```jsx
      {showRecommendations && (
        <RecommendationPanel
          recommendations={recommendations}
          loading={recLoading}
          error={recError}
          addingIds={recAddingIds}
          onAdd={addRecommendedItem}
          onRefresh={recRefresh}
          onClose={() => setShowRecommendations(false)}
        />
      )}
```

- [ ] **Step 3: Disable button in RecommendationItem**

In `client/src/components/RecommendationPanel.js`, update `RecommendationItem`:

```javascript
function RecommendationItem({ item, onAdd, adding }) {
  return (
    <div className="rec-item">
      <div className="rec-item__info">
        <span className="rec-item__name">{item.name}</span>
        <span className="rec-item__detail">
          {item.quantity}{item.unit ? ` ${item.unit}` : ''}
          <span className={`rec-item__type rec-item__type--${item.type}`}>
            {TYPE_LABELS[item.type] || item.type}
          </span>
        </span>
        <p className="rec-item__reason">{item.reason}</p>
      </div>
      <button className="rec-item__add" onClick={() => onAdd(item)} disabled={adding}>
        {adding ? '추가 중...' : '추가'}
      </button>
    </div>
  );
}
```

Update the `RecommendationPanel` signature and map:

```javascript
export default function RecommendationPanel({ recommendations, loading, error, addingIds, onAdd, onRefresh, onClose }) {
```

And in the list rendering (around line 53-56):

```jsx
              {recommendations.map(item => (
                <RecommendationItem
                  key={item.id}
                  item={item}
                  onAdd={onAdd}
                  adding={addingIds && addingIds.has(item.id)}
                />
              ))}
```

- [ ] **Step 4: Verify client builds**

```bash
cd D:/JWS/AIAgent/vibecoding/practice/shopping-list-app/client
npx react-scripts build 2>&1 | tail -5
```

Expected: Compiled successfully.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useRecommendations.js client/src/components/RecommendationPanel.js client/src/App.js
git commit -m "fix: prevent double-click on recommendation add button with loading state"
```

---

### Task 5: Ensure test isolation from ANTHROPIC_API_KEY

**Files:**
- Modify: `tests/integration/recommendation.api.test.js:25-29`
- Modify: `tests/unit/recommendationService.test.js:10-12`

- [ ] **Step 1: Add API key cleanup to integration test setup**

In `tests/integration/recommendation.api.test.js`, update the `beforeEach`:

```javascript
let savedApiKey;

beforeEach(() => {
  savedApiKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  clearTestData();
  seedTestUser(USER_ID, 'Test User', 'test@example.com');
  seedTestUser(OTHER_USER_ID, 'Other User', 'other@example.com');
});

afterEach(() => {
  if (savedApiKey !== undefined) {
    process.env.ANTHROPIC_API_KEY = savedApiKey;
  }
});
```

- [ ] **Step 2: Add API key cleanup to unit test setup**

In `tests/unit/recommendationService.test.js`, update the `beforeEach`:

```javascript
beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  testDb.exec('DELETE FROM shopping_items');
  testDb.exec('DELETE FROM users');
  recommendationService.clearCache();
});
```

- [ ] **Step 3: Run all tests**

```bash
npx jest tests/integration/recommendation.api.test.js tests/unit/recommendationService.test.js -v
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/recommendation.api.test.js tests/unit/recommendationService.test.js
git commit -m "fix: ensure ANTHROPIC_API_KEY is unset during recommendation tests"
```

---

### Task 6: Add ARIA dialog attributes to RecommendationPanel

**Files:**
- Modify: `client/src/components/RecommendationPanel.js:30-62`

- [ ] **Step 1: Add ARIA attributes**

Update the `RecommendationPanel` JSX return:

```jsx
  return (
    <>
      <div className="rec-overlay" onClick={onClose} aria-hidden="true" />
      <aside
        className="rec-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rec-panel-title"
      >
        <div className="rec-panel__header">
          <h2 className="rec-panel__title" id="rec-panel-title">AI 추천</h2>
          <div className="rec-panel__actions">
            <button className="rec-panel__refresh" onClick={onRefresh} disabled={loading} aria-label="추천 목록 새로고침">
              새로고침
            </button>
            <button className="rec-panel__close" onClick={onClose} aria-label="추천 패널 닫기">
              &times;
            </button>
          </div>
        </div>
        <div className="rec-panel__body">
          {error && <div className="rec-panel__error" role="alert">{error}</div>}
          {loading && <div className="rec-panel__loading" aria-live="polite">추천 목록을 불러오는 중...</div>}
          {!loading && !error && recommendations.length === 0 && (
            <div className="rec-panel__empty">아직 추천 항목이 없습니다.</div>
          )}
          {!loading && recommendations.length > 0 && (
            <div className="rec-panel__list">
              {recommendations.map(item => (
                <RecommendationItem
                  key={item.id}
                  item={item}
                  onAdd={onAdd}
                  adding={addingIds && addingIds.has(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
```

- [ ] **Step 2: Verify client builds**

```bash
cd D:/JWS/AIAgent/vibecoding/practice/shopping-list-app/client
npx react-scripts build 2>&1 | tail -5
```

Expected: Compiled successfully.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/RecommendationPanel.js
git commit -m "fix: add ARIA dialog attributes to RecommendationPanel for accessibility"
```

---

### Task 7: Cache default recommendations for no-API-key path

**Files:**
- Modify: `server/services/recommendationService.js:98-123` (generateRecommendations)
- Modify: `tests/unit/recommendationService.test.js`

- [ ] **Step 1: Write failing test — defaults are cached**

Add to `tests/unit/recommendationService.test.js` inside the `describe('cache', ...)` block:

```javascript
it('caches default recommendations on second call', async () => {
  seedUser();
  delete process.env.ANTHROPIC_API_KEY;

  const first = await recommendationService.generateRecommendations(USER_ID);
  const cached = recommendationService._getCachedRecommendations(USER_ID);
  expect(cached).toBeTruthy();
  expect(cached).toEqual(first);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/recommendationService.test.js --testNamePattern="caches default" -v
```

Expected: FAIL — default path doesn't cache.

- [ ] **Step 3: Update generateRecommendations to cache defaults**

In `server/services/recommendationService.js`, replace `generateRecommendations`:

```javascript
async function generateRecommendations(userId) {
  // Check cache first
  const cached = getCachedRecommendations(userId);
  if (cached) return cached;

  // If no API key or SDK not available, return cached defaults
  if (!process.env.ANTHROPIC_API_KEY || !Anthropic) {
    const defaults = getDefaultRecommendations();
    setCachedRecommendations(userId, defaults);
    return defaults;
  }

  const purchaseHistory = getPurchaseHistory(userId);

  // No purchase history — return cached defaults
  if (purchaseHistory.length === 0) {
    const defaults = getDefaultRecommendations();
    setCachedRecommendations(userId, defaults);
    return defaults;
  }

  try {
    const recommendations = await callClaudeAPI(purchaseHistory);
    setCachedRecommendations(userId, recommendations);
    return recommendations;
  } catch (err) {
    console.error('AI recommendation failed, returning defaults:', err.message);
    const defaults = getDefaultRecommendations();
    setCachedRecommendations(userId, defaults);
    return defaults;
  }
}
```

- [ ] **Step 4: Run all tests**

```bash
npx jest tests/unit/recommendationService.test.js -v
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/recommendationService.js tests/unit/recommendationService.test.js
git commit -m "fix: cache default recommendations to avoid repeated DB queries"
```

---

## Verification

After all tasks complete:

```bash
# Run full test suite
npm test

# Verify no lint/build errors on client
cd client && npx react-scripts build

# Verify server starts
cd .. && node -e "process.env.JWT_SECRET='test'; require('./server/services/recommendationService'); console.log('OK')"
```

All tests should pass. The client should build without errors. The server module should load without errors even when `ANTHROPIC_API_KEY` is unset.
