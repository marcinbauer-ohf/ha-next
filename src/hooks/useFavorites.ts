'use client';

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ha_favorites';

function load(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function persist(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

// Favorited device ids, in insertion order. Device ids are stable across
// floor/group switches, so favorites survive all dashboard filtering.
export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(load);

  const isFavorite = useCallback(
    (deviceId: string) => favoriteIds.includes(deviceId),
    [favoriteIds],
  );

  const toggleFavorite = useCallback((deviceId: string) => {
    setFavoriteIds(prev => {
      const next = prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId];
      persist(next);
      return next;
    });
  }, []);

  return { favoriteIds, isFavorite, toggleFavorite };
}
