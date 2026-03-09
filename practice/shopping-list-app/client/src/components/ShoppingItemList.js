import React from 'react';

export default function ShoppingItemList({ items, loading, hasMore, onLoadMore, onToggle, onDelete }) {
  if (!loading && items.length === 0) {
    return (
      <div className="shopping-list">
        <p className="shopping-list__empty">장바구니가 비어있습니다.</p>
      </div>
    );
  }

  return (
    <div className="shopping-list">
      {items.map((item) => (
        <div
          key={item.id}
          className={`shopping-item${item.isPurchased ? ' shopping-item--purchased' : ''}`}
        >
          <input
            className="shopping-item__checkbox"
            type="checkbox"
            checked={item.isPurchased}
            onChange={() => onToggle(item.id)}
          />
          <div className="shopping-item__info">
            <span className="shopping-item__name">{item.name}</span>
            {(item.quantity > 1 || item.unit) && (
              <div className="shopping-item__detail">
                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
              </div>
            )}
          </div>
          <button
            className="shopping-item__delete"
            onClick={() => onDelete(item.id)}
          >
            삭제
          </button>
        </div>
      ))}
      {hasMore && (
        <button
          className="shopping-list__load-more"
          onClick={onLoadMore}
          disabled={loading}
        >
          {loading ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </div>
  );
}
