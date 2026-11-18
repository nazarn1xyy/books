import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { users } from '../src/db/schema';
import { openTestDatabase } from './helpers';

const handle = await openTestDatabase();
afterAll(() => handle.close());

describe('schema', () => {
  it('enforces case-insensitive unique nicknames', async () => {
    await handle.db.insert(users).values({ nickname: 'Reader', passwordHash: 'x' });
    await expect(handle.db.insert(users).values({ nickname: 'reader', passwordHash: 'x' })).rejects.toMatchObject({
      cause: { code: '23505' },
    });
  });
  it('has all tables', async () => {
    const rows = await handle.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      'bookmarks',
      'favorites',
      'quotes',
      'reading_progress',
      'sessions',
      'user_books',
      'users',
    ]);
  });
});
