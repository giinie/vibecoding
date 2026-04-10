import React, { useState } from 'react';
import { SocketProvider } from './context/SocketContext';
import NotificationBell from './components/NotificationBell';
import NotificationList from './components/NotificationList';
import ShoppingItemInput from './components/ShoppingItemInput';
import ShoppingItemList from './components/ShoppingItemList';
import RecommendationPanel from './components/RecommendationPanel';
import useNotifications from './hooks/useNotifications';
import useShoppingItems from './hooks/useShoppingItems';
import useRecommendations from './hooks/useRecommendations';
import { login, logout } from './services/authApi';
import { disconnect } from './services/socketService';
import './App.css';
import './styles/notifications.css';
import './styles/shopping.css';
import './styles/recommendations.css';

function AppContent({ userId, onLogout }) {
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    error,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotifications(userId);
  const {
    items,
    loading: itemsLoading,
    error: itemsError,
    hasMore: itemsHasMore,
    loadMore: itemsLoadMore,
    addItem,
    toggleItem,
    removeItem,
  } = useShoppingItems(userId);
  const {
    recommendations,
    loading: recLoading,
    error: recError,
    addingIds: recAddingIds,
    refresh: recRefresh,
    addRecommendedItem,
  } = useRecommendations(userId, { enabled: showRecommendations });

  if (showAllNotifications) {
    return (
      <div className="app">
        <header className="app-header">
          <h1 className="app-header__title">쇼핑 리스트</h1>
          <button className="app-header__logout" onClick={onLogout}>로그아웃</button>
        </header>
        <main className="app-main">
          {error && <div className="app-error">{error}</div>}
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
          <button className="rec-toggle" onClick={() => setShowRecommendations(true)} title="AI 추천">
            &#128161;
          </button>
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onViewAll={() => setShowAllNotifications(true)}
          />
          <button className="app-header__logout" onClick={onLogout}>로그아웃</button>
        </div>
      </header>
      <main className="app-main">
        {error && <div className="app-error">{error}</div>}
        {itemsError && <div className="app-error">{itemsError}</div>}
        <ShoppingItemInput onAdd={addItem} />
        <ShoppingItemList
          items={items}
          loading={itemsLoading}
          hasMore={itemsHasMore}
          onLoadMore={itemsLoadMore}
          onToggle={toggleItem}
          onDelete={removeItem}
        />
      </main>
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
    </div>
  );
}

export default function App() {
  const [userId, setUserId] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await login(email, password);
      setUserId(data.user.id);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    disconnect();
    setUserId(null);
    setEmail('');
    setPassword('');
    setAuthError(null);
  };

  if (!userId) {
    return (
      <div className="app">
        <header className="app-header">
          <h1 className="app-header__title">쇼핑 리스트</h1>
        </header>
        <main className="app-main">
          <form className="login-form" onSubmit={handleLogin}>
            <h2>로그인</h2>
            {authError && <div className="login-form__error">{authError}</div>}
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={authLoading}>
              {authLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <SocketProvider userId={userId}>
      <AppContent userId={userId} onLogout={handleLogout} />
    </SocketProvider>
  );
}
