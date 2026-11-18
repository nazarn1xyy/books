import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestContext, DAY_MS, type TestClient } from './helpers';

const ctx = await createTestContext();
afterAll(() => ctx.close());
beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
});

const creds = { nickname: 'Reader_1', password: 'correct-horse' };
const register = (client: TestClient, body: unknown = creds) => client.post('/api/auth/register', body);

describe('auth', () => {
  it('registers, sets session cookie and returns the user', async () => {
    const client = ctx.client();
    const res = await register(client);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toMatchObject({ nickname: 'Reader_1', role: 'user' });
    expect(body.user).not.toHaveProperty('passwordHash');
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/libify_sid=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect((await me.json()).user.nickname).toBe('Reader_1');
  });

  it('rejects a nickname that differs only by case', async () => {
    await register(ctx.client());
    const res = await register(ctx.client(), { nickname: 'reader_1', password: 'another-pass' });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('NICKNAME_TAKEN');
  });

  it('validates nickname and password', async () => {
    const res = await register(ctx.client(), { nickname: 'a b', password: 'short' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('logs in case-insensitively and rejects wrong password with one generic error', async () => {
    await register(ctx.client());
    const ok = await ctx.client().post('/api/auth/login', { nickname: 'READER_1', password: creds.password });
    expect(ok.status).toBe(200);

    const wrong = await ctx.client().post('/api/auth/login', { nickname: 'Reader_1', password: 'wrong-password' });
    const unknown = await ctx.client().post('/api/auth/login', { nickname: 'ghost', password: 'whatever1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await wrong.json()).error.code).toBe('INVALID_CREDENTIALS');
    expect((await unknown.json()).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logout clears the session', async () => {
    const client = ctx.client();
    await register(client);
    expect((await client.post('/api/auth/logout')).status).toBe(204);
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });

  it('expires sessions after 30 days and renews them when half-used', async () => {
    const client = ctx.client();
    await register(client);

    ctx.clock.advance(16 * DAY_MS);
    const renewed = await client.get('/api/auth/me');
    expect(renewed.status).toBe(200);
    expect(renewed.headers.get('set-cookie')).toMatch(/libify_sid=/);

    ctx.clock.advance(29 * DAY_MS);
    expect((await client.get('/api/auth/me')).status).toBe(200);

    ctx.clock.advance(31 * DAY_MS);
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });

  it('blocks repeated failed logins from one IP without locking out the owner elsewhere', async () => {
    await register(ctx.client());
    const attacker = ctx.client();
    const login = (client: TestClient, password: string, ip: string) =>
      client.post('/api/auth/login', { nickname: 'Reader_1', password }, { 'x-forwarded-for': ip });

    // Per-IP limit is 5/min, so spread attempts over time; failures are what count.
    for (let i = 0; i < 10; i++) {
      expect((await login(attacker, 'wrong-password', '203.0.113.50')).status).toBe(401);
      ctx.clock.advance(61_000);
    }
    const blocked = await login(attacker, creds.password, '203.0.113.50');
    expect(blocked.status).toBe(429);

    const owner = await login(ctx.client(), creds.password, '198.51.100.200');
    expect(owner.status).toBe(200);
  });

  it('a successful login resets the failure counter', async () => {
    await register(ctx.client());
    const client = ctx.client();
    const login = (password: string) =>
      client.post('/api/auth/login', { nickname: 'Reader_1', password }, { 'x-forwarded-for': '203.0.113.60' });
    for (let i = 0; i < 9; i++) {
      await login('wrong-password');
      ctx.clock.advance(61_000);
    }
    expect((await login(creds.password)).status).toBe(200);
    ctx.clock.advance(61_000);
    for (let i = 0; i < 4; i++) expect((await login('wrong-password')).status).toBe(401);
    ctx.clock.advance(61_000);
    expect((await login(creds.password)).status).toBe(200);
  });

  it('rate limits registration attempts per IP', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.7' };
    const client = ctx.client();
    for (let i = 0; i < 5; i++) {
      await client.post('/api/auth/register', { nickname: `user_${i}_x`, password: 'password1' }, headers);
    }
    const blocked = await client.post('/api/auth/register', { nickname: 'user_6_x', password: 'password1' }, headers);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });
});
