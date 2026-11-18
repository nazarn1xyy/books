import type { BookData, ProgressData, SyncDataMap, SyncEntity } from '@libify/shared';
import type { MetaStore } from '../db/MetaStore';

const LEGACY_KEY = 'book-library-state';
const META_DONE = 'legacy.imported';

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

/** One-time upload of books/progress that lived only in localStorage before v2 (cloud data was lost). */
export async function importLegacyState(
  recorder: LegacyRecorder,
  meta: MetaStore,
  storage: Pick<Storage, 'getItem'> = localStorage,
): Promise<void> {
  if (await meta.get<boolean>(META_DONE)) return;

  let state: LegacyState = {};
  try {
    state = JSON.parse(storage.getItem(LEGACY_KEY) ?? '{}') as LegacyState;
  } catch {
    // corrupted legacy state: nothing to import
  }

  const now = new Date().toISOString();
  for (const id of state.myBooks ?? []) {
    const book = state.bookMetadata?.[id];
    if (!book) continue;
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
}
