import type { BookData, BookmarkData, FavoriteData, ProgressData, QuoteData } from '@libify/shared';
import { bookmarks, favorites, quotes, readingProgress, userBooks } from '../../db/schema';
import { BaseSyncRepository } from './base-sync.repository';

type BookRow = typeof userBooks.$inferSelect;
type ProgressRow = typeof readingProgress.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;
type BookmarkRow = typeof bookmarks.$inferSelect;
type FavoriteRow = typeof favorites.$inferSelect;

export class BookSyncRepository extends BaseSyncRepository<BookData, BookRow> {
  protected readonly table = userBooks;
  protected readonly keyColumn = userBooks.bookId;
  protected readonly conflictTarget = [userBooks.userId, userBooks.bookId];

  protected toValues(d: BookData) {
    return {
      bookId: d.bookId,
      title: d.title,
      author: d.author,
      coverUrl: d.coverUrl,
      status: d.status,
      format: d.format,
      addedAt: new Date(d.addedAt),
    };
  }
  protected fromRow(r: BookRow): BookData {
    return {
      bookId: r.bookId,
      title: r.title,
      author: r.author,
      coverUrl: r.coverUrl,
      status: r.status,
      format: r.format,
      addedAt: r.addedAt.toISOString(),
    };
  }
  protected keyOf(r: BookRow) {
    return r.bookId;
  }
}

export class ProgressSyncRepository extends BaseSyncRepository<ProgressData, ProgressRow> {
  protected readonly table = readingProgress;
  protected readonly keyColumn = readingProgress.bookId;
  protected readonly conflictTarget = [readingProgress.userId, readingProgress.bookId];

  protected toValues(d: ProgressData) {
    return { ...d };
  }
  protected fromRow(r: ProgressRow): ProgressData {
    return {
      bookId: r.bookId,
      paragraphIndex: r.paragraphIndex,
      scrollRatio: r.scrollRatio,
      currentPage: r.currentPage,
      totalPages: r.totalPages,
    };
  }
  protected keyOf(r: ProgressRow) {
    return r.bookId;
  }
}

export class QuoteSyncRepository extends BaseSyncRepository<QuoteData, QuoteRow> {
  protected readonly table = quotes;
  protected readonly keyColumn = quotes.id;
  protected readonly conflictTarget = [quotes.id];

  protected toValues(d: QuoteData) {
    return { ...d };
  }
  protected fromRow(r: QuoteRow): QuoteData {
    return {
      id: r.id,
      bookId: r.bookId,
      bookTitle: r.bookTitle,
      bookAuthor: r.bookAuthor,
      text: r.text,
      note: r.note,
      color: r.color,
    };
  }
  protected keyOf(r: QuoteRow) {
    return r.id;
  }
}

export class BookmarkSyncRepository extends BaseSyncRepository<BookmarkData, BookmarkRow> {
  protected readonly table = bookmarks;
  protected readonly keyColumn = bookmarks.id;
  protected readonly conflictTarget = [bookmarks.id];

  protected toValues(d: BookmarkData) {
    return { ...d };
  }
  protected fromRow(r: BookmarkRow): BookmarkData {
    return { id: r.id, bookId: r.bookId, paragraphIndex: r.paragraphIndex, previewText: r.previewText };
  }
  protected keyOf(r: BookmarkRow) {
    return r.id;
  }
}

export class FavoriteSyncRepository extends BaseSyncRepository<FavoriteData, FavoriteRow> {
  protected readonly table = favorites;
  protected readonly keyColumn = favorites.bookId;
  protected readonly conflictTarget = [favorites.userId, favorites.bookId];

  protected toValues(d: FavoriteData) {
    return { ...d };
  }
  protected fromRow(r: FavoriteRow): FavoriteData {
    return { bookId: r.bookId, title: r.title, author: r.author, coverUrl: r.coverUrl };
  }
  protected keyOf(r: FavoriteRow) {
    return r.bookId;
  }
}
