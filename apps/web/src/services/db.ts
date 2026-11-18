import type { BookmarkData, FavoriteData, QuoteData } from '@libify/shared';
import { services } from '../shared/services';
import type { Bookmark, Favorite, Quote } from '../types';
import { syncableCoverUrl } from '../utils/storage';

const byNewest = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at);
const clip = (value: string | undefined, max: number) => (value ? value.slice(0, max) : null);

// --- Quotes ---

function toQuote(d: QuoteData, updatedAt: string): Quote {
  return {
    id: d.id,
    book_id: d.bookId,
    book_title: d.bookTitle ?? undefined,
    book_author: d.bookAuthor ?? undefined,
    text: d.text,
    note: d.note ?? undefined,
    color: d.color,
    created_at: updatedAt,
  };
}

export async function addQuote(quote: { book_id: string; book_title?: string; book_author?: string; text: string; note?: string; color?: string }): Promise<Quote> {
  const data: QuoteData = {
    id: crypto.randomUUID(),
    bookId: quote.book_id,
    bookTitle: clip(quote.book_title, 500),
    bookAuthor: clip(quote.book_author, 300),
    text: quote.text.slice(0, 10_000),
    note: clip(quote.note, 5_000),
    color: quote.color ?? 'yellow',
  };
  await services().sync.record('quote', data.id, data);
  return toQuote(data, new Date().toISOString());
}

export async function deleteQuote(id: string): Promise<void> {
  await services().sync.record('quote', id, null);
}

export async function getQuotes(bookId?: string): Promise<Quote[]> {
  return services()
    .replica.list('quote')
    .filter((e) => !bookId || e.data.bookId === bookId)
    .map((e) => toQuote(e.data, e.updatedAt))
    .sort(byNewest);
}

// --- Favorites ---

function toFavorite(d: FavoriteData, updatedAt: string): Favorite {
  return {
    id: d.bookId,
    book_id: d.bookId,
    book_title: d.title,
    book_author: d.author ?? undefined,
    book_cover: d.coverUrl ?? undefined,
    created_at: updatedAt,
  };
}

export async function addFavorite(book: { id: string; title: string; author: string; cover: string }): Promise<Favorite> {
  const data: FavoriteData = {
    bookId: book.id,
    title: (book.title || 'Untitled').slice(0, 500),
    author: clip(book.author, 300),
    coverUrl: syncableCoverUrl(book.cover),
  };
  await services().sync.record('favorite', book.id, data);
  return toFavorite(data, new Date().toISOString());
}

export async function removeFavorite(bookId: string): Promise<void> {
  await services().sync.record('favorite', bookId, null);
}

export async function getFavorites(): Promise<Favorite[]> {
  return services()
    .replica.list('favorite')
    .map((e) => toFavorite(e.data, e.updatedAt))
    .sort(byNewest);
}

export async function isBookFavorite(bookId: string): Promise<boolean> {
  return services().replica.get('favorite', bookId) !== null;
}

// --- Bookmarks ---

function toBookmark(d: BookmarkData, updatedAt: string): Bookmark {
  return {
    id: d.id,
    book_id: d.bookId,
    book_title: d.bookTitle ?? undefined,
    paragraph_index: d.paragraphIndex,
    preview_text: d.previewText ?? undefined,
    created_at: updatedAt,
  };
}

export async function addBookmark(bookmark: { book_id: string; book_title?: string; paragraph_index: number; preview_text?: string }): Promise<Bookmark> {
  const existing = services()
    .replica.list('bookmark')
    .find((e) => e.data.bookId === bookmark.book_id && e.data.paragraphIndex === bookmark.paragraph_index);
  if (existing) return toBookmark(existing.data, existing.updatedAt);

  const data: BookmarkData = {
    id: crypto.randomUUID(),
    bookId: bookmark.book_id,
    bookTitle: clip(bookmark.book_title, 500),
    paragraphIndex: bookmark.paragraph_index,
    previewText: clip(bookmark.preview_text, 500),
  };
  await services().sync.record('bookmark', data.id, data);
  return toBookmark(data, new Date().toISOString());
}

export async function deleteBookmark(id: string): Promise<void> {
  await services().sync.record('bookmark', id, null);
}

export async function getBookmarks(bookId?: string): Promise<Bookmark[]> {
  return services()
    .replica.list('bookmark')
    .filter((e) => !bookId || e.data.bookId === bookId)
    .map((e) => toBookmark(e.data, e.updatedAt))
    .sort(byNewest);
}
