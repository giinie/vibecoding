import React, { useState } from 'react';
import { SocketProvider } from './context/SocketContext';
import NotificationBell from './components/NotificationBell';
import NotificationList from './components/NotificationList';
import useNotifications from './hooks/useNotifications';
import './App.css';
import './styles/notifications.css';

const USER_ID = 'user-1';

function AppContent() {
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotifications(USER_ID);

  if (showAllNotifications) {
    return (
      <div className="app">
        <header className="app-header">
          <h1 className="app-header__title">쇼핑 리스트</h1>
        </header>
        <main className="app-main">
          <NotificationList
            notifications={notifications}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onDelete={removeNotification}
            onBack={() => setShowAllNotifications(false)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-header__title">쇼핑 리스트</h1>
        <div className="app-header__actions">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onViewAll={() => setShowAllNotifications(true)}
          />
        </div>
      </header>
      <main className="app-main">
        <div className="app-placeholder">
          <p>장바구니 목록이 여기에 표시됩니다.</p>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SocketProvider userId={USER_ID}>
      <AppContent />
    </SocketProvider>
  );
}
