import { SYNC_PUSH_MAX_OPS, syncOpSchema, type SyncDataMap, type SyncEntity } from '@libify/shared';
import { ApiError } from '../api/ApiError';
import type { SyncApi } from '../api/SyncApi';
import type { MetaStore } from '../db/MetaStore';
import type { Outbox } from './Outbox';
import type { ReplicaStore } from './ReplicaStore';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

/** Something that tells the engine "now is a good moment to sync" (back online, tab visible...). */
export interface SyncSignals {
  subscribe(trigger: () => void): () => void;
}

export interface SyncEngineDeps {
  api: SyncApi;
  replica: ReplicaStore;
  outbox: Outbox;
  meta: MetaStore;
  signals: SyncSignals;
}

const META_CURSOR = 'sync.cursor';
const META_OWNER = 'sync.ownerId';

export class SyncEngine {
  static readonly PULL_INTERVAL_MS = 60_000;
  static readonly PUSH_DEBOUNCE_MS = 2_000;
  static readonly MAX_RETRY_DELAY_MS = 5 * 60_000;

  private readonly deps: SyncEngineDeps;
  private userId: string | null = null;
  /** Bumped by stop(): results of a run started under an older generation are discarded. */
  private generation = 0;
  private running: Promise<void> | null = null;
  private rerunRequested = false;
  private failures = 0;
  private lastIssuedMs = 0;
  private status: SyncStatus = 'idle';
  private readonly statusListeners = new Set<(status: SyncStatus) => void>();
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pullInterval: ReturnType<typeof setInterval> | null = null;
  private unsubscribeSignals: (() => void) | null = null;

  constructor(deps: SyncEngineDeps) {
    this.deps = deps;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Begins syncing for a user. Local data of a different previous user is wiped first. */
  async start(userId: string): Promise<void> {
    this.stop();
    const owner = await this.deps.meta.get<string>(META_OWNER);
    if (owner && owner !== userId) await this.resetLocalData();
    await this.deps.meta.set(META_OWNER, userId);

    this.userId = userId;
    this.unsubscribeSignals = this.deps.signals.subscribe(() => void this.syncNow());
    this.pullInterval = setInterval(() => void this.syncNow(), SyncEngine.PULL_INTERVAL_MS);
    await this.syncNow();
  }

  stop(): void {
    this.userId = null;
    this.generation += 1;
    this.unsubscribeSignals?.();
    this.unsubscribeSignals = null;
    for (const timer of [this.pushTimer, this.retryTimer]) if (timer) clearTimeout(timer);
    if (this.pullInterval) clearInterval(this.pullInterval);
    this.pushTimer = this.retryTimer = this.pullInterval = null;
  }

  /** Number of local changes not yet confirmed by the server. */
  pendingCount(): Promise<number> {
    return this.deps.outbox.size();
  }

  async resetLocalData(): Promise<void> {
    await Promise.all([
      this.deps.replica.clear(),
      this.deps.outbox.clear(),
      this.deps.meta.delete(META_CURSOR),
      this.deps.meta.delete(META_OWNER),
    ]);
  }

  /** Writes a local change (null = delete). Memory is updated before the returned promise settles. */
  async record<E extends SyncEntity>(entity: E, key: string, data: SyncDataMap[E] | null): Promise<void> {
    const updatedAt = this.nextTimestamp(this.deps.replica.getRecord(entity, key)?.updatedAt);
    const parsed = syncOpSchema.safeParse({ entity, key, clientUpdatedAt: updatedAt, data });
    if (!parsed.success) throw new Error(`Invalid ${entity} record: ${parsed.error.message}`);

    await this.deps.replica.apply([{ entity, key, updatedAt, data }]);
    await this.deps.outbox.put(parsed.data);
    this.schedulePush();
  }

  /** Push pending changes, then pull. Concurrent calls share one run (plus at most one follow-up). */
  syncNow(): Promise<void> {
    if (!this.userId) return Promise.resolve();
    if (this.running) {
      this.rerunRequested = true;
      return this.running;
    }
    this.running = this.runLoop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runLoop(): Promise<void> {
    do {
      this.rerunRequested = false;
      await this.syncOnce();
    } while (this.rerunRequested && this.userId);
  }

  private async syncOnce(): Promise<void> {
    const generation = this.generation;
    this.setStatus('syncing');
    try {
      await this.pushAll(generation);
      await this.pull(generation);
      if (generation !== this.generation) return;
      this.failures = 0;
      this.setStatus('idle');
    } catch (err) {
      if (generation !== this.generation) return; // stopped meanwhile: the error belongs to an old session
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
        this.stop();
        this.setStatus('error');
        return;
      }
      this.failures += 1;
      this.setStatus(err instanceof ApiError && err.isNetwork ? 'offline' : 'error');
      this.scheduleRetry();
    }
  }

  private async pushAll(generation: number): Promise<void> {
    while (generation === this.generation) {
      const batch = await this.deps.outbox.peek(SYNC_PUSH_MAX_OPS);
      if (batch.length === 0) return;
      try {
        await this.deps.api.push(batch.map((entry) => entry.op));
      } catch (err) {
        // Ops are pre-validated with the same schema; a 400/413 means version skew. Do not loop forever.
        if (err instanceof ApiError && (err.code === 'VALIDATION_FAILED' || err.code === 'PAYLOAD_TOO_LARGE')) {
          console.error('[sync] server refused batch, dropping it', err);
          await this.deps.outbox.acknowledge(batch);
          continue;
        }
        throw err;
      }
      // STALE rejections need no action: the following pull brings the newer server version.
      if (generation !== this.generation) return; // outbox may already belong to another user
      await this.deps.outbox.acknowledge(batch);
    }
  }

  private async pull(generation: number): Promise<void> {
    if (generation !== this.generation) return;
    const since = (await this.deps.meta.get<string>(META_CURSOR)) ?? null;
    const response = await this.deps.api.pull(since);
    // A response that arrives after stop()/resetLocalData() may belong to the previous user.
    if (generation !== this.generation) return;
    await this.deps.replica.apply(response.changes);
    await this.deps.meta.set(META_CURSOR, response.serverTime);
  }

  private schedulePush(): void {
    if (!this.userId) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.syncNow();
    }, SyncEngine.PUSH_DEBOUNCE_MS);
  }

  private scheduleRetry(): void {
    if (!this.userId || this.retryTimer) return;
    const delay = Math.min(SyncEngine.MAX_RETRY_DELAY_MS, 5_000 * 2 ** (this.failures - 1));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncNow();
    }, delay);
  }

  /** Strictly increasing ISO timestamps, so two writes in one millisecond still order correctly. */
  private nextTimestamp(previous: string | undefined): string {
    const floor = Math.max(this.lastIssuedMs, previous ? Date.parse(previous) : 0);
    this.lastIssuedMs = Math.max(Date.now(), floor + 1);
    return new Date(this.lastIssuedMs).toISOString();
  }

  private setStatus(status: SyncStatus): void {
    if (status === this.status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
