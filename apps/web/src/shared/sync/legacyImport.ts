import type { BookData, ProgressData, SyncDataMap, SyncEntity } from '@libify/shared';
import type { MetaStore } from '../db/MetaStore';

const LEGACY_KEY = 'book-library-state';
const META_DONE = 'legacy.imported';
const META_DECLINED_PREFIX = 'legacy.declined:';

export interface LegacyRecorder {
  record<E extends SyncEntity>(entity: E, key: string, data: SyncDataMap[E] | null): Promise<void>;
}

interface LegacyState {
  myBooks?: string[];
  bookMetadata?: Record<string, { id: string; title?: string; author?: string; cover?: string; format?: string }>;
  readingProgress?: Record<string, { currentPage?: number; totalPages?: number; scrollPercentage?: number }>;
}

const isRemoteUrl = (value: string | undefined): value is string =>
  !!value && value.length <= 2048 && !value.startsWith('data:') && !value.startsWith('blob:');

/** Fields of the pre-v2 localStorage state that move to the synced replica. */
export const LEGACY_SYNCED_FIELDS = ['myBooks', 'readingProgress'] as const;

/** Asks whether the legacy books (count) belong to the current account. */
export type ConfirmLegacyImport = (bookCount: number) => boolean | Promise<boolean>;

function readLegacy(storage: Pick<Storage, 'getItem'>): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(LEGACY_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {}; // corrupted legacy state: nothing to import
  }
}

/**
 * One-time upload of books/progress that lived only in localStorage before v2 (cloud data was lost).
 * The device may be shared, so the user confirms the data is theirs; a refusal is remembered per account
 * and the data stays for another account to claim.
 */
export async function importLegacyState(
  recorder: LegacyRecorder,
  meta: MetaStore,
  userId: string,
  confirmImport: ConfirmLegacyImport,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): Promise<void> {
  const declinedKey = `${META_DECLINED_PREFIX}${userId}`;
  if ((await meta.get<boolean>(META_DONE)) || (await meta.get<boolean>(declinedKey))) return;

  const raw = readLegacy(storage);
  const state = raw as LegacyState;
  const bookIds = (state.myBooks ?? []).filter((id) => state.bookMetadata?.[id]);
  if (bookIds.length === 0) {
    await meta.set(META_DONE, true);
    return;
  }
  if (!(await confirmImport(bookIds.length))) {
    await meta.set(declinedKey, true);
    return;
  }

  const now = new Date().toISOString();
  for (const id of bookIds) {
    const book = state.bookMetadata![id];
    const data: BookData = {
      bookId: id,
      title: (book.title || 'Untitled').slice(0, 500),
      author: book.author ? book.author.slice(0, 300) : null,
      coverUrl: isRemoteUrl(book.cover) ? book.cover : null,
      status: 'reading',
      format: book.format === 'pdf' ? 'pdf' : 'fb2',
      addedAt: now,
    };
    await recorder.record('book', id, data).catch((err) => console.warn('[legacy] book skipped', id, err));

    const progress = state.readingProgress?.[id];
    if (progress) {
      const page = Math.max(0, Math.floor(progress.currentPage ?? 0));
      const data: ProgressData = {
        bookId: id,
        paragraphIndex: page,
        scrollRatio: Math.min(1, Math.max(0, (progress.scrollPercentage ?? 0) / 100)),
        currentPage: page,
        totalPages: Math.max(0, Math.floor(progress.totalPages ?? 0)),
      };
      await recorder.record('progress', id, data).catch((err) => console.warn('[legacy] progress skipped', id, err));
    }
  }
  await meta.set(META_DONE, true);

  const rest = { ...readLegacy(storage) };
  for (const field of LEGACY_SYNCED_FIELDS) delete rest[field];
  try {
    storage.setItem(LEGACY_KEY, JSON.stringify(rest));
  } catch (err) {
    console.warn('[legacy] could not clean up imported fields', err);
  }
}
