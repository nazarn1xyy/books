import { useMemo } from 'react';
import type { LibraryItem } from './useLibrary';

export type LibrarySort = 'date' | 'title' | 'author';

export type LibraryEntry =
  | { type: 'book'; item: LibraryItem }
  | { type: 'series'; name: string; books: LibraryItem[] };

const firstBook = (entry: LibraryEntry) => (entry.type === 'book' ? entry.item.book : entry.books[0]?.book);
const lastRead = (entry: LibraryEntry) =>
  entry.type === 'book'
    ? (entry.item.progress?.lastRead ?? 0)
    : Math.max(...entry.books.map((b) => b.progress?.lastRead ?? 0));

/**
 * Books of one series are grouped (ordered by series number); singles stay as they are.
 * `date` sorts by last read (most recent first), `title`/`author` alphabetically (case-insensitive).
 */
export function groupLibrary(items: LibraryItem[], sortBy: LibrarySort): LibraryEntry[] {
  const entries: LibraryEntry[] = [];
  const series = new Map<string, LibraryItem[]>();
  for (const item of items) {
    const name = item.book.series;
    if (!name) {
      entries.push({ type: 'book', item });
      continue;
    }
    const books = series.get(name) ?? [];
    books.push(item);
    series.set(name, books);
  }
  for (const [name, books] of series) {
    books.sort((a, b) => (a.book.seriesNumber ?? 0) - (b.book.seriesNumber ?? 0));
    entries.push({ type: 'series', name, books });
  }

  return entries.sort((a, b) => {
    if (sortBy === 'title' || sortBy === 'author') {
      const key = sortBy;
      return (firstBook(a)?.[key] || '').localeCompare(firstBook(b)?.[key] || '', undefined, { sensitivity: 'base' });
    }
    return lastRead(b) - lastRead(a);
  });
}

export function useLibraryGrouping(items: LibraryItem[], sortBy: LibrarySort): LibraryEntry[] {
  return useMemo(() => groupLibrary(items, sortBy), [items, sortBy]);
}
