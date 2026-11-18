import { useEffect, useState } from 'react';
import type { Bookmark, Favorite, Quote } from '@/entities/book/model/types';
import { getBookmarks, getFavorites, getQuotes } from '@/shared/storage/collections';
import { useReplicaVersion } from '@/shared/sync/useReplicaVersion';

export interface Collections {
  favorites: Favorite[];
  quotes: Quote[];
  bookmarks: Bookmark[];
  loading: boolean;
}

const EMPTY: Collections = { favorites: [], quotes: [], bookmarks: [], loading: true };

/** Favorites, quotes and bookmarks from the local replica; reloads when it changes. */
export function useCollections(): Collections {
  const version = useReplicaVersion();
  const [data, setData] = useState<Collections>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getFavorites(), getQuotes(), getBookmarks()])
      .then(([favorites, quotes, bookmarks]) => {
        if (!cancelled) setData({ favorites, quotes, bookmarks, loading: false });
      })
      .catch((err: unknown) => {
        console.error('[library] failed to read collections', err);
        if (!cancelled) setData((prev) => ({ ...prev, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [version]);
  return data;
}
