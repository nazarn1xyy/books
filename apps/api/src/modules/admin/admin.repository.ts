import { count, desc, isNull, sql } from 'drizzle-orm';
import type { AdminStats } from '@libify/shared';
import type { Database } from '../../core/db';
import { userBooks, users } from '../../db/schema';

export class AdminRepository {
  constructor(private readonly db: Database) {}

  async stats(): Promise<AdminStats> {
    const activeSince = (interval: string) =>
      sql<number>`count(*) filter (where ${users.lastSeenAt} > now() - ${interval}::interval)`.mapWith(Number);

    const [userCounts, [books], topBooks, registrations] = await Promise.all([
      this.db
        .select({ total: count(), active24h: activeSince('24 hours'), active7d: activeSince('7 days') })
        .from(users),
      this.db.select({ total: count() }).from(userBooks).where(isNull(userBooks.deletedAt)),
      this.db
        .select({ bookId: userBooks.bookId, title: sql<string>`max(${userBooks.title})`, readers: count() })
        .from(userBooks)
        .where(isNull(userBooks.deletedAt))
        .groupBy(userBooks.bookId)
        .orderBy(desc(count()))
        .limit(10),
      this.db
        .select({ day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`, count: count() })
        .from(users)
        .where(sql`${users.createdAt} > now() - interval '30 days'`)
        .groupBy(sql`1`)
        .orderBy(sql`1`),
    ]);
    const counts = userCounts[0];

    return {
      totalUsers: counts?.total ?? 0,
      activeUsers24h: counts?.active24h ?? 0,
      activeUsers7d: counts?.active7d ?? 0,
      totalLibraryBooks: books?.total ?? 0,
      topBooks,
      registrationsByDay: registrations,
    };
  }
}
