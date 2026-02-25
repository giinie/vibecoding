import React from 'react';
import NotificationItem from './NotificationItem';

export default function NotificationDropdown({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewAll,
  onClose,
}) {
  const recentNotifications = notifications.slice(0, 5);
  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <div className="notification-dropdown">
      <div className="notification-dropdown__arrow" />
      <div className="notification-dropdown__header">
        <h3 className="notification-dropdown__title">알림</h3>
        {hasUnread && (
          <button
            className="notification-dropdown__mark-all"
            onClick={onMarkAllAsRead}
          >
            모두 읽음
          </button>
        )}
      </div>
      <div className="notification-dropdown__list">
        {recentNotifications.length === 0 ? (
          <div className="notification-dropdown__empty">
            새로운 알림이 없습니다.
          </div>
        ) : (
          recentNotifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={onMarkAsRead}
              compact
            />
          ))
        )}
      </div>
      <div className="notification-dropdown__footer">
        <button
          className="notification-dropdown__view-all"
          onClick={onViewAll}
        >
          전체 보기
        </button>
      </div>
    </div>
  );
}
