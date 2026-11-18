import { sql } from 'drizzle-orm';
import { index, integer, pgEnum, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { BOOK_STATUSES, USER_ROLES } from '@libify/shared';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const userRole = pgEnum('user_role', USER_ROLES);
export const bookStatus = pgEnum('book_status', BOOK_STATUSES);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nickname: text('nickname').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('user'),
    createdAt: ts('created_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_nickname_lower_uq').on(sql`lower(${t.nickname})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/**
 * Columns shared by every synced table.
 * updated_at — client timestamp for last-write-wins.
 * synced_at  — server write time, used as the pull cursor (client clocks can lag).
 */
const syncColumns = () => ({
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  updatedAt: ts('updated_at').notNull(),
  syncedAt: ts('synced_at').notNull().defaultNow(),
  deletedAt: ts('deleted_at'),
});

export const userBooks = pgTable(
  'user_books',
  {
    ...syncColumns(),
    bookId: text('book_id').notNull(),
    title: text('title').notNull(),
    author: text('author'),
    coverUrl: text('cover_url'),
    status: bookStatus('status').notNull().default('reading'),
    format: text('format').notNull().default('fb2'),
    addedAt: ts('added_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] }), index('user_books_sync_idx').on(t.userId, t.syncedAt)],
);

export const readingProgress = pgTable(
  'reading_progress',
  {
    ...syncColumns(),
    bookId: text('book_id').notNull(),
    paragraphIndex: integer('paragraph_index').notNull().default(0),
    scrollRatio: real('scroll_ratio').notNull().default(0),
    currentPage: integer('current_page').notNull().default(0),
    totalPages: integer('total_pages').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] }), index('reading_progress_sync_idx').on(t.userId, t.syncedAt)],
);

export const quotes = pgTable(
  'quotes',
  {
    ...syncColumns(),
    id: uuid('id').primaryKey(),
    bookId: text('book_id').notNull(),
    bookTitle: text('book_title'),
    bookAuthor: text('book_author'),
    text: text('text').notNull(),
    note: text('note'),
    color: text('color').notNull().default('yellow'),
  },
  (t) => [index('quotes_sync_idx').on(t.userId, t.syncedAt)],
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    ...syncColumns(),
    id: uuid('id').primaryKey(),
    bookId: text('book_id').notNull(),
    paragraphIndex: integer('paragraph_index').notNull(),
    previewText: text('preview_text'),
  },
  (t) => [index('bookmarks_sync_idx').on(t.userId, t.syncedAt)],
);

export const favorites = pgTable(
  'favorites',
  {
    ...syncColumns(),
    bookId: text('book_id').notNull(),
    title: text('title').notNull(),
    author: text('author'),
    coverUrl: text('cover_url'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] }), index('favorites_sync_idx').on(t.userId, t.syncedAt)],
);
