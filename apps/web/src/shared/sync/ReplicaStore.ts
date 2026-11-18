import type { SyncDataMap, SyncEntity } from '@libify/shared';
import { recordId, type LibifyDatabase, type ReplicaRecord } from '../db/libifyDb';

export interface ReplicaInput {
  entity: SyncEntity;
  key: string;
  updatedAt: string;
  data: unknown;
}

export interface ReplicaEntry<E extends SyncEntity> {
  key: string;
  updatedAt: string;
  data: SyncDataMap[E];
}

/**
 * Local copy of every synced record: memory for synchronous reads, IndexedDB for persistence.
 * Merges with last-write-wins on `updatedAt` (ISO strings in one format compare lexicographically).
 */
export class ReplicaStore {
  private readonly db: LibifyDatabase;
  private readonly records = new Map<string, ReplicaRecord>();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  private constructor(db: LibifyDatabase) {
    this.db = db;
  }

  static async load(db: LibifyDatabase): Promise<ReplicaStore> {
    const store = new ReplicaStore(db);
    for (const record of await db.getAll('replica')) store.records.set(record.id, record);
    return store;
  }

  getRecord(entity: SyncEntity, key: string): ReplicaRecord | undefined {
    return this.records.get(recordId(entity, key));
  }

  get<E extends SyncEntity>(entity: E, key: string): SyncDataMap[E] | null {
    return (this.getRecord(entity, key)?.data ?? null) as SyncDataMap[E] | null;
  }

  list<E extends SyncEntity>(entity: E): ReplicaEntry<E>[] {
    const result: ReplicaEntry<E>[] = [];
    for (const record of this.records.values()) {
      if (record.entity === entity && record.data !== null) {
        result.push({ key: record.key, updatedAt: record.updatedAt, data: record.data as SyncDataMap[E] });
      }
    }
    return result;
  }

  getVersion(): number {
    return this.version;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Memory is updated synchronously (before the first await); resolves to true if anything changed. */
  async apply(inputs: readonly ReplicaInput[]): Promise<boolean> {
    const changed: ReplicaRecord[] = [];
    for (const input of inputs) {
      const id = recordId(input.entity, input.key);
      const current = this.records.get(id);
      if (current && current.updatedAt >= input.updatedAt) continue;
      const record: ReplicaRecord = { id, entity: input.entity, key: input.key, updatedAt: input.updatedAt, data: input.data };
      this.records.set(id, record);
      changed.push(record);
    }
    if (changed.length === 0) return false;

    const tx = this.db.transaction('replica', 'readwrite');
    await Promise.all([...changed.map((record) => tx.store.put(record)), tx.done]);
    this.notify();
    return true;
  }

  async clear(): Promise<void> {
    this.records.clear();
    await this.db.clear('replica');
    this.notify();
  }

  private notify(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
