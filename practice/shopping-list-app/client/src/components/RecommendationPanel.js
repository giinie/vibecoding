import React from 'react';

const TYPE_LABELS = {
  replenish: '재구매',
  complement: '보완',
  seasonal: '계절',
  staple: '필수품',
};

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

export default function RecommendationPanel({ recommendations, loading, error, addingIds, onAdd, onRefresh, onClose }) {
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
}
