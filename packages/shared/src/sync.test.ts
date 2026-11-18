import { describe, expect, it } from 'vitest';
import { syncKeyOf, syncPushRequestSchema } from './sync';

const book = {
  bookId: '123',
  title: 'Book',
  author: null,
  coverUrl: null,
  status: 'reading',
  format: 'fb2',
  addedAt: '2026-11-18T10:00:00.000Z',
} as const;

describe('syncKeyOf', () => {
  it('uses bookId for book-keyed entities', () => {
    expect(syncKeyOf('book', book)).toBe('123');
  });
  it('uses id for quotes', () => {
    const id = '0b0d7f5e-8a51-4a6a-9a8a-5f1d6c1d2e3f';
    expect(
      syncKeyOf('quote', { id, bookId: '1', bookTitle: null, bookAuthor: null, text: 't', note: null, color: 'yellow' }),
    ).toBe(id);
  });
});

describe('syncPushRequestSchema', () => {
  it('accepts upsert and delete ops', () => {
    const parsed = syncPushRequestSchema.parse({
      ops: [
        { entity: 'book', key: '123', clientUpdatedAt: '2026-11-18T10:00:00.000Z', data: book },
        { entity: 'favorite', key: '9', clientUpdatedAt: '2026-11-18T10:00:00.000Z', data: null },
      ],
    });
    expect(parsed.ops).toHaveLength(2);
  });
  it('rejects unknown entity', () => {
    expect(() =>
      syncPushRequestSchema.parse({ ops: [{ entity: 'x', key: '1', clientUpdatedAt: '2026-11-18T10:00:00.000Z', data: null }] }),
    ).toThrow();
  });
  it('rejects more than 200 ops', () => {
    const op = { entity: 'favorite', key: '9', clientUpdatedAt: '2026-11-18T10:00:00.000Z', data: null };
    expect(() => syncPushRequestSchema.parse({ ops: Array.from({ length: 201 }, () => op) })).toThrow();
  });
});
