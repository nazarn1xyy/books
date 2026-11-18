# План 2: фронт на новом API (без Supabase)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline, без субагентов). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести `apps/web` с Supabase на собственный API: вход по нику, офлайн-синхронизация библиотеки,
прогресса, цитат, закладок и избранного через `/api/sync`, каталог через `/api/catalog`, админка на `/api/admin/stats`.
После плана в проекте нет ни одной зависимости от Supabase и Vercel.

**Architecture:** Новый слой `apps/web/src/shared/` с классами: `ApiClient` (+ `AuthApi`, `SyncApi`, `CatalogApi`,
`AdminApi`), `ReplicaStore` (локальная копия синхронизируемых записей в IndexedDB + память, last-write-wins),
`Outbox` (очередь неотправленных изменений), `SyncEngine` (push/pull, триггеры, ретраи), композиционный корень
`services.ts`. Существующие модули `utils/storage.ts` и `services/db.ts` сохраняют имена функций, но работают
поверх `ReplicaStore`/`SyncEngine`, поэтому страницы меняются точечно. Большой рефакторинг по фичам — План 3.

**Tech Stack:** React 19, Vite 7, `idb` (обёртка IndexedDB), `@libify/shared` (zod-схемы), Vitest + `fake-indexeddb`.

**Спека:** `docs/superpowers/specs/2026-11-18-libify-v2-design.md` · **Предыдущий план:** `2026-11-18-plan-1-monorepo-and-api.md`

**Предусловие:** ветка `v2`, Docker Desktop запущен, `npm run db:up`. Номера строк в существующих файлах могли
сдвинуться — ориентируйся на цитируемый код, а не на номера.

**Важно про tsconfig фронта:** в `apps/web/tsconfig.app.json` включён `erasableSyntaxOnly` — **параметр-свойства
в конструкторах (`constructor(private x)`) запрещены**. Во всех классах ниже поля объявлены явно.

---

## Карта файлов

```
apps/api/src/db/schema.ts                    + bookmarks.book_title
apps/api/drizzle/0001_*.sql                  сгенерированная миграция
apps/api/src/modules/sync/entity.repositories.ts   маппинг bookTitle
packages/shared/src/sync.ts                  bookmarkDataSchema.bookTitle

apps/web/package.json                        + idb, @libify/shared, vitest, fake-indexeddb; − supabase, socks-proxy-agent
apps/web/vitest.config.ts                    окружение тестов
apps/web/vite.config.ts                      dev-прокси /api, PWA-кеш картинок каталога, без Tor/Supabase
apps/web/src/shared/api/ApiError.ts          ошибка с кодом из shared
apps/web/src/shared/api/ApiClient.ts         fetch-обёртка: таймаут, ретраи GET, разбор ошибок, 401-хук
apps/web/src/shared/api/AuthApi.ts           /auth/*
apps/web/src/shared/api/SyncApi.ts           /sync/*
apps/web/src/shared/api/CatalogApi.ts        /catalog/*, catalogImageUrl()
apps/web/src/shared/api/AdminApi.ts          /admin/stats
apps/web/src/shared/db/libifyDb.ts           схема IndexedDB "libify" (replica, outbox, meta)
apps/web/src/shared/db/MetaStore.ts          key-value поверх meta
apps/web/src/shared/sync/ReplicaStore.ts     локальная реплика (память + IndexedDB), LWW, подписки
apps/web/src/shared/sync/Outbox.ts           очередь операций, схлопывание по ключу
apps/web/src/shared/sync/SyncEngine.ts       record / syncNow / start / stop / resetLocalData
apps/web/src/shared/sync/browserSignals.ts   online + visibilitychange
apps/web/src/shared/sync/legacyImport.ts     одноразовый импорт старого localStorage
apps/web/src/shared/sync/useReplicaVersion.ts  React-хук подписки на реплику
apps/web/src/shared/services.ts              композиционный корень: initServices() / services()
apps/web/src/shared/**/*.test.ts             тесты
apps/web/src/main.tsx                        await initServices() перед рендером
apps/web/src/contexts/AuthContext.tsx        переписан: PublicUser, login/register/signOut, запуск синка
apps/web/src/pages/Auth.tsx                  переписан: ник + пароль
apps/web/src/utils/storage.ts                переписан поверх реплики
apps/web/src/services/db.ts                  переписан поверх реплики
apps/web/src/services/flibustaApi.ts         запросы через CatalogApi
apps/web/src/types/index.ts                  типы без user_id и pending*
apps/web/src/pages/{MyBooks,Reader,Admin/Admin}.tsx, components/{BookCard,Sidebar}.tsx   точечные правки
apps/web/src/locales/{en,uk}.json            тексты ошибок авторизации
Удалить: apps/web/src/lib/supabase.ts, utils/sync.ts, utils/mutex.ts, services/ai.ts, api/ (корень), vercel.json, schema.sql
```

---

### Task 1: API — название книги у закладок

Закладки в «Моих книгах» показывают название книги, а в схеме синхронизации его нет.

**Files:** `packages/shared/src/sync.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/modules/sync/entity.repositories.ts`,
`apps/api/test/sync.test.ts`, новая миграция в `apps/api/drizzle/`

- [ ] **Step 1: Обновить тест.** В `apps/api/test/sync.test.ts`, в тесте `syncs every entity type`, данные закладки:

```ts
      { entity: 'bookmark', key: bid, clientUpdatedAt: at(1), data: { id: bid, bookId: '42', bookTitle: 'B', paragraphIndex: 7, previewText: 'p' } },
```

и сразу после `expect(entities)...` добавить:

```ts
    const bookmark = (await pull(alice)).changes.find((c) => c.entity === 'bookmark');
    expect(bookmark?.data).toMatchObject({ bookTitle: 'B' });
```

- [ ] **Step 2: Запустить — FAIL.** `npm test -w @libify/api -- sync` → ошибка валидации (`bookTitle` неизвестен) или отсутствие поля.

- [ ] **Step 3: `packages/shared/src/sync.ts`** — в `bookmarkDataSchema` добавить поле после `bookId`:

```ts
export const bookmarkDataSchema = z.object({
  id: z.uuid(),
  bookId,
  bookTitle: nullableText(500),
  paragraphIndex: z.number().int().min(0),
  previewText: nullableText(500),
});
```

- [ ] **Step 4: `apps/api/src/db/schema.ts`** — в таблицу `bookmarks` после `bookId` добавить `bookTitle: text('book_title'),`.

- [ ] **Step 5: `entity.repositories.ts`** — в `BookmarkSyncRepository.fromRow`:

```ts
    return { id: r.id, bookId: r.bookId, bookTitle: r.bookTitle, paragraphIndex: r.paragraphIndex, previewText: r.previewText };
```

(`toValues` уже делает `{ ...d }` и подхватит поле.)

- [ ] **Step 6: Миграция.** `npm run db:generate -w @libify/api` → появляется `drizzle/0001_*.sql` с
`ALTER TABLE "bookmarks" ADD COLUMN "book_title" text;`. Затем `npm run db:migrate -w @libify/api`.

- [ ] **Step 7: PASS.** `npm test -w @libify/api && npm test -w @libify/shared` — всё зелёное.

- [ ] **Step 8: Commit**

```bash
git add packages/shared apps/api
git commit -m "feat(sync): carry book title on bookmarks"
```

---

### Task 2: Зависимости и тестовая среда фронта

**Files:** `apps/web/package.json`, `apps/web/vitest.config.ts`

- [ ] **Step 1: Зависимости**

```bash
npm install -w @libify/web idb@^8 @libify/shared@*
npm install -w @libify/web -D vitest@^5.1.1 fake-indexeddb@^6
npm uninstall -w @libify/web @supabase/supabase-js socks-proxy-agent
```

Проверить, что версии существуют: `npm view idb version`, `npm view fake-indexeddb version` — если major отличается,
поставить актуальный major.

- [ ] **Step 2: Скрипт** — в `apps/web/package.json` в `scripts` добавить `"test": "vitest run"`.

- [ ] **Step 3: `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
  },
});
```

- [ ] **Step 4: Проверка.** `npm test -w @libify/web` → `No test files found` с кодом выхода 1 — это ожидаемо до Task 3.
Чтобы не ломать `npm test` в корне, добавить в конфиг `passWithNoTests: true` в `test`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts package-lock.json
git commit -m "chore(web): add idb, shared contracts and vitest; drop supabase"
```

(Сборка фронта сейчас сломана — `lib/supabase.ts` импортирует удалённый пакет. Починится в Task 9–11.)

---

### Task 3: ApiClient и ApiError (TDD)

**Files:** `apps/web/src/shared/api/ApiError.ts`, `apps/web/src/shared/api/ApiClient.ts`, тест `ApiClient.test.ts`

- [ ] **Step 1: Падающий тест `apps/web/src/shared/api/ApiClient.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './ApiClient';
import { ApiError } from './ApiError';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('ApiClient', () => {
  it('prefixes /api, sends JSON and parses the response', async () => {
    const fetchFn = vi.fn(async () => json({ ok: true }));
    const client = new ApiClient({ fetchFn });
    expect(await client.post('/auth/login', { a: 1 })).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.body).toBe('{"a":1}');
  });

  it('returns undefined for 204', async () => {
    const client = new ApiClient({ fetchFn: async () => new Response(null, { status: 204 }) });
    expect(await client.post('/auth/logout')).toBeUndefined();
  });

  it('maps the uniform error body to ApiError', async () => {
    const client = new ApiClient({
      fetchFn: async () => json({ error: { code: 'NICKNAME_TAKEN', message: 'taken' } }, 409),
    });
    await expect(client.post('/auth/register', {})).rejects.toMatchObject({ code: 'NICKNAME_TAKEN', status: 409 });
  });

  it('retries GET on network failure and 5xx, never retries POST', async () => {
    let calls = 0;
    const flaky = new ApiClient({
      retryDelayMs: 0,
      fetchFn: async () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        if (calls === 2) return json({ error: { code: 'INTERNAL', message: 'x' } }, 500);
        return json({ ok: 1 });
      },
    });
    expect(await flaky.get('/sync/pull')).toEqual({ ok: 1 });
    expect(calls).toBe(3);

    let postCalls = 0;
    const post = new ApiClient({
      retryDelayMs: 0,
      fetchFn: async () => {
        postCalls += 1;
        throw new TypeError('Failed to fetch');
      },
    });
    await expect(post.post('/sync/push', {})).rejects.toMatchObject({ code: 'NETWORK' });
    expect(postCalls).toBe(1);
  });

  it('notifies the unauthorized listener on UNAUTHORIZED', async () => {
    const client = new ApiClient({ fetchFn: async () => json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, 401) });
    const listener = vi.fn();
    client.onUnauthorized(listener);
    await expect(client.get('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('reads binary bodies', async () => {
    const client = new ApiClient({ fetchFn: async () => new Response(new Uint8Array([1, 2, 3])) });
    const buf = await client.getArrayBuffer('/catalog/book/1/fb2');
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3]));
  });
});
```

- [ ] **Step 2: FAIL.** `npm test -w @libify/web` → не найден модуль `./ApiClient`.

- [ ] **Step 3: `apps/web/src/shared/api/ApiError.ts`**

```ts
import type { ErrorCode } from '@libify/shared';

