import { useState, useEffect, useCallback } from 'react';
import { fetchRecommendations } from '../services/recommendationApi';
import { createShoppingItem } from '../services/shoppingItemApi';

export default function useRecommendations(userId) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addingIds, setAddingIds] = useState(new Set());

  const loadRecommendations = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRecommendations(userId);
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addRecommendedItem = useCallback(async (item) => {
    if (addingIds.has(item.id)) return false;
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
      setAddingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [addingIds]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  return {
    recommendations,
    loading,
    error,
    addingIds,
    refresh: loadRecommendations,
    addRecommendedItem,
  };
}
