import type { Book, ReadingProgress } from '@/entities/book/model/types';
import { getAppState, getBookMetadata } from '@/shared/storage/storage';
import { cachedByVersion, useStorageVersion } from '@/shared/storage/useStorageVersion';

export interface LibraryItem {
  book: Book;
  progress: ReadingProgress | null;
}

export interface ContinueReadingItem {
  book: Book;
  progress: ReadingProgress;
}

const libraryAt = cachedByVersion((): LibraryItem[] => {
  const state = getAppState();
  return state.myBooks.flatMap((id) => {
    const book = state.bookMetadata[id];
    return book ? [{ book, progress: state.readingProgress[id] ?? null }] : [];
  });
});

const inProgressAt = cachedByVersion((): ContinueReadingItem[] => {
  const state = getAppState();
  return Object.entries(state.readingProgress)
    .flatMap(([id, progress]) => {
      // Not only library books: a book removed from My Books keeps its progress and local metadata.
      const book = getBookMetadata(id);
      return book && progress.currentPage < progress.totalPages - 1 ? [{ book, progress }] : [];
    })
    .sort((a, b) => (b.progress.lastRead ?? 0) - (a.progress.lastRead ?? 0));
});

/** Books in the user's library with progress; re-renders when local data changes. */
export function useLibrary(): LibraryItem[] {
  return libraryAt(useStorageVersion());
}

/** Books started but not finished, most recent first. */
export function useContinueReading(limit = 5): ContinueReadingItem[] {
  return inProgressAt(useStorageVersion()).slice(0, limit);
}