export type ApiErrorCode = ErrorCode | 'NETWORK' | 'TIMEOUT';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }

  /** The request never got an HTTP answer (offline, DNS, timeout). */
  get isNetwork(): boolean {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT';
  }
}
```

- [ ] **Step 4: `apps/web/src/shared/api/ApiClient.ts`**

```ts
import type { ApiErrorBody } from '@libify/shared';
import { ApiError } from './ApiError';

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  getRetries?: number;
  retryDelayMs?: number;
}

interface RequestOptions {
  body?: unknown;
  timeoutMs?: number;
}

/** Same-origin JSON client for /api with timeouts, GET retries and typed errors. */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly getRetries: number;
  private readonly retryDelayMs: number;
  private unauthorizedListener: (() => void) | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/api';
    this.fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.getRetries = options.getRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 400;
  }

  onUnauthorized(listener: (() => void) | null): void {
    this.unauthorizedListener = listener;
  }

  async get<T>(path: string): Promise<T> {
    return ApiClient.parseJson<T>(await this.request('GET', path, {}));
  }

  async post<T = void>(path: string, body?: unknown): Promise<T> {
    return ApiClient.parseJson<T>(await this.request('POST', path, { body }));
  }

  async getText(path: string): Promise<string> {
    return (await this.request('GET', path, {})).text();
  }

  async getArrayBuffer(path: string, timeoutMs?: number): Promise<ArrayBuffer> {
    return (await this.request('GET', path, { timeoutMs })).arrayBuffer();
  }

  private async request(method: 'GET' | 'POST', path: string, options: RequestOptions): Promise<Response> {
    const attempts = method === 'GET' ? this.getRetries + 1 : 1;
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await sleep(this.retryDelayMs * 2 ** (attempt - 1));
      let response: Response;
      try {
        response = await this.fetchFn(this.baseUrl + path, {
          method,
          credentials: 'same-origin',
          headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
        });
      } catch (err) {
        lastError = ApiClient.networkError(err);
        continue;
      }

      if (response.ok) return response;
      const error = await ApiClient.httpError(response);
      if (error.code === 'UNAUTHORIZED') this.unauthorizedListener?.();
      if (response.status >= 500) {
        lastError = error;
        continue;
      }
      throw error;
    }
    throw lastError ?? new ApiError('NETWORK', 0, 'Request failed');
  }

  private static async parseJson<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private static async httpError(response: Response): Promise<ApiError> {
    try {
      const body = (await response.json()) as Partial<ApiErrorBody>;
      if (body.error?.code) return new ApiError(body.error.code, response.status, body.error.message);
    } catch {
      // not our JSON error body
    }
    return new ApiError(response.status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED', response.status, response.statusText);
  }

  private static networkError(err: unknown): ApiError {
    const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
    return new ApiError(isTimeout ? 'TIMEOUT' : 'NETWORK', 0, err instanceof Error ? err.message : String(err));
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
```

- [ ] **Step 5: PASS.** `npm test -w @libify/web` → 6 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/shared/api
git commit -m "feat(web): typed ApiClient with timeouts, retries and error codes"
```

---

### Task 4: Обёртки эндпоинтов

**Files:** `apps/web/src/shared/api/{AuthApi,SyncApi,CatalogApi,AdminApi}.ts`, тест `CatalogApi.test.ts`

- [ ] **Step 1: `AuthApi.ts`**

```ts
import type { AuthResponse, Credentials, LoginInput, PublicUser } from '@libify/shared';
import type { ApiClient } from './ApiClient';
import { ApiError } from './ApiError';

export class AuthApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  /** Current user, or null when not logged in. Network errors propagate (caller decides about offline). */
  async me(): Promise<PublicUser | null> {
    try {
      return (await this.client.get<AuthResponse>('/auth/me')).user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  }

  async login(input: LoginInput): Promise<PublicUser> {
    return (await this.client.post<AuthResponse>('/auth/login', input)).user;
  }

  async register(input: Credentials): Promise<PublicUser> {
    return (await this.client.post<AuthResponse>('/auth/register', input)).user;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
  }
}
```

- [ ] **Step 2: `SyncApi.ts`**

```ts
import type { SyncOp, SyncPullResponse, SyncPushResponse } from '@libify/shared';
import type { ApiClient } from './ApiClient';

export class SyncApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  push(ops: SyncOp[]): Promise<SyncPushResponse> {
    return this.client.post<SyncPushResponse>('/sync/push', { ops });
  }

  pull(since: string | null): Promise<SyncPullResponse> {
    return this.client.get<SyncPullResponse>(`/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`);
  }
}
```

- [ ] **Step 3: Падающий тест `CatalogApi.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { catalogImageUrl } from './CatalogApi';

describe('catalogImageUrl', () => {
  it('routes absolute catalog images through the API', () => {
    expect(catalogImageUrl('https://static.flibusta.is/i/1/c.jpg')).toBe(
      '/api/catalog/image?src=https%3A%2F%2Fstatic.flibusta.is%2Fi%2F1%2Fc.jpg',
    );
  });
  it('resolves relative OPDS links against the main host', () => {
    expect(catalogImageUrl('/i/2/c.png')).toBe('/api/catalog/image?src=https%3A%2F%2Fflibusta.is%2Fi%2F2%2Fc.png');
  });
});
```

- [ ] **Step 4: `CatalogApi.ts`**

```ts
import type { BookFormat } from '@libify/shared';
import type { ApiClient } from './ApiClient';

export const CATALOG_ORIGIN = 'https://flibusta.is';
const BOOK_DOWNLOAD_TIMEOUT_MS = 120_000;

/** Image URL proxied (and cached) by our API. Accepts absolute or OPDS-relative links. */
export function catalogImageUrl(href: string): string {
  return `/api/catalog/image?src=${encodeURIComponent(new URL(href, CATALOG_ORIGIN).toString())}`;
}

export class CatalogApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  searchOpds(query: string): Promise<string> {
    return this.client.getText(`/catalog/search?q=${encodeURIComponent(query)}`);
  }

  downloadBook(bookId: string, format: BookFormat = 'fb2'): Promise<ArrayBuffer> {
    return this.client.getArrayBuffer(`/catalog/book/${encodeURIComponent(bookId)}/${format}`, BOOK_DOWNLOAD_TIMEOUT_MS);
  }
}
```

- [ ] **Step 5: `AdminApi.ts`**

```ts
import type { AdminStats } from '@libify/shared';
import type { ApiClient } from './ApiClient';

export class AdminApi {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  stats(): Promise<AdminStats> {
    return this.client.get<AdminStats>('/admin/stats');
  }
}
```

- [ ] **Step 6: PASS + commit**

```bash
npm test -w @libify/web
git add apps/web/src/shared/api
git commit -m "feat(web): auth, sync, catalog and admin api wrappers"
```

---

### Task 5: IndexedDB, MetaStore, ReplicaStore (TDD)

**Files:** `apps/web/src/shared/db/{libifyDb,MetaStore}.ts`, `apps/web/src/shared/sync/ReplicaStore.ts`, тест `ReplicaStore.test.ts`

- [ ] **Step 1: `apps/web/src/shared/db/libifyDb.ts`**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SyncEntity, SyncOp } from '@libify/shared';

export interface ReplicaRecord {
  /** `${entity}:${key}` */
  id: string;
  entity: SyncEntity;
  key: string;
  updatedAt: string;
  /** null = deleted */
  data: unknown;
}

export interface OutboxEntry {
  /** `${entity}:${key}` — one pending op per record, newer ops replace older ones. */
  id: string;
  op: SyncOp;
}

interface LibifySchema extends DBSchema {
  replica: { key: string; value: ReplicaRecord };
  outbox: { key: string; value: OutboxEntry };
  meta: { key: string; value: unknown };
}

export type LibifyDatabase = IDBPDatabase<LibifySchema>;

export function openLibifyDb(name = 'libify'): Promise<LibifyDatabase> {
  return openDB<LibifySchema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('replica', { keyPath: 'id' });
      db.createObjectStore('outbox', { keyPath: 'id' });
      db.createObjectStore('meta');
    },
  });
}

