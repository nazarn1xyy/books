import { describe, expect, it, vi } from 'vitest';
import { openLibifyDb } from '../db/libifyDb';
import { MetaStore } from '../db/MetaStore';
import { importLegacyState, type LegacyRecorder } from './legacyImport';

const legacy = JSON.stringify({
  myBooks: ['10', 'ghost'],
  bookMetadata: { '10': { id: '10', title: 'Old Book', author: 'A', cover: 'data:image/png;base64,xx', format: 'fb2' } },
  readingProgress: { '10': { bookId: '10', currentPage: 40, totalPages: 100, lastRead: 1, scrollPercentage: 40 } },
});

describe('importLegacyState', () => {
  it('imports old local books and progress exactly once', async () => {
    const meta = new MetaStore(await openLibifyDb('test-legacy'));
    const recorder: LegacyRecorder = { record: vi.fn(async () => {}) };
    const storage = { getItem: () => legacy };

    await importLegacyState(recorder, meta, storage);
    await importLegacyState(recorder, meta, storage);

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
  });
});
