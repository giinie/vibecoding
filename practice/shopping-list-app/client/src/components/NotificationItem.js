import React from 'react';

const TYPE_ICONS = {
  item_added: '\u2795',
  item_purchased: '\u2705',
  list_shared: '\uD83D\uDD17',
  reminder: '\uD83D\uDD14',
};

const TYPE_LABELS = {
  item_added: '\uC7A5\uBC14\uAD6C\uB2C8 \uCD94\uAC00',
  item_purchased: '\uAD6C\uB9E4 \uC644\uB8CC',
  list_shared: '\uBAA9\uB85D \uACF5\uC720',
  reminder: '\uC54C\uB9BC',
};

function getRelativeTime(dateString) {
  if (!dateString) return '';
  const now = Date.now();
  const date = new Date(dateString).getTime();
  if (isNaN(date)) return '';
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return '\uBC29\uAE08';
  if (diff < 3600) return `${Math.floor(diff / 60)}\uBD84 \uC804`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}\uC2DC\uAC04 \uC804`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}\uC77C \uC804`;
  return new Date(dateString).toLocaleDateString('ko-KR');
}

export default function NotificationItem({ notification, onRead, onDelete, compact }) {
  const { id, type, message, isRead, createdAt } = notification;
  const icon = TYPE_ICONS[type] || '\uD83D\uDD14';
  const label = TYPE_LABELS[type] || '\uC54C\uB9BC';

  const handleClick = () => {
    if (!isRead && onRead) {
      onRead(id);
    }
  };

  return (
    <div
      className={`notification-item ${isRead ? 'read' : 'unread'} ${compact ? 'compact' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <div className="notification-item__icon">{icon}</div>
      <div className="notification-item__content">
        <div className="notification-item__header">
          <span className="notification-item__label">{label}</span>
          <span className="notification-item__time">{getRelativeTime(createdAt)}</span>
        </div>
        <p className="notification-item__message">{message}</p>
      </div>
      {!compact && onDelete && (
        <button
          className="notification-item__delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          aria-label="\uC54C\uB9BC \uC0AD\uC81C"
          title="\uC0AD\uC81C"
        >
          \u00D7
        </button>
      )}
      {!isRead && <div className="notification-item__dot" />}
    </div>
  );
}
