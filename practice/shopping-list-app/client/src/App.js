import React, { useState, useEffect } from 'react';
import { SocketProvider } from './context/SocketContext';
import NotificationBell from './components/NotificationBell';
import NotificationList from './components/NotificationList';
import useNotifications from './hooks/useNotifications';
import { login } from './services/authApi';
import './App.css';
import './styles/notifications.css';

function AppContent({ userId }) {
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
  } = useNotifications(userId);

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
  const [userId, setUserId] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    login('alice@example.com', 'password123')
      .then((data) => {
        setUserId(data.user.id);
      })
      .catch((err) => {
        setAuthError(err.message);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  if (authLoading) {
    return (
      <div className="app">
        <main className="app-main">
          <p>로그인 중...</p>
        </main>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="app">
        <main className="app-main">
          <p>로그인 실패: {authError}</p>
        </main>
      </div>
    );
  }

  return (
    <SocketProvider userId={userId}>
      <AppContent userId={userId} />
    </SocketProvider>
  );
}