export const recordId = (entity: SyncEntity, key: string): string => `${entity}:${key}`;
```

- [ ] **Step 2: `apps/web/src/shared/db/MetaStore.ts`**

```ts
import type { LibifyDatabase } from './libifyDb';

export class MetaStore {
  private readonly db: LibifyDatabase;

  constructor(db: LibifyDatabase) {
    this.db = db;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.db.get('meta', key)) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db.put('meta', value, key);
  }

  async delete(key: string): Promise<void> {
    await this.db.delete('meta', key);
  }
}
```

- [ ] **Step 3: Падающий тест `apps/web/src/shared/sync/ReplicaStore.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openLibifyDb, type LibifyDatabase } from '../db/libifyDb';
import { ReplicaStore } from './ReplicaStore';

const fav = (bookId: string, title = 'T') => ({ bookId, title, author: null, coverUrl: null });
let db: LibifyDatabase;
let n = 0;

beforeEach(async () => {
  db = await openLibifyDb(`test-replica-${n++}`);
});

describe('ReplicaStore', () => {
  it('applies newer records and ignores older or equal ones', async () => {
    const store = await ReplicaStore.load(db);
    await store.apply([{ entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:02.000Z', data: fav('1', 'new') }]);
    const changed = await store.apply([
      { entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('1', 'old') },
      { entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:02.000Z', data: fav('1', 'same') },
    ]);
    expect(changed).toBe(false);
    expect(store.get('favorite', '1')?.title).toBe('new');
  });

  it('hides tombstones from get and list', async () => {
    const store = await ReplicaStore.load(db);
    await store.apply([
      { entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('1') },
      { entity: 'favorite', key: '2', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('2') },
    ]);
    await store.apply([{ entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:02.000Z', data: null }]);
    expect(store.get('favorite', '1')).toBeNull();
    expect(store.list('favorite').map((r) => r.key)).toEqual(['2']);
    expect(store.getRecord('favorite', '1')?.data).toBeNull();
  });

  it('persists to IndexedDB and reloads', async () => {
    const store = await ReplicaStore.load(db);
    await store.apply([{ entity: 'favorite', key: '9', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('9') }]);
    const reloaded = await ReplicaStore.load(db);
    expect(reloaded.get('favorite', '9')?.bookId).toBe('9');
  });

  it('updates memory synchronously and notifies subscribers', async () => {
    const store = await ReplicaStore.load(db);
    const listener = vi.fn();
    store.subscribe(listener);
    const pending = store.apply([{ entity: 'favorite', key: '3', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('3') }]);
    expect(store.get('favorite', '3')).not.toBeNull();
    await pending;
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getVersion()).toBe(1);
  });

  it('clear() wipes memory and storage', async () => {
    const store = await ReplicaStore.load(db);
    await store.apply([{ entity: 'favorite', key: '1', updatedAt: '2026-01-01T00:00:01.000Z', data: fav('1') }]);
    await store.clear();
    expect(store.list('favorite')).toEqual([]);
    expect((await ReplicaStore.load(db)).list('favorite')).toEqual([]);
  });
});
```

- [ ] **Step 4: FAIL** (`./ReplicaStore` не найден).

- [ ] **Step 5: `apps/web/src/shared/sync/ReplicaStore.ts`**

```ts
import type { SyncDataMap, SyncEntity } from '@libify/shared';
import { recordId, type LibifyDatabase, type ReplicaRecord } from '../db/libifyDb';

export interface ReplicaInput {
  entity: SyncEntity;
  key: string;
  updatedAt: string;
  data: unknown;
}

export interface ReplicaEntry<E extends SyncEntity> {
  key: string;
  updatedAt: string;
  data: SyncDataMap[E];
}

/**
 * Local copy of every synced record: memory for synchronous reads, IndexedDB for persistence.
 * Merges with last-write-wins on `updatedAt` (ISO strings in one format compare lexicographically).
 */
export class ReplicaStore {
  private readonly db: LibifyDatabase;
  private readonly records = new Map<string, ReplicaRecord>();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  private constructor(db: LibifyDatabase) {
    this.db = db;
  }

  static async load(db: LibifyDatabase): Promise<ReplicaStore> {
    const store = new ReplicaStore(db);
    for (const record of await db.getAll('replica')) store.records.set(record.id, record);
    return store;
  }

  getRecord(entity: SyncEntity, key: string): ReplicaRecord | undefined {
    return this.records.get(recordId(entity, key));
  }

  get<E extends SyncEntity>(entity: E, key: string): SyncDataMap[E] | null {
    return (this.getRecord(entity, key)?.data ?? null) as SyncDataMap[E] | null;
  }

  list<E extends SyncEntity>(entity: E): ReplicaEntry<E>[] {
    const result: ReplicaEntry<E>[] = [];
    for (const record of this.records.values()) {
      if (record.entity === entity && record.data !== null) {
        result.push({ key: record.key, updatedAt: record.updatedAt, data: record.data as SyncDataMap[E] });
      }
    }
    return result;
  }

  getVersion(): number {
    return this.version;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Memory is updated synchronously (before the first await); resolves to true if anything changed. */
  async apply(inputs: readonly ReplicaInput[]): Promise<boolean> {
    const changed: ReplicaRecord[] = [];
    for (const input of inputs) {
      const id = recordId(input.entity, input.key);
      const current = this.records.get(id);
      if (current && current.updatedAt >= input.updatedAt) continue;
      const record: ReplicaRecord = { id, entity: input.entity, key: input.key, updatedAt: input.updatedAt, data: input.data };
      this.records.set(id, record);
      changed.push(record);
    }
    if (changed.length === 0) return false;

    const tx = this.db.transaction('replica', 'readwrite');
    await Promise.all([...changed.map((record) => tx.store.put(record)), tx.done]);
    this.notify();
    return true;
  }

  async clear(): Promise<void> {
    this.records.clear();
    await this.db.clear('replica');
    this.notify();
  }

  private notify(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
```

- [ ] **Step 6: PASS + commit**

```bash
npm test -w @libify/web
git add apps/web/src/shared/db apps/web/src/shared/sync/ReplicaStore.ts apps/web/src/shared/sync/ReplicaStore.test.ts
git commit -m "feat(web): IndexedDB replica store with last-write-wins merge"
```

---

### Task 6: Outbox (TDD)

**Files:** `apps/web/src/shared/sync/Outbox.ts`, тест `Outbox.test.ts`

- [ ] **Step 1: Падающий тест**

```ts
import { describe, expect, it } from 'vitest';
import type { SyncOp } from '@libify/shared';
import { openLibifyDb } from '../db/libifyDb';
import { Outbox } from './Outbox';

const op = (key: string, at: string): SyncOp => ({ entity: 'favorite', key, clientUpdatedAt: at, data: null });
let n = 0;
const fresh = async () => new Outbox(await openLibifyDb(`test-outbox-${n++}`));

describe('Outbox', () => {
  it('keeps only the newest op per record', async () => {
    const outbox = await fresh();
    await outbox.put(op('1', '2026-01-01T00:00:01.000Z'));
    await outbox.put(op('1', '2026-01-01T00:00:02.000Z'));
    await outbox.put(op('2', '2026-01-01T00:00:01.000Z'));
    const entries = await outbox.peek(10);
    expect(entries.map((e) => [e.op.key, e.op.clientUpdatedAt])).toEqual([
      ['1', '2026-01-01T00:00:02.000Z'],
      ['2', '2026-01-01T00:00:01.000Z'],
    ]);
  });

  it('peek respects the limit', async () => {
    const outbox = await fresh();
    for (let i = 0; i < 5; i++) await outbox.put(op(String(i), '2026-01-01T00:00:01.000Z'));
    expect(await outbox.peek(3)).toHaveLength(3);
  });

  it('acknowledge does not drop an op that was replaced while pushing', async () => {
    const outbox = await fresh();
    await outbox.put(op('1', '2026-01-01T00:00:01.000Z'));
    const sent = await outbox.peek(10);
    await outbox.put(op('1', '2026-01-01T00:00:05.000Z'));
    await outbox.acknowledge(sent);
    const left = await outbox.peek(10);
    expect(left.map((e) => e.op.clientUpdatedAt)).toEqual(['2026-01-01T00:00:05.000Z']);
  });

  it('clear empties the queue', async () => {
    const outbox = await fresh();
    await outbox.put(op('1', '2026-01-01T00:00:01.000Z'));
    await outbox.clear();
    expect(await outbox.size()).toBe(0);
  });
});
```

- [ ] **Step 2: FAIL**, затем **Step 3: `apps/web/src/shared/sync/Outbox.ts`**

```ts
import type { SyncOp } from '@libify/shared';
import { recordId, type LibifyDatabase, type OutboxEntry } from '../db/libifyDb';

/** Persistent queue of local changes not yet confirmed by the server. */
export class Outbox {
  private readonly db: LibifyDatabase;

  constructor(db: LibifyDatabase) {
    this.db = db;
  }

  async put(op: SyncOp): Promise<void> {
    await this.db.put('outbox', { id: recordId(op.entity, op.key), op });
  }

  async peek(limit: number): Promise<OutboxEntry[]> {
    return this.db.getAll('outbox', undefined, limit);
  }

  /** Removes sent entries unless a newer op for the same record arrived meanwhile. */
  async acknowledge(sent: readonly OutboxEntry[]): Promise<void> {
    const tx = this.db.transaction('outbox', 'readwrite');
    for (const entry of sent) {
      const stored = await tx.store.get(entry.id);
      if (stored && stored.op.clientUpdatedAt === entry.op.clientUpdatedAt) await tx.store.delete(entry.id);
    }
    await tx.done;
  }

  size(): Promise<number> {
    return this.db.count('outbox');
  }

  async clear(): Promise<void> {
    await this.db.clear('outbox');
  }
}
```

- [ ] **Step 4: PASS + commit**

```bash
npm test -w @libify/web
git add apps/web/src/shared/sync/Outbox.ts apps/web/src/shared/sync/Outbox.test.ts
git commit -m "feat(web): persistent sync outbox with per-record coalescing"
```

---

### Task 7: SyncEngine (TDD)

**Files:** `apps/web/src/shared/sync/{SyncEngine,browserSignals}.ts`, тест `SyncEngine.test.ts`

- [ ] **Step 1: Падающий тест `apps/web/src/shared/sync/SyncEngine.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncOp, SyncPullResponse, SyncPushResponse } from '@libify/shared';
import { ApiError } from '../api/ApiError';
import type { SyncApi } from '../api/SyncApi';
import { openLibifyDb } from '../db/libifyDb';
import { MetaStore } from '../db/MetaStore';
import { Outbox } from './Outbox';
import { ReplicaStore } from './ReplicaStore';
import { SyncEngine, type SyncSignals } from './SyncEngine';

class FakeSyncApi {
  pushed: SyncOp[][] = [];
  pullSince: Array<string | null> = [];
  pushImpl: (ops: SyncOp[]) => Promise<SyncPushResponse> = async (ops) => {
    this.pushed.push(ops);
    return { applied: ops.length, rejected: [], serverTime: '2026-01-01T00:00:10.000Z' };
  };
  pullImpl: (since: string | null) => Promise<SyncPullResponse> = async () => ({
    serverTime: '2026-01-01T00:00:10.000Z',
    changes: [],
  });
  push(ops: SyncOp[]) {
    return this.pushImpl(ops);
  }
  pull(since: string | null) {
    this.pullSince.push(since);
    return this.pullImpl(since);
  }
}

const noSignals: SyncSignals = { subscribe: () => () => {} };
const fav = (bookId: string) => ({ bookId, title: 'T', author: null, coverUrl: null });

let n = 0;
async function setup() {
  const db = await openLibifyDb(`test-engine-${n++}`);
  const api = new FakeSyncApi();
  const replica = await ReplicaStore.load(db);
  const outbox = new Outbox(db);
  const meta = new MetaStore(db);
  const engine = new SyncEngine({ api: api as unknown as SyncApi, replica, outbox, meta, signals: noSignals });
  return { api, replica, outbox, meta, engine };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('SyncEngine', () => {
  it('records locally, then pushes and pulls on sync', async () => {
    const { api, replica, outbox, engine } = await setup();
    await engine.start('u1');
    await engine.record('favorite', '1', fav('1'));
    expect(replica.get('favorite', '1')?.bookId).toBe('1');
    expect(await outbox.size()).toBe(1);

    await engine.syncNow();
    expect(api.pushed.flat().map((o) => o.key)).toEqual(['1']);
    expect(await outbox.size()).toBe(0);
    expect(api.pullSince.at(-1)).toBe('2026-01-01T00:00:10.000Z');
    engine.stop();
  });

  it('issues strictly increasing timestamps for rapid writes', async () => {
    const { replica, engine } = await setup();
    await engine.record('favorite', '1', fav('1'));
    const first = replica.getRecord('favorite', '1')!.updatedAt;
    await engine.record('favorite', '1', null);
    expect(replica.getRecord('favorite', '1')!.updatedAt > first).toBe(true);
    expect(replica.get('favorite', '1')).toBeNull();
  });

  it('rejects records that violate the shared schema', async () => {
    const { engine, outbox } = await setup();
    await expect(engine.record('favorite', '1', { bookId: '1', title: '', author: null, coverUrl: null })).rejects.toThrow();
    expect(await outbox.size()).toBe(0);
  });

  it('merges pulled changes with last-write-wins', async () => {
    const { api, replica, engine } = await setup();
    api.pullImpl = async () => ({
      serverTime: '2026-01-01T00:00:10.000Z',
      changes: [{ entity: 'favorite', key: '7', updatedAt: '2026-01-01T00:00:05.000Z', data: fav('7') }],
    });
    await engine.start('u1');
    expect(replica.get('favorite', '7')?.bookId).toBe('7');
    engine.stop();
  });

  it('keeps the outbox when offline and reports offline status', async () => {
    const { api, outbox, engine } = await setup();
    await engine.start('u1');
    api.pushImpl = async () => {
      throw new ApiError('NETWORK', 0, 'offline');
    };
    await engine.record('favorite', '1', fav('1'));
    await engine.syncNow();
    expect(await outbox.size()).toBe(1);
    expect(engine.getStatus()).toBe('offline');
    engine.stop();
  });

  it('drops a batch the server refuses as invalid instead of retrying forever', async () => {
    const { api, outbox, engine } = await setup();
    await engine.start('u1');
    api.pushImpl = async () => {
      throw new ApiError('VALIDATION_FAILED', 400, 'bad');
    };
    await engine.record('favorite', '1', fav('1'));
    await engine.syncNow();
    expect(await outbox.size()).toBe(0);
    engine.stop();
  });

  it('wipes local data when a different user starts', async () => {
    const { replica, engine } = await setup();
    await engine.start('u1');
    await engine.record('favorite', '1', fav('1'));
    engine.stop();
    await engine.start('u2');
    expect(replica.get('favorite', '1')).toBeNull();
    engine.stop();
  });

  it('coalesces concurrent syncNow calls', async () => {
    const { api, engine } = await setup();
    await engine.start('u1');
    const before = api.pullSince.length;
    await Promise.all([engine.syncNow(), engine.syncNow(), engine.syncNow()]);
    expect(api.pullSince.length - before).toBeLessThanOrEqual(2);
    engine.stop();
  });
});
```

- [ ] **Step 2: FAIL**, затем **Step 3: `apps/web/src/shared/sync/SyncEngine.ts`**

```ts
import { SYNC_PUSH_MAX_OPS, syncOpSchema, type SyncDataMap, type SyncEntity } from '@libify/shared';
import { ApiError } from '../api/ApiError';
import type { SyncApi } from '../api/SyncApi';
import type { MetaStore } from '../db/MetaStore';
import type { Outbox } from './Outbox';
import type { ReplicaStore } from './ReplicaStore';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

/** Something that tells the engine "now is a good moment to sync" (back online, tab visible...). */
export interface SyncSignals {
  subscribe(trigger: () => void): () => void;
}

export interface SyncEngineDeps {
  api: SyncApi;
  replica: ReplicaStore;
  outbox: Outbox;
  meta: MetaStore;
  signals: SyncSignals;
}

const META_CURSOR = 'sync.cursor';
const META_OWNER = 'sync.ownerId';

export class SyncEngine {
  static readonly PULL_INTERVAL_MS = 60_000;
  static readonly PUSH_DEBOUNCE_MS = 2_000;
  static readonly MAX_RETRY_DELAY_MS = 5 * 60_000;

  private readonly deps: SyncEngineDeps;
  private userId: string | null = null;
  private running: Promise<void> | null = null;
  private rerunRequested = false;
  private failures = 0;
  private lastIssuedMs = 0;
  private status: SyncStatus = 'idle';
  private readonly statusListeners = new Set<(status: SyncStatus) => void>();
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pullInterval: ReturnType<typeof setInterval> | null = null;
  private unsubscribeSignals: (() => void) | null = null;

  constructor(deps: SyncEngineDeps) {
    this.deps = deps;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Begins syncing for a user. Local data of a different previous user is wiped first. */
  async start(userId: string): Promise<void> {
    this.stop();
    const owner = await this.deps.meta.get<string>(META_OWNER);
    if (owner && owner !== userId) await this.resetLocalData();
    await this.deps.meta.set(META_OWNER, userId);

    this.userId = userId;
    this.unsubscribeSignals = this.deps.signals.subscribe(() => void this.syncNow());
    this.pullInterval = setInterval(() => void this.syncNow(), SyncEngine.PULL_INTERVAL_MS);
    await this.syncNow();
  }

  stop(): void {
    this.userId = null;
    this.unsubscribeSignals?.();
    this.unsubscribeSignals = null;
    for (const timer of [this.pushTimer, this.retryTimer]) if (timer) clearTimeout(timer);
    if (this.pullInterval) clearInterval(this.pullInterval);
    this.pushTimer = this.retryTimer = this.pullInterval = null;
  }

  async resetLocalData(): Promise<void> {
    await Promise.all([
      this.deps.replica.clear(),
      this.deps.outbox.clear(),
      this.deps.meta.delete(META_CURSOR),
      this.deps.meta.delete(META_OWNER),
    ]);
  }

  /** Writes a local change (null = delete). Memory is updated before the returned promise settles. */
  async record<E extends SyncEntity>(entity: E, key: string, data: SyncDataMap[E] | null): Promise<void> {
    const updatedAt = this.nextTimestamp(this.deps.replica.getRecord(entity, key)?.updatedAt);
    const parsed = syncOpSchema.safeParse({ entity, key, clientUpdatedAt: updatedAt, data });
    if (!parsed.success) throw new Error(`Invalid ${entity} record: ${parsed.error.message}`);

    await this.deps.replica.apply([{ entity, key, updatedAt, data }]);
    await this.deps.outbox.put(parsed.data);
    this.schedulePush();
  }

  /** Push pending changes, then pull. Concurrent calls share one run (plus at most one follow-up). */
  syncNow(): Promise<void> {
    if (!this.userId) return Promise.resolve();
    if (this.running) {
      this.rerunRequested = true;
      return this.running;
    }
    this.running = this.runLoop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runLoop(): Promise<void> {
    do {
      this.rerunRequested = false;
      await this.syncOnce();
    } while (this.rerunRequested && this.userId);
  }

  private async syncOnce(): Promise<void> {
    this.setStatus('syncing');
    try {
      await this.pushAll();
      await this.pull();
      this.failures = 0;
      this.setStatus('idle');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
        this.stop();
        this.setStatus('error');
        return;
      }
      this.failures += 1;
      this.setStatus(err instanceof ApiError && err.isNetwork ? 'offline' : 'error');
      this.scheduleRetry();
    }
  }

  private async pushAll(): Promise<void> {
    for (;;) {
      const batch = await this.deps.outbox.peek(SYNC_PUSH_MAX_OPS);
      if (batch.length === 0) return;
      try {
        await this.deps.api.push(batch.map((entry) => entry.op));
      } catch (err) {
        // Ops are pre-validated with the same schema; a 400/413 means version skew. Do not loop forever.
        if (err instanceof ApiError && (err.code === 'VALIDATION_FAILED' || err.code === 'PAYLOAD_TOO_LARGE')) {
          console.error('[sync] server refused batch, dropping it', err);
          await this.deps.outbox.acknowledge(batch);
          continue;
        }
        throw err;
      }
      // STALE rejections need no action: the following pull brings the newer server version.
      await this.deps.outbox.acknowledge(batch);
    }
  }

  private async pull(): Promise<void> {
    const since = (await this.deps.meta.get<string>(META_CURSOR)) ?? null;
    const response = await this.deps.api.pull(since);
    await this.deps.replica.apply(response.changes);
    await this.deps.meta.set(META_CURSOR, response.serverTime);
  }

  private schedulePush(): void {
    if (!this.userId) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.syncNow();
    }, SyncEngine.PUSH_DEBOUNCE_MS);
  }

  private scheduleRetry(): void {
    if (!this.userId || this.retryTimer) return;
    const delay = Math.min(SyncEngine.MAX_RETRY_DELAY_MS, 5_000 * 2 ** (this.failures - 1));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncNow();
    }, delay);
  }

  /** Strictly increasing ISO timestamps, so two writes in one millisecond still order correctly. */
  private nextTimestamp(previous: string | undefined): string {
    const floor = Math.max(this.lastIssuedMs, previous ? Date.parse(previous) : 0);
    this.lastIssuedMs = Math.max(Date.now(), floor + 1);
    return new Date(this.lastIssuedMs).toISOString();
  }

  private setStatus(status: SyncStatus): void {
    if (status === this.status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
```

- [ ] **Step 4: `apps/web/src/shared/sync/browserSignals.ts`**

```ts
import type { SyncSignals } from './SyncEngine';

export const browserSyncSignals: SyncSignals = {
  subscribe(trigger) {
    const onOnline = () => trigger();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') trigger();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  },
};
```

- [ ] **Step 5: PASS.** `npm test -w @libify/web` — все тесты SyncEngine зелёные. Тест «drops a batch» проверяет
отсутствие бесконечного цикла: если он висит, проверить, что `acknowledge` вызывается до `continue`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/shared/sync
git commit -m "feat(web): offline-first SyncEngine with outbox, retries and user isolation"
```

---

### Task 8: Композиционный корень, импорт старых данных, хук

**Files:** `apps/web/src/shared/services.ts`, `apps/web/src/shared/sync/{legacyImport,useReplicaVersion}.ts`,
тест `legacyImport.test.ts`, `apps/web/src/main.tsx`

- [ ] **Step 1: `apps/web/src/shared/services.ts`**

```ts
import { AdminApi } from './api/AdminApi';
import { ApiClient } from './api/ApiClient';
import { AuthApi } from './api/AuthApi';
import { CatalogApi } from './api/CatalogApi';
import { SyncApi } from './api/SyncApi';
import { openLibifyDb } from './db/libifyDb';
import { MetaStore } from './db/MetaStore';
import { browserSyncSignals } from './sync/browserSignals';
import { Outbox } from './sync/Outbox';
import { ReplicaStore } from './sync/ReplicaStore';
import { SyncEngine } from './sync/SyncEngine';

export interface AppServices {
  api: ApiClient;
  auth: AuthApi;
  catalog: CatalogApi;
  admin: AdminApi;
  replica: ReplicaStore;
  meta: MetaStore;
  sync: SyncEngine;
}

let instance: AppServices | null = null;

/** Composition root. Must resolve before the React tree renders. */
export async function initServices(): Promise<AppServices> {
  if (instance) return instance;
  const db = await openLibifyDb();
  const api = new ApiClient();
  const replica = await ReplicaStore.load(db);
  const meta = new MetaStore(db);
  const sync = new SyncEngine({ api: new SyncApi(api), replica, outbox: new Outbox(db), meta, signals: browserSyncSignals });

  // Legacy pages listen for this event to re-read state.
  replica.subscribe(() => window.dispatchEvent(new Event('storage-update')));

  instance = { api, auth: new AuthApi(api), catalog: new CatalogApi(api), admin: new AdminApi(api), replica, meta, sync };
  return instance;
}

export function services(): AppServices {
  if (!instance) throw new Error('services() called before initServices() resolved');
  return instance;
}
```

- [ ] **Step 2: Падающий тест `apps/web/src/shared/sync/legacyImport.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { openLibifyDb } from '../db/libifyDb';
import { MetaStore } from '../db/MetaStore';
import { importLegacyState, type LegacyRecorder } from './legacyImport';

const legacy = JSON.stringify({
  myBooks: ['10', 'ghost'],
  bookMetadata: { '10': { id: '10', title: 'Old Book', author: 'A', cover: 'data:image/png;base64,xx', format: 'fb2' } },
  readingProgress: { '10': { bookId: '10', currentPage: 40, totalPages: 100, lastRead: 1, scrollPercentage: 40 } },
});

describe('importLegacyState', () => {
  it('imports old local books and progress exactly once', async () => {
    const meta = new MetaStore(await openLibifyDb('test-legacy'));
    const recorder: LegacyRecorder = { record: vi.fn(async () => {}) };
    const storage = { getItem: () => legacy };

    await importLegacyState(recorder, meta, storage);
    await importLegacyState(recorder, meta, storage);

    const calls = vi.mocked(recorder.record).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([
      'book',
      '10',
      expect.objectContaining({ bookId: '10', title: 'Old Book', coverUrl: null, status: 'reading' }),
    ]);
    expect(calls[1]).toEqual([
      'progress',
      '10',
      { bookId: '10', paragraphIndex: 40, scrollRatio: 0.4, currentPage: 40, totalPages: 100 },
    ]);
  });
});
```

- [ ] **Step 3: `apps/web/src/shared/sync/legacyImport.ts`**

```ts
import type { BookData, ProgressData, SyncDataMap, SyncEntity } from '@libify/shared';
import type { MetaStore } from '../db/MetaStore';

const LEGACY_KEY = 'book-library-state';
const META_DONE = 'legacy.imported';

export interface LegacyRecorder {
  record<E extends SyncEntity>(entity: E, key: string, data: SyncDataMap[E] | null): Promise<void>;
}

interface LegacyState {
  myBooks?: string[];
  bookMetadata?: Record<string, { id: string; title?: string; author?: string; cover?: string; format?: string }>;
  readingProgress?: Record<string, { currentPage?: number; totalPages?: number; scrollPercentage?: number }>;
}

const isRemoteUrl = (value: string | undefined): value is string =>
  !!value && value.length <= 2048 && !value.startsWith('data:') && !value.startsWith('blob:');

/** One-time upload of books/progress that lived only in localStorage before v2 (cloud data was lost). */
export async function importLegacyState(
  recorder: LegacyRecorder,
  meta: MetaStore,
  storage: Pick<Storage, 'getItem'> = localStorage,
): Promise<void> {
  if (await meta.get<boolean>(META_DONE)) return;

  let state: LegacyState = {};
  try {
    state = JSON.parse(storage.getItem(LEGACY_KEY) ?? '{}') as LegacyState;
  } catch {
    // corrupted legacy state: nothing to import
  }

  const now = new Date().toISOString();
  for (const id of state.myBooks ?? []) {
    const book = state.bookMetadata?.[id];
    if (!book) continue;
    const data: BookData = {
      bookId: id,
      title: (book.title || 'Untitled').slice(0, 500),
      author: book.author ? book.author.slice(0, 300) : null,
      coverUrl: isRemoteUrl(book.cover) ? book.cover : null,
      status: 'reading',
      format: book.format === 'pdf' ? 'pdf' : 'fb2',
      addedAt: now,
    };
    await recorder.record('book', id, data).catch((err) => console.warn('[legacy] book skipped', id, err));

    const progress = state.readingProgress?.[id];
    if (progress) {
      const page = Math.max(0, Math.floor(progress.currentPage ?? 0));
      const data: ProgressData = {
        bookId: id,
        paragraphIndex: page,
        scrollRatio: Math.min(1, Math.max(0, (progress.scrollPercentage ?? 0) / 100)),
        currentPage: page,
        totalPages: Math.max(0, Math.floor(progress.totalPages ?? 0)),
      };
      await recorder.record('progress', id, data).catch((err) => console.warn('[legacy] progress skipped', id, err));
    }
  }
  await meta.set(META_DONE, true);
}
```

- [ ] **Step 4: `apps/web/src/shared/sync/useReplicaVersion.ts`**

```ts
import { useSyncExternalStore } from 'react';
import { services } from '../services';

/** Re-renders the component whenever any synced record changes. */
export function useReplicaVersion(): number {
  const { replica } = services();
  return useSyncExternalStore(
    (onChange) => replica.subscribe(onChange),
    () => replica.getVersion(),
  );
}
```

- [ ] **Step 5: `apps/web/src/main.tsx`** — заменить содержимое (сохранив существующие импорты стилей; проверить
текущий файл и перенести из него всё, что не относится к рендеру):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initServices } from './shared/services';

const container = document.getElementById('root')!;

initServices()
  .then(() => {
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((err: unknown) => {
    console.error('Failed to start Libify', err);
    container.textContent = 'Libify could not open local storage. Disable private mode or free up space and reload.';
  });
```

Если в текущем `main.tsx` `App` экспортируется по имени (`import { App }`) или есть регистрация SW / другие
side-effects — сохранить их как есть.

- [ ] **Step 6: PASS + commit**

```bash
npm test -w @libify/web
git add apps/web/src/shared apps/web/src/main.tsx
git commit -m "feat(web): services composition root, legacy data import, replica hook"
```

---

### Task 9: Хранилище и сервисы данных поверх реплики

**Files:** `apps/web/src/types/index.ts`, `apps/web/src/utils/storage.ts`, `apps/web/src/services/db.ts`

- [ ] **Step 1: `apps/web/src/types/index.ts`** — заменить `AppState`, `Quote`, `Favorite`, `Bookmark`:

```ts
export interface AppState {
  myBooks: string[];
  bookMetadata: Record<string, Book>;
  readingProgress: Record<string, ReadingProgress>;
  settings: UserSettings;
}

export interface Quote {
  id: string;
  book_id: string;
  book_title?: string;
  book_author?: string;
  text: string;
  note?: string;
  color?: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  book_id: string;
  book_title?: string;
  book_author?: string;
  book_cover?: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  book_id: string;
  book_title?: string;
  paragraph_index: number;
  preview_text?: string;
  created_at: string;
}
```

- [ ] **Step 2: `apps/web/src/utils/storage.ts`** — полная замена:

```ts
import type { BookData, ProgressData } from '@libify/shared';
import { services } from '../shared/services';
import type { AppState, Book, ReadingProgress, UserSettings } from '../types';

/**
 * Library membership and progress live in the synced replica.
 * Rich per-device metadata (description, series, chapters cover) and settings stay in localStorage.
 */
const LOCAL_KEY = 'book-library-state';

interface LocalState {
  bookMetadata: Record<string, Book>;
  settings: UserSettings;
}

const defaultSettings: UserSettings = { fontSize: 18, brightness: 100, theme: 'dark' };
let cachedLocal: LocalState | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_KEY) cachedLocal = null;
  });
}

function loadLocal(): LocalState {
  if (cachedLocal) return cachedLocal;
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as Partial<LocalState>;
    cachedLocal = { bookMetadata: parsed.bookMetadata ?? {}, settings: { ...defaultSettings, ...parsed.settings } };
  } catch {
    cachedLocal = { bookMetadata: {}, settings: { ...defaultSettings } };
  }
  return cachedLocal;
}

function saveLocal(state: LocalState): void {
  cachedLocal = state;
  try {
    // Keep unknown legacy fields (myBooks, readingProgress) out: they were imported into the replica.
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save local state', err);
  }
}

const notify = () => window.dispatchEvent(new Event('storage-update'));
const logSyncError = (err: unknown) => console.error('[storage] sync record failed', err);

/** Only remote URLs are synced; data:/blob: covers stay in the local book cache. */
export function syncableCoverUrl(cover: string | undefined): string | null {
  if (!cover || cover.startsWith('data:') || cover.startsWith('blob:') || cover.length > 2048) return null;
  return cover;
}

function toBookData(book: Book, addedAt: string): BookData {
  return {
    bookId: book.id,
    title: (book.title || 'Untitled').slice(0, 500),
    author: book.author ? book.author.slice(0, 300) : null,
    coverUrl: syncableCoverUrl(book.cover),
    status: 'reading',
    format: book.format === 'pdf' ? 'pdf' : 'fb2',
    addedAt,
  };
}

function bookFromData(data: BookData): Book {
  return {
    id: data.bookId,
    title: data.title,
    author: data.author ?? '',
    cover: data.coverUrl ?? '',
    description: '',
    genre: '',
    format: data.format === 'pdf' ? 'pdf' : 'fb2',
  };
}

function toReadingProgress(data: ProgressData, updatedAt: string): ReadingProgress {
  return {
    bookId: data.bookId,
    currentPage: data.currentPage,
    totalPages: data.totalPages,
    lastRead: Date.parse(updatedAt),
    scrollPercentage: Math.round(data.scrollRatio * 100),
  };
}

export function getMyBookIds(): string[] {
  return services()
    .replica.list('book')
    .sort((a, b) => a.data.addedAt.localeCompare(b.data.addedAt))
    .map((entry) => entry.key);
}

export function isInMyBooks(bookId: string): boolean {
  return services().replica.get('book', bookId) !== null;
}

export function getBookMetadata(bookId: string): Book | undefined {
  const local = loadLocal().bookMetadata[bookId];
  if (local) return local;
  const data = services().replica.get('book', bookId);
  return data ? bookFromData(data) : undefined;
}

export function addToMyBooks(book: Book): void {
  const local = loadLocal();
  const toStore = { ...book };
  if (toStore.cover?.startsWith('data:image')) toStore.cover = ''; // the cover lives in the IndexedDB book cache
  saveLocal({ ...local, bookMetadata: { ...local.bookMetadata, [book.id]: toStore } });

  const existing = services().replica.get('book', book.id);
  const next = toBookData(book, existing?.addedAt ?? new Date().toISOString());
  if (!existing || JSON.stringify(existing) !== JSON.stringify(next)) {
    services().sync.record('book', book.id, next).catch(logSyncError);
  }
  notify();
}

export function removeFromMyBooks(bookId: string): void {
  services().sync.record('book', bookId, null).catch(logSyncError);
}

export function getReadingProgress(bookId: string): ReadingProgress | null {
  const record = services().replica.getRecord('progress', bookId);
  return record?.data ? toReadingProgress(record.data as ProgressData, record.updatedAt) : null;
}

export function saveReadingProgress(progress: ReadingProgress): void {
  const page = Math.max(0, Math.floor(progress.currentPage));
  const data: ProgressData = {
    bookId: progress.bookId,
    paragraphIndex: page,
    scrollRatio: Math.min(1, Math.max(0, (progress.scrollPercentage ?? 0) / 100)),
    currentPage: page,
    totalPages: Math.max(0, Math.floor(progress.totalPages)),
  };
  services().sync.record('progress', progress.bookId, data).catch(logSyncError);
}

export function getAppState(): AppState {
  const myBooks = getMyBookIds();
  const bookMetadata: Record<string, Book> = {};
  for (const id of myBooks) {
    const book = getBookMetadata(id);
    if (book) bookMetadata[id] = book;
  }
  const readingProgress: Record<string, ReadingProgress> = {};
  for (const entry of services().replica.list('progress')) {
    readingProgress[entry.key] = toReadingProgress(entry.data, entry.updatedAt);
  }
  return { myBooks, bookMetadata, readingProgress, settings: loadLocal().settings };
}

export function getSettings(): UserSettings {
  return loadLocal().settings;
}

export function saveSettings(settings: UserSettings): void {
  saveLocal({ ...loadLocal(), settings });
}
```

- [ ] **Step 3: `apps/web/src/services/db.ts`** — полная замена:

```ts
import type { BookmarkData, FavoriteData, QuoteData } from '@libify/shared';
import { services } from '../shared/services';
import type { Bookmark, Favorite, Quote } from '../types';
import { syncableCoverUrl } from '../utils/storage';

const byNewest = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at);
const clip = (value: string | undefined, max: number) => (value ? value.slice(0, max) : null);

// --- Quotes ---

function toQuote(d: QuoteData, updatedAt: string): Quote {
  return {
    id: d.id,
    book_id: d.bookId,
    book_title: d.bookTitle ?? undefined,
    book_author: d.bookAuthor ?? undefined,
    text: d.text,
    note: d.note ?? undefined,
    color: d.color,
    created_at: updatedAt,
  };
}

export async function addQuote(quote: { book_id: string; book_title?: string; book_author?: string; text: string; note?: string; color?: string }): Promise<Quote> {
  const data: QuoteData = {
    id: crypto.randomUUID(),
    bookId: quote.book_id,
    bookTitle: clip(quote.book_title, 500),
    bookAuthor: clip(quote.book_author, 300),
    text: quote.text.slice(0, 10_000),
    note: clip(quote.note, 5_000),
    color: quote.color ?? 'yellow',
  };
  await services().sync.record('quote', data.id, data);
  return toQuote(data, new Date().toISOString());
}

export async function deleteQuote(id: string): Promise<void> {
  await services().sync.record('quote', id, null);
}

export async function getQuotes(bookId?: string): Promise<Quote[]> {
  return services()
    .replica.list('quote')
    .filter((e) => !bookId || e.data.bookId === bookId)
    .map((e) => toQuote(e.data, e.updatedAt))
    .sort(byNewest);
}

// --- Favorites ---

function toFavorite(d: FavoriteData, updatedAt: string): Favorite {
  return {
    id: d.bookId,
    book_id: d.bookId,
    book_title: d.title,
    book_author: d.author ?? undefined,
    book_cover: d.coverUrl ?? undefined,
    created_at: updatedAt,
  };
}

export async function addFavorite(book: { id: string; title: string; author: string; cover: string }): Promise<Favorite> {
  const data: FavoriteData = {
    bookId: book.id,
    title: (book.title || 'Untitled').slice(0, 500),
    author: clip(book.author, 300),
    coverUrl: syncableCoverUrl(book.cover),
  };
  await services().sync.record('favorite', book.id, data);
  return toFavorite(data, new Date().toISOString());
}

export async function removeFavorite(bookId: string): Promise<void> {
  await services().sync.record('favorite', bookId, null);
}

export async function getFavorites(): Promise<Favorite[]> {
  return services()
    .replica.list('favorite')
    .map((e) => toFavorite(e.data, e.updatedAt))
    .sort(byNewest);
}

export async function isBookFavorite(bookId: string): Promise<boolean> {
  return services().replica.get('favorite', bookId) !== null;
}

// --- Bookmarks ---

function toBookmark(d: BookmarkData, updatedAt: string): Bookmark {
  return {
    id: d.id,
    book_id: d.bookId,
    book_title: d.bookTitle ?? undefined,
    paragraph_index: d.paragraphIndex,
    preview_text: d.previewText ?? undefined,
    created_at: updatedAt,
  };
}

export async function addBookmark(bookmark: { book_id: string; book_title?: string; paragraph_index: number; preview_text?: string }): Promise<Bookmark> {
  const existing = services()
    .replica.list('bookmark')
    .find((e) => e.data.bookId === bookmark.book_id && e.data.paragraphIndex === bookmark.paragraph_index);
  if (existing) return toBookmark(existing.data, existing.updatedAt);

  const data: BookmarkData = {
    id: crypto.randomUUID(),
    bookId: bookmark.book_id,
    bookTitle: clip(bookmark.book_title, 500),
    paragraphIndex: bookmark.paragraph_index,
    previewText: clip(bookmark.preview_text, 500),
  };
  await services().sync.record('bookmark', data.id, data);
  return toBookmark(data, new Date().toISOString());
}

export async function deleteBookmark(id: string): Promise<void> {
  await services().sync.record('bookmark', id, null);
}

export async function getBookmarks(bookId?: string): Promise<Bookmark[]> {
  return services()
    .replica.list('bookmark')
    .filter((e) => !bookId || e.data.bookId === bookId)
    .map((e) => toBookmark(e.data, e.updatedAt))
    .sort(byNewest);
}
```

- [ ] **Step 4: Commit** (typecheck ещё красный из-за вызывающих сторон — чинится в Task 10–12)

```bash
git add apps/web/src/types apps/web/src/utils/storage.ts apps/web/src/services/db.ts
git commit -m "feat(web): storage and data services on top of the synced replica"
```

---

### Task 10: Авторизация на фронте

**Files:** `apps/web/src/contexts/AuthContext.tsx`, `apps/web/src/pages/Auth.tsx`, `apps/web/src/components/Sidebar.tsx`,
`apps/web/src/locales/{en,uk}.json`

- [ ] **Step 1: `apps/web/src/contexts/AuthContext.tsx`** — полная замена:

```tsx
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Credentials, LoginInput, PublicUser } from '@libify/shared';
import { services } from '../shared/services';
import { importLegacyState } from '../shared/sync/legacyImport';

interface AuthContextType {
  user: PublicUser | null;
  loading: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: Credentials): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_CACHE_KEY = 'libify.user';

function readCachedUser(): PublicUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_CACHE_KEY) ?? 'null') as PublicUser | null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: PublicUser | null): void {
  if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_CACHE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const svc = useMemo(() => services(), []);
  // Cached user lets the app open offline; /auth/me confirms or clears it.
  const [user, setUser] = useState<PublicUser | null>(readCachedUser);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback((next: PublicUser | null) => {
    writeCachedUser(next);
    setUser(next);
  }, []);

  useEffect(() => {
    svc.api.onUnauthorized(() => applyUser(null));
    return () => svc.api.onUnauthorized(null);
  }, [svc, applyUser]);

  useEffect(() => {
    let cancelled = false;
    svc.auth
      .me()
      .then((me) => {
        if (!cancelled) applyUser(me);
      })
      .catch((err) => console.warn('[auth] offline, using cached user', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [svc, applyUser]);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    svc.sync
      .start(userId)
      .then(() => importLegacyState(svc.sync, svc.meta))
      .catch((err) => console.error('[sync] start failed', err));
    return () => svc.sync.stop();
  }, [svc, userId]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      login: async (input) => applyUser(await svc.auth.login(input)),
      register: async (input) => applyUser(await svc.auth.register(input)),
      signOut: async () => {
        await svc.sync.syncNow().catch(() => {}); // best effort: send pending changes first
        await svc.auth.logout().catch(() => {});
        svc.sync.stop();
        await svc.sync.resetLocalData();
        applyUser(null);
      },
    }),
    [user, loading, svc, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
```

- [ ] **Step 2: Локали.** В `apps/web/src/locales/en.json`:
  - в `auth` удалить `email`, `emailPlaceholder`, `forgotPassword`, `resetPassword`, `resetPasswordDesc`,
    `sendResetLink`, `backToLogin`, `resetLinkSent`, `accountCreated`; добавить
    `"nicknameHint": "3–24 characters: letters, digits, _"`, `"passwordHint": "At least 8 characters"`;
    `"nicknamePlaceholder": "your_nickname"`.
  - в `errors` заменить `invalidCredentials` на `"Wrong username or password."`, `userAlreadyExists` на
    `"This username is already taken."`, `passwordTooShort` на `"Password must be at least 8 characters."`;
    добавить `"invalidNickname": "Username: 3–24 characters, letters, digits and _ only."`,
    `"tooManyAttempts": "Too many attempts. Try again in a minute."`.

  В `uk.json` те же ключи: `nicknameHint` — `"3–24 символи: літери, цифри, _"`, `passwordHint` —
  `"Щонайменше 8 символів"`, `nicknamePlaceholder` — `"your_nickname"`; `invalidCredentials` —
  `"Неправильне ім'я користувача або пароль."`, `userAlreadyExists` — `"Це ім'я вже зайняте."`,
  `passwordTooShort` — `"Пароль має містити щонайменше 8 символів."`, `invalidNickname` —
  `"Ім'я: 3–24 символи, лише літери, цифри та _."`, `tooManyAttempts` — `"Забагато спроб. Спробуйте за хвилину."`.

  Затем `grep -rn "auth\.\(email\|forgotPassword\|resetPassword\|resetLinkSent\|accountCreated\|backToLogin\|sendResetLink\)" apps/web/src`
  → должно быть пусто после Step 3.

- [ ] **Step 3: `apps/web/src/pages/Auth.tsx`** — полная замена (визуально как раньше, без email и сброса пароля):

```tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Globe, Loader2, Lock, User } from 'lucide-react';
import { NICKNAME_PATTERN } from '@libify/shared';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LANGUAGES } from '../constants/languages';
import { ApiError } from '../shared/api/ApiError';

const inputClass =
  'w-full h-11 bg-white/[0.04] rounded-xl pl-10 pr-4 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 border border-white/[0.08] transition-all';

export function Auth() {
  const { login, register } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    if (!showLangDropdown) return;
    const onClick = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) setShowLangDropdown(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLangDropdown(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showLangDropdown]);

  const messageFor = (err: unknown): string => {
    if (!(err instanceof ApiError)) return t('errors.unknownAuthError');
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        return t('errors.invalidCredentials');
      case 'NICKNAME_TAKEN':
        return t('errors.userAlreadyExists');
      case 'RATE_LIMITED':
        return t('errors.tooManyAttempts');
      case 'NETWORK':
      case 'TIMEOUT':
        return t('errors.connectionError');
      default:
        return t('errors.unknownAuthError');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nick = nickname.trim();
    if (!isLogin) {
      if (!NICKNAME_PATTERN.test(nick)) return setError(t('errors.invalidNickname'));
      if (password.length < 8) return setError(t('errors.passwordTooShort'));
    }
    setLoading(true);
    setError(null);
    try {
      if (isLogin) await login({ nickname: nick, password });
      else await register({ nickname: nick, password });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (login: boolean) => {
    setIsLogin(login);
    setError(null);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-black flex flex-col items-center justify-center p-4 sm:p-6 relative select-none overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,rgba(120,119,198,0.08),rgba(0,0,0,0))] pointer-events-none" />

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20" ref={langDropdownRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            aria-expanded={showLangDropdown}
            aria-label={t('aria.switchLanguage')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-neutral-300 text-xs font-medium backdrop-blur-md transition-all active:scale-95"
          >
            <Globe size={14} className="text-neutral-400" aria-hidden="true" />
            <span>
              {currentLang.flag} {currentLang.name}
            </span>
          </button>
          {showLangDropdown && (
            <div className="absolute right-0 mt-2 w-36 bg-[#1C1C1E] rounded-xl border border-white/10 shadow-2xl overflow-hidden z-30 py-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLangDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors text-left ${
                    language === lang.code ? 'bg-white/15 text-white font-semibold' : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-[400px] z-10 my-auto py-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl shadow-xl shadow-black/50 border border-white/10 flex items-center justify-center mb-3 bg-[#18181b] overflow-hidden">
            <img
              src="/AppIcon-512@2x.png"
              alt="Libify"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Libify</h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">{t('auth.tagline')}</p>
        </div>

        <div className="bg-[#141416]/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-white/[0.08] shadow-2xl shadow-black/90">
          <div className="grid grid-cols-2 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] mb-5" role="tablist">
            {[true, false].map((loginTab) => (
              <button
                key={String(loginTab)}
                type="button"
                role="tab"
                aria-selected={isLogin === loginTab}
                onClick={() => switchMode(loginTab)}
                className={`py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  isLogin === loginTab ? 'bg-white/[0.1] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {loginTab ? t('auth.login') : t('auth.register')}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="nickname" className="text-xs font-medium text-neutral-400 ml-0.5">
                {t('auth.nickname')}
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" aria-hidden="true" />
                <input
                  id="nickname"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t('auth.nicknamePlaceholder')}
                  className={inputClass}
                />
              </div>
              {!isLogin && <p className="text-[11px] text-neutral-500 ml-0.5">{t('auth.nicknameHint')}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-neutral-400 ml-0.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('aria.hidePassword') : t('aria.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {!isLogin && <p className="text-[11px] text-neutral-500 ml-0.5">{t('auth.passwordHint')}</p>}
            </div>

            {error && (
              <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-white text-black rounded-xl font-semibold text-sm mt-2 hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center shadow-sm"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : isLogin ? t('auth.loginAction') : t('auth.registerAction')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

Если ключей `aria.showPassword` / `aria.hidePassword` нет в локалях — проверить, какие ключи использовал
старый `Auth.tsx` для кнопки показа пароля (`git show HEAD~10:src/pages/Auth.tsx | grep -n aria` либо
`git log --all -- '*Auth.tsx'`), и использовать их; если не было никаких — добавить эти два ключа в обе локали
(`"Show password"`/`"Hide password"`, `"Показати пароль"`/`"Сховати пароль"`).

- [ ] **Step 4: `apps/web/src/components/Sidebar.tsx`** — в блоке пользователя заменить
`{user.email?.[0]?.toUpperCase() || 'U'}` на `{user.nickname[0]?.toUpperCase() ?? 'U'}` и
`{user.email?.split('@')[0] || 'User'}` на `{user.nickname}`.

- [ ] **Step 5: Проверить `App.tsx`.** Маршрут `/auth` должен редиректить залогиненного пользователя на `/`.
Если сейчас там просто `<Auth />`, обернуть: внутри компонента-обёртки `const { user, loading } = useAuth();
if (loading) return <LoadingFallback />; return user ? <Navigate to="/" replace /> : <Auth />;`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/contexts apps/web/src/pages/Auth.tsx apps/web/src/components/Sidebar.tsx apps/web/src/locales apps/web/src/App.tsx
git commit -m "feat(web): nickname/password auth against the new api"
```

---

### Task 11: Каталог, страницы, админка

**Files:** `apps/web/src/services/flibustaApi.ts`, `apps/web/src/pages/{MyBooks,Reader}.tsx`,
`apps/web/src/components/BookCard.tsx`, `apps/web/src/pages/Admin/Admin.tsx`

- [ ] **Step 1: `flibustaApi.ts`.**
  - Удалить функцию `fetchViaProxy` целиком и константы `PROXY_URL`, `FLIBUSTA_BASE`.
  - Импорты: добавить `import { CATALOG_ORIGIN, catalogImageUrl } from '../shared/api/CatalogApi';` и
    `import { services } from '../shared/services';`.
  - В `fetchBooks`: заменить формирование URL и запрос на
    `const xmlText = await services().catalog.searchOpds(query);`
  - Блок обложки (от `if (imageLink) {` до закрывающей скобки) заменить на:

```ts
            if (imageLink) {
                const href = imageLink.getAttribute('href');
                if (href) cover = catalogImageUrl(href);
            }
```

  - `contentUrl: \`${FLIBUSTA_BASE}/b/${id}/fb2\`` → `contentUrl: \`${CATALOG_ORIGIN}/b/${id}/fb2\``.
  - В `fetchBookContent`: `const url = ...; const data = await fetchViaProxy(url, 'arraybuffer') as ArrayBuffer;` →
    `const data = await services().catalog.downloadBook(bookId, 'fb2');`.
  - Сообщения об ошибках на русском оставить (локализация — План 3).

- [ ] **Step 2: `pages/Reader.tsx`.** В вызовах `addQuote({...}, user.id)` и `addBookmark({...}, user.id)` убрать
второй аргумент `, user.id`. Проверку `if (!user || ...)` оставить.

- [ ] **Step 3: `components/BookCard.tsx`.** В `addFavorite({...}, user.id)` убрать `, user.id`.

- [ ] **Step 4: `pages/MyBooks.tsx`.**
  - Импорт из `../utils/storage`: убрать `addToPendingDeletions`. Удалить импорт `removeBookFromCloud` из `../utils/sync`.
  - Добавить `import { useReplicaVersion } from '../shared/sync/useReplicaVersion';`, в начале компонента
    `const replicaVersion = useReplicaVersion();`.
  - В `handleRemove` тело колбэка `confirmDelete` заменить на:

```ts
            removeFromMyBooks(bookId);
            setMyBookIds(getMyBookIds());
```

  - В `useEffect`, который грузит избранное/цитаты/закладки (`getFavorites(), getQuotes(), getBookmarks()`),
    добавить `replicaVersion` в массив зависимостей, чтобы списки обновлялись после синхронизации.
  - Если `myBookIds` обновляется только по событию `storage-update` — оставить; событие теперь шлёт `services.ts`.

- [ ] **Step 5: `pages/Admin/Admin.tsx`.**
  - Удалить `import { supabase } ...` и константу `ADMIN_EMAIL`.
  - Добавить `import { services } from '../../shared/services';`.
  - Тело `async function fetchAdminData()` заменить на:

```ts
        async function fetchAdminData() {
            try {
                const stats = await services().admin.stats();
                setStats((prev) => ({
                    ...prev,
                    totalUsers: stats.totalUsers,
                    activeNow: stats.activeUsers24h,
                    booksReadTotal: stats.totalLibraryBooks,
                }));
                setActiveUsers([]);
                setManagedBooks(
                    stats.topBooks.map((b) => ({ id: b.bookId, title: b.title, author: '', status: 'published' as const, downloads: b.readers })),
                );
            } catch (error) {
                console.error('Admin fetch error:', error);
            }
        }
```

  - Проверку доступа `if (!user || user.email !== ADMIN_EMAIL)` → `if (!user || user.role !== 'admin')`.
  - Полный редизайн админки (реальные графики вместо моков) — План 3.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): catalog via api, pages on replica-backed services, admin on real stats"
```

---

### Task 12: Удаление Supabase/Vercel, Vite-конфиг, проверка

**Files:** удалить `apps/web/src/lib/supabase.ts`, `apps/web/src/utils/sync.ts`, `apps/web/src/utils/mutex.ts`,
`apps/web/src/services/ai.ts`, `api/`, `vercel.json`, `schema.sql`; изменить `apps/web/vite.config.ts`

- [ ] **Step 1: Удалить файлы**

```bash
git rm -q apps/web/src/lib/supabase.ts apps/web/src/utils/sync.ts apps/web/src/utils/mutex.ts apps/web/src/services/ai.ts
git rm -rq api vercel.json schema.sql
grep -rn "supabase\|utils/sync\|utils/mutex\|services/ai\|torAgent\|socks" apps/web/src apps/web/vite.config.ts
```

Expected: grep находит только строки в `vite.config.ts` (чинятся в Step 2).

- [ ] **Step 2: `apps/web/vite.config.ts`.**
  - Удалить импорт `SocksProxyAgent`, константу `torAgent` и комментарии про Tor, строку `// Deployment trigger`.
  - `server.proxy` заменить целиком на:

```ts
  server: {
    proxy: {
      // Same origin in dev, so the session cookie and the Origin check work like in production.
      '/api': { target: 'http://localhost:3000' },
    },
  },
```

  - В `build.rollupOptions.output.manualChunks` удалить строку `supabase: ['@supabase/supabase-js'],`.
  - В `workbox.runtimeCaching` удалить правило `/^.*\/api\/.*/` (NetworkFirst кешировал бы ответы авторизации и
    синхронизации) и **первым** элементом массива добавить:

```ts
          {
            // Catalog covers proxied by our API: immutable enough to serve from cache.
            urlPattern: ({ url }) => url.pathname === '/api/catalog/image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'catalog-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
```

  - `navigateFallbackDenylist: [/^\/api/]` оставить.

- [ ] **Step 3: Typecheck, тесты, сборка**

Run: `npm run typecheck && npm test && npm run build`
Expected: всё зелёное. Ошибки typecheck в страницах исправлять по месту (вероятные: оставшиеся обращения к
`user.email`, `pendingDeletions`, `Quote.user_id`). Не использовать `any`/`@ts-ignore`.

- [ ] **Step 4: Ручная проверка в браузере** (dev):

```bash
npm run dev:api     # терминал 1
npm run dev:web     # терминал 2
```

Открыть `http://localhost:5173` (встроенный браузер или Chrome) и пройти сценарий:
1. Регистрация `smoke_user` / `password123` → попадаем на главную; в DevTools → Application → Cookies есть `libify_sid` (HttpOnly).
2. Поиск книги → открыть её в читалке → прокрутить → вернуться в «Мои книги»: книга есть, прогресс сохранён.
3. Выделить текст → сохранить цитату; добавить закладку; добавить в избранное → всё видно в «Моих книгах».
4. Перезагрузить страницу → всё на месте. `curl -s localhost:3000/api/health` → ok.
5. Выйти → снова войти тем же ником (в другом регистре: `SMOKE_USER`) → после синхронизации данные возвращаются.
6. DevTools → Network → Offline → добавить цитату → Online → через несколько секунд цитата уходит на сервер
   (`POST /api/sync/push` в Network).

Если поиск Flibusta не отвечает (сеть/блокировка) — шаг 2 выполнить через загрузку локального FB2 в «Моих книгах».
Записать в отчёт, какие шаги прошли.

- [ ] **Step 5: Lint фронта** — `npm run lint -w @libify/web`. Новые файлы не должны добавлять ошибок
(старые 5 `set-state-in-effect` чинятся в Плане 3).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove supabase and vercel leftovers, dev proxy to local api"
```

---

## Готово, когда

- `grep -rn supabase apps packages` пусто (кроме `package-lock.json` не должно быть ничего).
- `npm run typecheck && npm test && npm run build` зелёные; lint API зелёный; lint фронта без новых ошибок.
- Ручной сценарий (регистрация → книга → прогресс → цитата/закладка/избранное → перезагрузка → выход/вход →
  офлайн-изменение) проходит на dev-серверах.
- После этого: `/code-review` по изменениям Плана 2 и короткий отчёт пользователю.
