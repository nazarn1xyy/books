import { useMemo } from 'react';
import type { Book, ReadingProgress } from '@/entities/book/model/types';
import { getAppState } from '@/shared/storage/storage';
import { useReplicaVersion } from '@/shared/sync/useReplicaVersion';

export interface LibraryItem {
  book: Book;
  progress: ReadingProgress | null;
}

export interface ContinueReadingItem {
  book: Book;
  progress: ReadingProgress;
}

/** Books in the user's library with progress; re-renders when the replica changes. */
export function useLibrary(): LibraryItem[] {
  const version = useReplicaVersion();
  return useMemo(() => {
    void version;
    const state = getAppState();
    return state.myBooks.flatMap((id) => {
      const book = state.bookMetadata[id];
      return book ? [{ book, progress: state.readingProgress[id] ?? null }] : [];
    });
  }, [version]);
}

/** Books started but not finished, most recent first. */
export function useContinueReading(limit = 5): ContinueReadingItem[] {
  const version = useReplicaVersion();
  return useMemo(() => {
    void version;
    const state = getAppState();
    return Object.entries(state.readingProgress)
      .flatMap(([id, progress]) => {
        const book = state.bookMetadata[id];
        return book && progress.currentPage < progress.totalPages - 1 ? [{ book, progress }] : [];
      })
      .sort((a, b) => (b.progress.lastRead ?? 0) - (a.progress.lastRead ?? 0))
      .slice(0, limit);
  }, [version, limit]);
}
