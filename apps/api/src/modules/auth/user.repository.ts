import { eq, sql } from 'drizzle-orm';
import type { PublicUser, UserRole } from '@libify/shared';
import type { Database } from '../../core/db';
import { NicknameTakenError } from '../../core/errors';
import { pgErrorCode, UNIQUE_VIOLATION } from '../../core/pg-errors';
import { users } from '../../db/schema';

export type UserRow = typeof users.$inferSelect;

export function toPublicUser(row: Pick<UserRow, 'id' | 'nickname' | 'role' | 'createdAt'>): PublicUser {
  return { id: row.id, nickname: row.nickname, role: row.role, createdAt: row.createdAt.toISOString() };
}

const byNickname = (nickname: string) => sql`lower(${users.nickname}) = lower(${nickname})`;

export class UserRepository {
  constructor(private readonly db: Database) {}

  async create(nickname: string, passwordHash: string): Promise<UserRow> {
    try {
      const [row] = await this.db.insert(users).values({ nickname, passwordHash }).returning();
      return row!;
    } catch (err) {
      if (pgErrorCode(err) === UNIQUE_VIOLATION) throw new NicknameTakenError();
      throw err;
    }
  }

  async findByNickname(nickname: string): Promise<UserRow | undefined> {
    const [row] = await this.db.select().from(users).where(byNickname(nickname)).limit(1);
    return row;
  }

  async touchLastSeen(userId: string, at: Date): Promise<void> {
    await this.db.update(users).set({ lastSeenAt: at }).where(eq(users.id, userId));
  }

  async setRole(nickname: string, role: UserRole): Promise<boolean> {
    const rows = await this.db.update(users).set({ role }).where(byNickname(nickname)).returning({ id: users.id });
    return rows.length > 0;
  }
}
