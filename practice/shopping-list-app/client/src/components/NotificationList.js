import React from 'react';
import NotificationItem from './NotificationItem';

export default function NotificationList({
  notifications,
  loading,
  hasMore,
  onLoadMore,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onBack,
}) {
  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <div className="notification-list">
      <div className="notification-list__header">
        <button className="notification-list__back" onClick={onBack}>
          ← 돌아가기
        </button>
        <h2 className="notification-list__title">전체 알림</h2>
        {hasUnread && (
          <button
            className="notification-list__mark-all"
            onClick={onMarkAllAsRead}
          >
            모두 읽음
          </button>
        )}
      </div>
      <div className="notification-list__items">
        {notifications.length === 0 && !loading ? (
          <div className="notification-list__empty">
            알림이 없습니다.
          </div>
        ) : (
          notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={onMarkAsRead}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
      {loading && (
        <div className="notification-list__loading">불러오는 중...</div>
      )}
      {hasMore && !loading && (
        <div className="notification-list__load-more">
          <button onClick={onLoadMore}>더 보기</button>
        </div>
      )}
    </div>
  );
}
