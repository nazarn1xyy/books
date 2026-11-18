import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SyncEntity, SyncOp } from '@libify/shared';

export interface ReplicaRecord {
  /** `${entity}:${key}` */
  id: string;
  entity: SyncEntity;
  key: string;
  updatedAt: string;
  /** null = deleted */
  data: unknown;
}

export interface OutboxEntry {
  /** `${entity}:${key}` — one pending op per record, newer ops replace older ones. */
  id: string;
  op: SyncOp;
}

interface LibifySchema extends DBSchema {
  replica: { key: string; value: ReplicaRecord };
  outbox: { key: string; value: OutboxEntry };
  meta: { key: string; value: unknown };
}

export type LibifyDatabase = IDBPDatabase<LibifySchema>;

export function openLibifyDb(name = 'libify'): Promise<LibifyDatabase> {
  return openDB<LibifySchema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('replica', { keyPath: 'id' });
      db.createObjectStore('outbox', { keyPath: 'id' });
      db.createObjectStore('meta');
    },
  });
}

export const recordId = (entity: SyncEntity, key: string): string => `${entity}:${key}`;
