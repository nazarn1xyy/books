import { and, eq, gt, isNull, lt, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Database, DbExecutor } from '../../core/db';

export interface SyncRecord<D> {
  key: string;
  updatedAt: Date;
  /** null = tombstone */
  data: D | null;
}

export interface SyncEntityRepository<D> {
  /** Returns true when the write was applied (newer than what is stored). */
  write(tx: DbExecutor, userId: string, key: string, data: D | null, updatedAt: Date): Promise<boolean>;
  changedSince(userId: string, since: Date | null): Promise<SyncRecord<D>[]>;
}

type SyncTable = PgTable & {
  userId: PgColumn;
  updatedAt: PgColumn;
  syncedAt: PgColumn;
  deletedAt: PgColumn;
};

interface SyncRowBase {
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Generic last-write-wins persistence for one synced table.
 * Drizzle's generic table types do not narrow through an abstract base class,
 * so the few `as never` casts below are confined to this file.
 */
export abstract class BaseSyncRepository<D, Row extends SyncRowBase> implements SyncEntityRepository<D> {
  protected abstract readonly table: SyncTable;
  protected abstract readonly keyColumn: PgColumn;
  protected abstract readonly conflictTarget: PgColumn[];
  protected abstract toValues(data: D): Record<string, unknown>;
  protected abstract fromRow(row: Row): D;
  protected abstract keyOf(row: Row): string;

  constructor(protected readonly db: Database) {}

  async write(tx: DbExecutor, userId: string, key: string, data: D | null, updatedAt: Date): Promise<boolean> {
    return data === null ? this.tombstone(tx, userId, key, updatedAt) : this.upsert(tx, userId, data, updatedAt);
  }

  async changedSince(userId: string, since: Date | null): Promise<SyncRecord<D>[]> {
    const t = this.table;
    const where: SQL | undefined = since
      ? and(eq(t.userId, userId), gt(t.syncedAt, since))
      : and(eq(t.userId, userId), isNull(t.deletedAt));
    const rows = (await this.db.select().from(t as never).where(where)) as Row[];
    return rows.map((row) => ({
      key: this.keyOf(row),
      updatedAt: row.updatedAt,
      data: row.deletedAt ? null : this.fromRow(row),
    }));
  }

  private async upsert(tx: DbExecutor, userId: string, data: D, updatedAt: Date): Promise<boolean> {
    const t = this.table;
    const values = { ...this.toValues(data), userId, updatedAt, deletedAt: null };
    const { userId: _owner, ...updatable } = values;
    const rows = await tx
      .insert(t)
      .values(values as never)
      .onConflictDoUpdate({
        target: this.conflictTarget,
        set: { ...updatable, syncedAt: sql`now()` } as never,
        // Only overwrite rows that belong to this user and are older.
        setWhere: and(eq(t.userId, userId), lt(t.updatedAt, updatedAt)),
      })
      .returning({ key: this.keyColumn });
    return rows.length > 0;
  }

  private async tombstone(tx: DbExecutor, userId: string, key: string, updatedAt: Date): Promise<boolean> {
    const t = this.table;
    const owned = and(eq(t.userId, userId), eq(this.keyColumn, key));
    const updated = await tx
      .update(t)
      .set({ deletedAt: updatedAt, updatedAt, syncedAt: sql`now()` } as never)
      .where(and(owned, lt(t.updatedAt, updatedAt)))
      .returning({ key: this.keyColumn });
    if (updated.length > 0) return true;
    // Deleting something that never reached the server is a no-op success.
    const existing = await tx.select({ key: this.keyColumn }).from(t as never).where(owned).limit(1);
    return existing.length === 0;
  }
}
