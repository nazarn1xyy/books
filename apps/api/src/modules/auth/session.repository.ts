import { eq, lte } from 'drizzle-orm';
import type { Database } from '../../core/db';
import { sessions, users } from '../../db/schema';
import type { UserRow } from './user.repository';

export interface SessionWithUser {
  id: string;
  expiresAt: Date;
  user: UserRow;
}

export class SessionRepository {
  constructor(private readonly db: Database) {}

  async create(id: string, userId: string, expiresAt: Date, userAgent: string | null): Promise<void> {
    await this.db.insert(sessions).values({ id, userId, expiresAt, userAgent });
  }

  async findWithUser(id: string): Promise<SessionWithUser | undefined> {
    const [row] = await this.db
      .select({ id: sessions.id, expiresAt: sessions.expiresAt, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.id, id))
      .limit(1);
    return row;
  }

  async extend(id: string, expiresAt: Date): Promise<void> {
    await this.db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteExpired(now: Date): Promise<number> {
    const rows = await this.db.delete(sessions).where(lte(sessions.expiresAt, now)).returning({ id: sessions.id });
    return rows.length;
  }
}
