import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchRecommendations } from '../services/recommendationApi';
import { createShoppingItem } from '../services/shoppingItemApi';

export default function useRecommendations(userId, { enabled = false } = {}) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addingIds, setAddingIds] = useState(new Set());
  const addingRef = useRef(new Set());

  const loadRecommendations = useCallback(async ({ refresh = false } = {}) => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRecommendations(userId, { refresh });
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addRecommendedItem = useCallback(async (item) => {
    if (addingRef.current.has(item.id)) return false;
    addingRef.current.add(item.id);
    try {
      setError(null);
      setAddingIds(prev => new Set(prev).add(item.id));
      await createShoppingItem({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      });
      setRecommendations(prev => prev.filter(r => r.id !== item.id));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      addingRef.current.delete(item.id);
      setAddingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      loadRecommendations();
    }
  }, [enabled, loadRecommendations]);

  const refresh = useCallback(() => {
    return loadRecommendations({ refresh: true });
  }, [loadRecommendations]);

  return {
    recommendations,
    loading,
    error,
    addingIds,
    refresh,
    addRecommendedItem,
  };
}
