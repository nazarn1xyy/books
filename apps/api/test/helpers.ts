import { sql } from 'drizzle-orm';
import type { Clock } from '../src/core/clock';
import { createDatabase, type DatabaseHandle } from '../src/core/db';

export const TEST_ORIGIN = 'http://localhost:5173';

export class FakeClock implements Clock {
  private current: Date;
  constructor(start = new Date('2026-11-18T10:00:00.000Z')) {
    this.current = new Date(start);
  }
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export async function openTestDatabase(): Promise<DatabaseHandle> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL not set (global setup did not run)');
  const handle = createDatabase(url, 2);
  await handle.db.execute(
    sql`truncate table users, sessions, user_books, reading_progress, quotes, bookmarks, favorites cascade`,
  );
  return handle;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
