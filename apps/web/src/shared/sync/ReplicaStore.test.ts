import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openLibifyDb, type LibifyDatabase } from '@/shared/db/libifyDb';
import { ReplicaStore } from './ReplicaStore';

const fav = (bookId: string, title = 'T') => ({ bookId, title, author: null, coverUrl: null });
let db: LibifyDatabase;
let n = 0;

beforeEach(async () => {
  db = await openLibifyDb(`test-replica-${n++}`);
});

describe('ReplicaStore', () => {
  it('applies newer records and ignores older or equal ones', async () => {
    const store = await ReplicaStore.load(db);
    await store.apply([{ entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:02.000Z', data: fav('1', 'new') }]);
    const changed = await store.apply([
      { entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('1', 'old') },
      { entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:02.000Z', data: fav('1', 'same') },
    ]);
    expect(changed).toBe(false);
    expect(store.get('favorite', '1')?.title).toBe('new');
  });

  it('hides tombstones from get and list', async () => {
    const store = await ReplicaStore.load(db);
    await store.apply([
      { entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('1') },
      { entity: 'favorite', key: '2', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('2') },
    ]);
    await store.apply([{ entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:02.000Z', data: null }]);
    expect(store.get('favorite', '1')).toBeNull();
    expect(store.list('favorite').map((r) => r.key)).toEqual(['2']);
    expect(store.getRecord('favorite', '1')?.data).toBeNull();
  });

  it('persists to IndexedDB and reloads', async () => {
    const store = await ReplicaStore.load(db);
    await store.apply([{ entity: 'favorite', key: '9', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('9') }]);
    const reloaded = await ReplicaStore.load(db);
    expect(reloaded.get('favorite', '9')?.bookId).toBe('9');
  });

  it('updates memory synchronously and notifies subscribers', async () => {
    const store = await ReplicaStore.load(db);
    const listener = vi.fn();
    store.subscribe(listener);
    const pending = store.apply([{ entity: 'favorite', key: '3', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('3') }]);
    expect(store.get('favorite', '3')).not.toBeNull();
    await pending;
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getVersion()).toBe(1);
  });

  it('clear() wipes memory and storage', async () => {
    const store = await ReplicaStore.load(db);
    await store.apply([{ entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('1') }]);
    await store.clear();
    expect(store.list('favorite')).toEqual([]);
    expect((await ReplicaStore.load(db)).list('favorite')).toEqual([]);
  });
});
