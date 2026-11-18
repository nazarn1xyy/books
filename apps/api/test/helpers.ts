import { sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import { pino } from 'pino';
import { createApp } from '../src/app';
import { createContainer, type Container } from '../src/container';
import type { Clock } from '../src/core/clock';
import { loadConfig, type Config } from '../src/core/config';
import { createDatabase, type DatabaseHandle } from '../src/core/db';
import type { AppEnv } from '../src/core/http';

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

export interface TestContext {
  app: Hono<AppEnv>;
  container: Container;
  db: DatabaseHandle['db'];
  clock: FakeClock;
  client(): TestClient;
  close(): Promise<void>;
}

export async function createTestContext(
  options: { env?: Record<string, string>; fetch?: typeof fetch } = {},
): Promise<TestContext> {
  const handle = await openTestDatabase();
  const clock = new FakeClock();
  const config: Config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL!,
    APP_ORIGIN: TEST_ORIGIN,
    LOG_LEVEL: 'silent',
    ...options.env,
  });
  const container = createContainer(config, {
    db: handle.db,
    logger: pino({ level: 'silent' }),
    clock,
    fetch: options.fetch,
  });
  const app = createApp(container);
  return { app, container, db: handle.db, clock, client: () => new TestClient(app), close: handle.close };
}

/** Node's Response.json() is Promise<unknown>; tests read bodies loosely. */
export interface TestResponse extends Response {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json<T = any>(): Promise<T>;
}

let ipCounter = 0;

/**
 * Minimal cookie-aware HTTP client over app.request().
 * Each client gets its own fake IP so per-IP rate limits do not leak between tests.
 */
export class TestClient {
  private cookie: string | null = null;
  private readonly ip = `198.51.100.${(ipCounter++ % 250) + 1}`;

  constructor(
    private readonly app: Hono<AppEnv>,
    private readonly origin: string | null = TEST_ORIGIN,
  ) {}

  withoutOrigin(): TestClient {
    const clone = new TestClient(this.app, null);
    clone.cookie = this.cookie;
    return clone;
  }

  get(path: string, headers: Record<string, string> = {}): Promise<TestResponse> {
    return this.send('GET', path, undefined, headers);
  }

  post(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<TestResponse> {
    return this.send('POST', path, body, headers);
  }

  private async send(method: string, path: string, body: unknown, extra: Record<string, string>): Promise<TestResponse> {
    const headers = new Headers(extra);
    if (this.origin) headers.set('Origin', this.origin);
    if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', this.ip);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (this.cookie) headers.set('Cookie', this.cookie);
    const res = await this.app.request(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const pair = setCookie.split(';')[0] ?? '';
      this.cookie = pair.endsWith('=') || /max-age=0/i.test(setCookie) ? null : pair;
    }
    return res as TestResponse;
  }
}
