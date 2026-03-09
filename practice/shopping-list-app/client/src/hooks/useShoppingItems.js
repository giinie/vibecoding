import { useState, useEffect, useCallback } from 'react';
import { useSocketContext } from '../context/SocketContext';
import * as api from '../services/shoppingItemApi';

const ITEMS_PER_PAGE = 20;

export default function useShoppingItems(userId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const socket = useSocketContext();

  const loadItems = useCallback(async (pageNum = 1, append = false) => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);

      const data = await api.fetchShoppingItems(userId, {
        offset: (pageNum - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      });

      setItems(prev => append ? [...prev, ...data.items] : data.items);
      setHasMore(pageNum * ITEMS_PER_PAGE < data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadItems(nextPage, true);
  }, [page, loadItems]);

  const addItem = useCallback(async ({ name, quantity, unit }) => {
    try {
      setError(null);
      const raw = await api.createShoppingItem({ name, quantity, unit });
      const item = api.transformItem(raw);
      setItems(prev => {
        if (prev.some(i => i.id === item.id)) return prev;
        return [item, ...prev];
      });
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  const toggleItem = useCallback(async (id) => {
    try {
      setError(null);
      const raw = await api.toggleShoppingItem(id);
      const updated = api.transformItem(raw);
      setItems(prev => prev.map(item => item.id === id ? updated : item));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const removeItem = useCallback(async (id) => {
    try {
      setError(null);
      await api.deleteShoppingItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadItems(1);
  }, [loadItems]);

  // Real-time WebSocket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleNew = (rawItem) => {
      const item = api.transformItem(rawItem);
      setItems(prev => {
        if (prev.some(i => i.id === item.id)) return prev;
        return [item, ...prev];
      });
    };

    const handleToggled = (rawItem) => {
      const updated = api.transformItem(rawItem);
      setItems(prev => prev.map(item => item.id === updated.id ? updated : item));
    };

    const handleDeleted = ({ id }) => {
      setItems(prev => prev.filter(item => item.id !== id));
    };

    socket.on('shoppingItem:new', handleNew);
    socket.on('shoppingItem:toggled', handleToggled);
    socket.on('shoppingItem:deleted', handleDeleted);

    return () => {
      socket.off('shoppingItem:new', handleNew);
      socket.off('shoppingItem:toggled', handleToggled);
      socket.off('shoppingItem:deleted', handleDeleted);
    };
  }, [socket]);

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    addItem,
    toggleItem,
    removeItem,
    refresh: () => {
      setPage(1);
      loadItems(1);
    },
  };
}
