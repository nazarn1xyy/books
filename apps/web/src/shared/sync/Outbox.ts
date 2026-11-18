import type { SyncOp } from '@libify/shared';
import { recordId, type LibifyDatabase, type OutboxEntry } from '@/shared/db/libifyDb';

/** Persistent queue of local changes not yet confirmed by the server. */
export class Outbox {
  private readonly db: LibifyDatabase;

  constructor(db: LibifyDatabase) {
    this.db = db;
  }

  async put(op: SyncOp): Promise<void> {
    await this.db.put('outbox', { id: recordId(op.entity, op.key), op });
  }

  async peek(limit: number): Promise<OutboxEntry[]> {
    return this.db.getAll('outbox', undefined, limit);
  }

  /** Removes sent entries unless a newer op for the same record arrived meanwhile. */
  async acknowledge(sent: readonly OutboxEntry[]): Promise<void> {
    const tx = this.db.transaction('outbox', 'readwrite');
    for (const entry of sent) {
      const stored = await tx.store.get(entry.id);
      if (stored && stored.op.clientUpdatedAt === entry.op.clientUpdatedAt) await tx.store.delete(entry.id);
    }
    await tx.done;
  }

  size(): Promise<number> {
    return this.db.count('outbox');
  }

  async clear(): Promise<void> {
    await this.db.clear('outbox');
  }
}
