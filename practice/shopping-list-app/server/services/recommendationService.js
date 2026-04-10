const { getDatabase } = require('../db/connection');
const LRU = require('lru-cache');

let Anthropic = null;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  // SDK not installed — AI recommendations will fall back to defaults
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX = 100;

const cache = new LRU({
  max: CACHE_MAX,
  maxAge: CACHE_TTL_MS,
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

function getCachedRecommendations(userId) {
  return cache.get(userId) || null;
}

function setCachedRecommendations(userId, data) {
  cache.set(userId, data);
}

async function callClaudeAPI(purchaseHistory) {
  if (!Anthropic) {
    throw new Error('Anthropic SDK not installed');
  }
  const client = new Anthropic();

  const historyText = purchaseHistory
    .map(item => `${item.name} (${item.quantity}${item.unit || ''}) - 구매일: ${item.purchased_at}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `당신은 쇼핑 도우미입니다. 아래는 사용자의 최근 30일 구매 이력입니다.

구매 이력:
${historyText}

이 구매 패턴을 분석하여 5개의 쇼핑 추천 항목을 JSON 배열로 반환해주세요.
각 항목은 다음 형식이어야 합니다:
[{"name": "상품명", "quantity": 숫자, "unit": "단위", "reason": "추천 이유", "type": "replenish|complement|seasonal"}]

type 설명:
- replenish: 재구매가 필요할 것으로 예상되는 항목
- complement: 구매 이력과 잘 어울리는 보완 항목
- seasonal: 계절/시기에 맞는 추천 항목

JSON 배열만 반환하고, 다른 텍스트는 포함하지 마세요.`,
    }],
  });

  const text = response.content[0].text.trim();
  // Extract JSON array from response (handle potential markdown fencing)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse recommendations from AI response');
  }

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
}

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

function clearCache(userId) {
  if (userId) {
    cache.del(userId);
  } else {
    cache.reset();
  }
}

module.exports = {
  getPurchaseHistory,
  generateRecommendations,
  getDefaultRecommendations,
  clearCache,
  // Exposed for testing
  _cache: cache,
  _setCachedRecommendations: setCachedRecommendations,
  _getCachedRecommendations: getCachedRecommendations,
  _validateRecommendation: validateRecommendation,
};
