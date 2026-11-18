import { z } from 'zod';
import { BOOK_STATUSES, SYNC_ENTITIES, SYNC_PUSH_MAX_OPS } from './constants';

export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export type BookStatus = (typeof BOOK_STATUSES)[number];

const bookId = z.string().min(1).max(64);
const nullableText = (max: number) => z.string().max(max).nullable();

export const bookDataSchema = z.object({
  bookId,
  title: z.string().min(1).max(500),
  author: nullableText(300),
  coverUrl: nullableText(2048),
  status: z.enum(BOOK_STATUSES),
  format: z.string().min(1).max(16),
  addedAt: z.iso.datetime(),
});

export const progressDataSchema = z.object({
  bookId,
  paragraphIndex: z.number().int().min(0),
  scrollRatio: z.number().min(0).max(1),
  currentPage: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export const quoteDataSchema = z.object({
  id: z.uuid(),
  bookId,
  bookTitle: nullableText(500),
  bookAuthor: nullableText(300),
  text: z.string().min(1).max(10_000),
  note: nullableText(5_000),
  color: z.string().min(1).max(16),
});

export const bookmarkDataSchema = z.object({
  id: z.uuid(),
  bookId,
  bookTitle: nullableText(500),
  paragraphIndex: z.number().int().min(0),
  previewText: nullableText(500),
});

export const favoriteDataSchema = z.object({
  bookId,
  title: z.string().min(1).max(500),
  author: nullableText(300),
  coverUrl: nullableText(2048),
});

export type BookData = z.infer<typeof bookDataSchema>;
export type ProgressData = z.infer<typeof progressDataSchema>;
export type QuoteData = z.infer<typeof quoteDataSchema>;
export type BookmarkData = z.infer<typeof bookmarkDataSchema>;
export type FavoriteData = z.infer<typeof favoriteDataSchema>;

export interface SyncDataMap {
  book: BookData;
  progress: ProgressData;
  quote: QuoteData;
  bookmark: BookmarkData;
  favorite: FavoriteData;
}

const opFor = <E extends SyncEntity, S extends z.ZodType>(entity: E, data: S) =>
  z.object({
    entity: z.literal(entity),
    key: z.string().min(1).max(64),
    clientUpdatedAt: z.iso.datetime(),
    /** null = delete (tombstone) */
    data: data.nullable(),
  });

export const syncOpSchema = z.discriminatedUnion('entity', [
  opFor('book', bookDataSchema),
  opFor('progress', progressDataSchema),
  opFor('quote', quoteDataSchema),
  opFor('bookmark', bookmarkDataSchema),
  opFor('favorite', favoriteDataSchema),
]);
export type SyncOp = z.infer<typeof syncOpSchema>;

export const syncPushRequestSchema = z.object({ ops: z.array(syncOpSchema).min(1).max(SYNC_PUSH_MAX_OPS) });
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export interface SyncRejection {
  entity: SyncEntity;
  key: string;
  reason: 'STALE' | 'KEY_MISMATCH';
}

export interface SyncPushResponse {
  applied: number;
  rejected: SyncRejection[];
  serverTime: string;
}

export const syncPullQuerySchema = z.object({ since: z.iso.datetime().optional() });

export type SyncChange = {
  [E in SyncEntity]: { entity: E; key: string; updatedAt: string; data: SyncDataMap[E] | null };
}[SyncEntity];

export interface SyncPullResponse {
  serverTime: string;
  changes: SyncChange[];
}

/** Natural key of a record: bookId for per-book entities, id for quotes/bookmarks. */
export function syncKeyOf<E extends SyncEntity>(entity: E, data: SyncDataMap[E]): string {
  if (entity === 'quote' || entity === 'bookmark') return (data as QuoteData | BookmarkData).id;
  return (data as BookData | ProgressData | FavoriteData).bookId;
}
