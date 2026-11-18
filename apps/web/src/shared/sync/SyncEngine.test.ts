import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncOp, SyncPullResponse, SyncPushResponse } from '@libify/shared';
import { ApiError } from '../api/ApiError';
import type { SyncApi } from '../api/SyncApi';
import { openLibifyDb } from '../db/libifyDb';
import { MetaStore } from '../db/MetaStore';
import { Outbox } from './Outbox';
import { ReplicaStore } from './ReplicaStore';
import { SyncEngine, type SyncSignals } from './SyncEngine';

class FakeSyncApi {
  pushed: SyncOp[][] = [];
  pullSince: Array<string | null> = [];
  pushImpl: (ops: SyncOp[]) => Promise<SyncPushResponse> = async (ops) => {
    this.pushed.push(ops);
    return { applied: ops.length, rejected: [], serverTime: '2026-01-01T00:00:10.000Z' };
  };
  pullImpl: (since: string | null) => Promise<SyncPullResponse> = async () => ({
    serverTime: '2026-01-01T00:00:10.000Z',
    changes: [],
  });
  push(ops: SyncOp[]) {
    return this.pushImpl(ops);
  }
  pull(since: string | null) {
    this.pullSince.push(since);
    return this.pullImpl(since);
  }
}

const noSignals: SyncSignals = { subscribe: () => () => {} };
const fav = (bookId: string) => ({ bookId, title: 'T', author: null, coverUrl: null });

let n = 0;
async function setup() {
  const db = await openLibifyDb(`test-engine-${n++}`);
  const api = new FakeSyncApi();
  const replica = await ReplicaStore.load(db);
  const outbox = new Outbox(db);
  const meta = new MetaStore(db);
  const engine = new SyncEngine({ api: api as unknown as SyncApi, replica, outbox, meta, signals: noSignals });
  return { api, replica, outbox, meta, engine };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('SyncEngine', () => {
  it('records locally, then pushes and pulls on sync', async () => {
    const { api, replica, outbox, engine } = await setup();
    await engine.start('u1');
    await engine.record('favorite', '1', fav('1'));
    expect(replica.get('favorite', '1')?.bookId).toBe('1');
    expect(await outbox.size()).toBe(1);

    await engine.syncNow();
    expect(api.pushed.flat().map((o) => o.key)).toEqual(['1']);
    expect(await outbox.size()).toBe(0);
    expect(api.pullSince.at(-1)).toBe('2026-01-01T00:00:10.000Z');
    engine.stop();
  });

  it('issues strictly increasing timestamps for rapid writes', async () => {
    const { replica, engine } = await setup();
    await engine.record('favorite', '1', fav('1'));
    const first = replica.getRecord('favorite', '1')!.updatedAt;
    await engine.record('favorite', '1', null);
    expect(replica.getRecord('favorite', '1')!.updatedAt > first).toBe(true);
    expect(replica.get('favorite', '1')).toBeNull();
  });

  it('rejects records that violate the shared schema', async () => {
    const { engine, outbox } = await setup();
    await expect(engine.record('favorite', '1', { bookId: '1', title: '', author: null, coverUrl: null })).rejects.toThrow();
    expect(await outbox.size()).toBe(0);
  });

  it('merges pulled changes with last-write-wins', async () => {
    const { api, replica, engine } = await setup();
    api.pullImpl = async () => ({
      serverTime: '2026-01-01T00:00:10.000Z',
      changes: [{ entity: 'favorite', key: '7', updatedAt: '2026-01-01T00:00:05.000Z', data: fav('7') }],
    });
    await engine.start('u1');
    expect(replica.get('favorite', '7')?.bookId).toBe('7');
    engine.stop();
  });

  it('keeps the outbox when offline and reports offline status', async () => {
    const { api, outbox, engine } = await setup();
    await engine.start('u1');
    api.pushImpl = async () => {
      throw new ApiError('NETWORK', 0, 'offline');
    };
    await engine.record('favorite', '1', fav('1'));
    await engine.syncNow();
    expect(await outbox.size()).toBe(1);
    expect(engine.getStatus()).toBe('offline');
    engine.stop();
  });

  it('drops a batch the server refuses as invalid instead of retrying forever', async () => {
    const { api, outbox, engine } = await setup();
    await engine.start('u1');
    api.pushImpl = async () => {
      throw new ApiError('VALIDATION_FAILED', 400, 'bad');
    };
    await engine.record('favorite', '1', fav('1'));
    await engine.syncNow();
    expect(await outbox.size()).toBe(0);
    engine.stop();
  });

  it('wipes local data when a different user starts', async () => {
    const { replica, engine } = await setup();
    await engine.start('u1');
    await engine.record('favorite', '1', fav('1'));
    engine.stop();
    await engine.start('u2');
    expect(replica.get('favorite', '1')).toBeNull();
    engine.stop();
  });

  it('discards a pull that resolves after stop and reset', async () => {
    const { api, replica, meta, engine } = await setup();
    await engine.start('u1');
    let release: () => void = () => {};
    api.pullImpl = () =>
      new Promise((resolve) => {
        release = () =>
          resolve({
            serverTime: '2026-01-01T00:00:20.000Z',
            changes: [{ entity: 'favorite', key: '9', updatedAt: '2026-01-01T00:00:05.000Z', data: fav('9') }],
          });
      });
    const inFlight = engine.syncNow();
    await vi.waitFor(() => expect(api.pullSince.length).toBe(2));
    engine.stop();
    await engine.resetLocalData();
    release();
    await inFlight;
    expect(replica.get('favorite', '9')).toBeNull();
    expect(await meta.get('sync.cursor')).toBeUndefined();
  });

  it('reports pending changes', async () => {
    const { engine } = await setup();
    expect(await engine.pendingCount()).toBe(0);
    await engine.record('favorite', '1', fav('1'));
    expect(await engine.pendingCount()).toBe(1);
  });

  it('coalesces concurrent syncNow calls', async () => {
    const { api, engine } = await setup();
    await engine.start('u1');
    const before = api.pullSince.length;
    await Promise.all([engine.syncNow(), engine.syncNow(), engine.syncNow()]);
    expect(api.pullSince.length - before).toBeLessThanOrEqual(2);
    engine.stop();
  });
});
