import { describe, expect, it, vi } from 'vitest';
import { openLibifyDb } from '../db/libifyDb';
import { MetaStore } from '../db/MetaStore';
import { importLegacyState, type LegacyRecorder } from './legacyImport';

const legacy = JSON.stringify({
  myBooks: ['10', 'ghost'],
  bookMetadata: { '10': { id: '10', title: 'Old Book', author: 'A', cover: 'data:image/png;base64,xx', format: 'fb2' } },
  readingProgress: { '10': { bookId: '10', currentPage: 40, totalPages: 100, lastRead: 1, scrollPercentage: 40 } },
  settings: { fontSize: 20 },
});

let n = 0;
async function setup(initial: string | null = legacy) {
  const meta = new MetaStore(await openLibifyDb(`test-legacy-${n++}`));
  const recorder: LegacyRecorder = { record: vi.fn(async () => {}) };
  const store = new Map<string, string>();
  if (initial !== null) store.set('book-library-state', initial);
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  return { meta, recorder, store, storage };
}

describe('importLegacyState', () => {
  it('imports old local books and progress exactly once after the user agrees', async () => {
    const { meta, recorder, store, storage } = await setup();
    const confirm = vi.fn(async () => true);

    await importLegacyState(recorder, meta, 'u1', confirm, storage);
    await importLegacyState(recorder, meta, 'u2', confirm, storage);

    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(1);
    const calls = vi.mocked(recorder.record).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([
      'book',
      '10',
      expect.objectContaining({ bookId: '10', title: 'Old Book', coverUrl: null, status: 'reading' }),
    ]);
    expect(calls[1]).toEqual([
      'progress',
      '10',
      { bookId: '10', paragraphIndex: 40, scrollRatio: 0.4, currentPage: 40, totalPages: 100 },
    ]);
    // Imported fields are removed, per-device fields stay.
    const left = JSON.parse(store.get('book-library-state')!) as Record<string, unknown>;
    expect(left.myBooks).toBeUndefined();
    expect(left.readingProgress).toBeUndefined();
    expect(left.settings).toEqual({ fontSize: 20 });
  });

  it('keeps the legacy data for another account when the user declines', async () => {
    const { meta, recorder, storage } = await setup();

    await importLegacyState(recorder, meta, 'u1', async () => false, storage);
    const askAgain = vi.fn(async () => true);
    await importLegacyState(recorder, meta, 'u1', askAgain, storage);
    expect(askAgain).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();

    await importLegacyState(recorder, meta, 'u2', askAgain, storage);
    expect(askAgain).toHaveBeenCalledOnce();
    expect(recorder.record).toHaveBeenCalledTimes(2);
  });

  it('does not ask when there is nothing to import', async () => {
    const { meta, recorder, storage } = await setup(null);
    const confirm = vi.fn(async () => true);
    await importLegacyState(recorder, meta, 'u1', confirm, storage);
    expect(confirm).not.toHaveBeenCalled();
  });
});
