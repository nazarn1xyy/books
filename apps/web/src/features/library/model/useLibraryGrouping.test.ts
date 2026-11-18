import { describe, expect, it } from 'vitest';
import type { Book } from '@/entities/book/model/types';
import { groupLibrary } from './useLibraryGrouping';
import type { LibraryItem } from './useLibrary';

const item = (id: string, title: string, author: string, lastRead: number, series?: string, seriesNumber?: number): LibraryItem => ({
  book: { id, title, author, cover: '', description: '', genre: '', contentUrl: '', series, seriesNumber } as Book,
  progress: { bookId: id, currentPage: 0, totalPages: 10, lastRead },
});

const names = (entries: ReturnType<typeof groupLibrary>) =>
  entries.map((e) => (e.type === 'book' ? e.item.book.title : `[${e.name}]`));

describe('groupLibrary', () => {
  const items = [
    item('1', 'banana', 'Bob', 100),
    item('2', 'Apple', 'zoe', 300),
    item('3', 'Part Two', 'Ann', 50, 'Saga', 2),
    item('4', 'Part One', 'Ann', 400, 'Saga', 1),
  ];

  it('sorts by last read, a series by its most recent book', () => {
    expect(names(groupLibrary(items, 'date'))).toEqual(['[Saga]', 'Apple', 'banana']);
  });

  it('sorts by title case-insensitively, a series by its first book', () => {
    expect(names(groupLibrary(items, 'title'))).toEqual(['Apple', 'banana', '[Saga]']);
  });

  it('sorts by author case-insensitively', () => {
    expect(names(groupLibrary(items, 'author'))).toEqual(['[Saga]', 'banana', 'Apple']);
  });

  it('orders books inside a series by series number', () => {
    const saga = groupLibrary(items, 'date').find((e) => e.type === 'series');
    expect(saga?.type === 'series' && saga.books.map((b) => b.book.title)).toEqual(['Part One', 'Part Two']);
  });
});
