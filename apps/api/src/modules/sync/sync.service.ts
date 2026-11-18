import { sql } from 'drizzle-orm';
import {
  SYNC_ENTITIES,
  syncKeyOf,
  type SyncChange,
  type SyncDataMap,
  type SyncEntity,
  type SyncOp,
  type SyncPullResponse,
  type SyncPushResponse,
  type SyncRejection,
} from '@libify/shared';
import type { Clock } from '../../core/clock';
import type { Database } from '../../core/db';
import type { SyncEntityRepository } from './base-sync.repository';

export type SyncRepositories = { [E in SyncEntity]: SyncEntityRepository<SyncDataMap[E]> };

export class SyncService {
  /** Pull re-reads this window before `since` so commits racing a previous pull are not missed. */
  private static readonly PULL_OVERLAP_MS = 10_000;
  private static readonly MAX_FUTURE_SKEW_MS = 5 * 60_000;

  constructor(
    private readonly db: Database,
    private readonly repos: SyncRepositories,
    private readonly clock: Clock,
  ) {}

  async push(userId: string, ops: SyncOp[]): Promise<SyncPushResponse> {
    const maxTime = this.clock.now().getTime() + SyncService.MAX_FUTURE_SKEW_MS;
    const rejected: SyncRejection[] = [];
    let applied = 0;

    await this.db.transaction(async (tx) => {
      for (const op of ops) {
        if (op.data !== null && syncKeyOf(op.entity, op.data) !== op.key) {
          rejected.push({ entity: op.entity, key: op.key, reason: 'KEY_MISMATCH' });
          continue;
        }
        const updatedAt = new Date(Math.min(new Date(op.clientUpdatedAt).getTime(), maxTime));
        const repo = this.repos[op.entity] as SyncEntityRepository<unknown>;
        if (await repo.write(tx, userId, op.key, op.data, updatedAt)) applied += 1;
        else rejected.push({ entity: op.entity, key: op.key, reason: 'STALE' });
      }
    });

    return { applied, rejected, serverTime: await this.databaseNow() };
  }

  async pull(userId: string, since: string | undefined): Promise<SyncPullResponse> {
    const serverTime = await this.databaseNow();
    const sinceDate = since ? new Date(new Date(since).getTime() - SyncService.PULL_OVERLAP_MS) : null;

    const perEntity = await Promise.all(
      SYNC_ENTITIES.map(async (entity) => {
        const records = await (this.repos[entity] as SyncEntityRepository<unknown>).changedSince(userId, sinceDate);
        return records.map((r) => ({ entity, key: r.key, updatedAt: r.updatedAt.toISOString(), data: r.data }) as SyncChange);
      }),
    );
    return { serverTime, changes: perEntity.flat() };
  }

  /** The cursor must come from the same clock that writes synced_at. */
  private async databaseNow(): Promise<string> {
    const [row] = await this.db.execute<{ now: string }>(sql`select to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as now`);
    return row!.now;
  }
}
