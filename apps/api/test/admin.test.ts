import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { AdminStats } from '@libify/shared';
import { createTestContext } from './helpers';

const ctx = await createTestContext();
afterAll(() => ctx.close());
beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
});

describe('admin', () => {
  it('forbids regular users', async () => {
    const user = ctx.client();
    await user.post('/api/auth/register', { nickname: 'plain', password: 'password1' });
    expect((await user.get('/api/admin/stats')).status).toBe(403);
    expect((await ctx.client().get('/api/admin/stats')).status).toBe(401);
  });

  it('returns real stats to admins', async () => {
    const admin = ctx.client();
    await admin.post('/api/auth/register', { nickname: 'boss', password: 'password1' });
    expect(await ctx.container.users.setRole('BOSS', 'admin')).toBe(true);
    await admin.post('/api/sync/push', {
      ops: [
        {
          entity: 'book',
          key: '7',
          clientUpdatedAt: '2026-11-18T10:00:00.000Z',
          data: { bookId: '7', title: 'War and Peace', author: null, coverUrl: null, status: 'reading', format: 'fb2', addedAt: '2026-11-18T10:00:00.000Z' },
        },
      ],
    });

    const res = await admin.get('/api/admin/stats');
    expect(res.status).toBe(200);
    const stats: AdminStats = await res.json();
    expect(stats.totalUsers).toBe(1);
    expect(stats.totalLibraryBooks).toBe(1);
    expect(stats.topBooks).toEqual([{ bookId: '7', title: 'War and Peace', readers: 1 }]);
    expect(stats.registrationsByDay).toHaveLength(1);
  });
});
