import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { SyncPullResponse, SyncPushResponse } from '@libify/shared';
import { createTestContext, type TestClient } from './helpers';

const ctx = await createTestContext();
afterAll(() => ctx.close());

let alice: TestClient;
let bob: TestClient;

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
  alice = ctx.client();
  bob = ctx.client();
  await alice.post('/api/auth/register', { nickname: 'alice', password: 'password1' });
  await bob.post('/api/auth/register', { nickname: 'bob_b', password: 'password1' });
});

const book = (title: string) => ({
  bookId: '42',
  title,
  author: 'Author',
  coverUrl: null,
  status: 'reading',
  format: 'fb2',
  addedAt: '2026-11-18T09:00:00.000Z',
});
const at = (minute: number) => `2026-11-18T10:${String(minute).padStart(2, '0')}:00.000Z`;

async function push(client: TestClient, ops: unknown[]): Promise<SyncPushResponse> {
  const res = await client.post('/api/sync/push', { ops });
  expect(res.status).toBe(200);
  return res.json();
}
async function pull(client: TestClient, since?: string): Promise<SyncPullResponse> {
  const res = await client.get(`/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`);
  expect(res.status).toBe(200);
  return res.json();
}

describe('sync', () => {
  it('requires authentication', async () => {
    expect((await ctx.client().get('/api/sync/pull')).status).toBe(401);
  });

  it('pushes an upsert and pulls it back', async () => {
    const result = await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(1), data: book('First') }]);
    expect(result).toMatchObject({ applied: 1, rejected: [] });
    const { changes } = await pull(alice);
    expect(changes).toEqual([{ entity: 'book', key: '42', updatedAt: at(1), data: book('First') }]);
  });

  it('applies last-write-wins and rejects stale writes', async () => {
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(5), data: book('Newer') }]);
    const stale = await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(3), data: book('Older') }]);
    expect(stale.rejected).toEqual([{ entity: 'book', key: '42', reason: 'STALE' }]);
    const { changes } = await pull(alice);
    expect(changes[0]?.data).toMatchObject({ title: 'Newer' });
  });

  it('deletes via tombstone visible to incremental pull but not to initial pull', async () => {
    const first = await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(1), data: book('X') }]);
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(2), data: null }]);
    const incremental = await pull(alice, first.serverTime);
    expect(incremental.changes).toEqual([{ entity: 'book', key: '42', updatedAt: at(2), data: null }]);
    expect((await pull(alice)).changes).toEqual([]);
  });

  it('re-creates a deleted record when a newer upsert arrives', async () => {
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(1), data: book('X') }]);
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(2), data: null }]);
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(3), data: book('Back') }]);
    expect((await pull(alice)).changes[0]?.data).toMatchObject({ title: 'Back' });
  });

  it('rejects ops whose key does not match the data', async () => {
    const r = await push(alice, [{ entity: 'book', key: '999', clientUpdatedAt: at(1), data: book('X') }]);
    expect(r.rejected).toEqual([{ entity: 'book', key: '999', reason: 'KEY_MISMATCH' }]);
  });

  it('isolates users, including id-keyed quotes', async () => {
    const id = '0b0d7f5e-8a51-4a6a-9a8a-5f1d6c1d2e3f';
    const quote = (text: string) => ({ id, bookId: '42', bookTitle: null, bookAuthor: null, text, note: null, color: 'yellow' });
    await push(alice, [{ entity: 'quote', key: id, clientUpdatedAt: at(1), data: quote('alice') }]);
    const hijack = await push(bob, [{ entity: 'quote', key: id, clientUpdatedAt: at(9), data: quote('bob') }]);
    expect(hijack.rejected).toEqual([{ entity: 'quote', key: id, reason: 'STALE' }]);
    expect((await pull(bob)).changes).toEqual([]);
    expect((await pull(alice)).changes[0]?.data).toMatchObject({ text: 'alice' });
  });

  it('syncs every entity type', async () => {
    const qid = '1b0d7f5e-8a51-4a6a-9a8a-5f1d6c1d2e3f';
    const bid = '2b0d7f5e-8a51-4a6a-9a8a-5f1d6c1d2e3f';
    const r = await push(alice, [
      { entity: 'book', key: '42', clientUpdatedAt: at(1), data: book('B') },
      { entity: 'progress', key: '42', clientUpdatedAt: at(1), data: { bookId: '42', paragraphIndex: 10, scrollRatio: 0.5, currentPage: 3, totalPages: 9 } },
      { entity: 'quote', key: qid, clientUpdatedAt: at(1), data: { id: qid, bookId: '42', bookTitle: 'B', bookAuthor: null, text: 'q', note: null, color: 'blue' } },
      { entity: 'bookmark', key: bid, clientUpdatedAt: at(1), data: { id: bid, bookId: '42', paragraphIndex: 7, previewText: 'p' } },
      { entity: 'favorite', key: '42', clientUpdatedAt: at(1), data: { bookId: '42', title: 'B', author: null, coverUrl: null } },
    ]);
    expect(r.applied).toBe(5);
    const entities = (await pull(alice)).changes.map((c) => c.entity).sort();
    expect(entities).toEqual(['book', 'bookmark', 'favorite', 'progress', 'quote']);
  });

  it('clamps client timestamps from the future', async () => {
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: '2099-01-01T00:00:00.000Z', data: book('Future') }]);
    const { changes } = await pull(alice);
    expect(new Date(changes[0]!.updatedAt).getFullYear()).toBe(2026);
  });
});
