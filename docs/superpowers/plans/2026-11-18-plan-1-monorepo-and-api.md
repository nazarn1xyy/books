# План 1: монорепо и бэкенд API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести репозиторий на npm workspaces и построить полностью протестированный Hono API на Postgres
(авторизация по нику, синхронизация, каталог Flibusta, AI, админ-статистика), готовый к упаковке в Docker.

**Architecture:** `apps/web` (текущий фронт, перенесён без изменений), `apps/api` (Hono, слои
Controller → Service → Repository, DI через конструкторы в `container.ts`), `packages/shared` (zod-схемы и типы,
общие для web и api). Postgres 17 через Drizzle ORM + postgres.js. Тесты на Vitest на реальном Postgres в Docker.

**Tech Stack:** Node ≥22.12 (prod: 24), TypeScript ~5.9, Hono 4, @hono/node-server 2, Drizzle ORM 0.45 /
drizzle-kit 0.31, postgres 3.4, zod 4, @node-rs/argon2 2, pino 10, lru-cache 11, Vitest 5, esbuild, tsx.

**Спека:** `docs/superpowers/specs/2026-11-18-libify-v2-design.md`

**Последующие планы** (пишутся после завершения этого): План 2 — фронт на новом API (ApiClient, SyncEngine,
удаление Supabase); План 3 — рефакторинг по фичам, производительность, дизайн; План 4 — деплой на сервер.

**Предусловие:** Docker Desktop запущен (`docker info` отвечает без ошибки).

---

## Карта файлов

```
package.json                     root: workspaces, общие скрипты
tsconfig.base.json               общие строгие опции TS
docker-compose.dev.yml           Postgres для разработки и тестов (порт 5433)
deploy/dev/init-test-db.sql      создаёт БД libify_test
.github/workflows/ci.yml         lint + typecheck + test + build
apps/web/**                      текущий фронт (git mv из корня)
packages/shared/
  package.json, tsconfig.json
  src/index.ts                   реэкспорт
  src/errors.ts                  коды ошибок, ApiErrorBody
  src/auth.ts                    схемы ника/пароля, PublicUser
  src/sync.ts                    сущности синхронизации, push/pull DTO, syncKeyOf
  src/catalog.ts                 схемы каталога и AI
  src/admin.ts                   AdminStats
  src/sync.test.ts
apps/api/
  package.json, tsconfig.json, vitest.config.ts, drizzle.config.ts, eslint.config.js, Dockerfile, .env.example
  drizzle/                       сгенерированные SQL-миграции
  src/core/clock.ts              Clock, systemClock
  src/core/config.ts             loadConfig (zod)
  src/core/errors.ts             иерархия AppError
  src/core/logger.ts             pino
  src/core/db.ts                 createDatabase, Database, DbExecutor
  src/core/http.ts               AppEnv, Controller, readJson, clientIp
  src/core/rate-limiter.ts       FixedWindowRateLimiter
  src/core/middleware.ts         requestLogger, errorHandler, originCheck, rateLimit, requireAuth, requireAdmin
  src/db/schema.ts               таблицы Drizzle
  src/modules/health/            health.service.ts, health.controller.ts
  src/modules/auth/              password-hasher.ts, user.repository.ts, session.repository.ts,
                                 auth.service.ts, session-cookie.ts, session.middleware.ts, auth.controller.ts
  src/modules/sync/              base-sync.repository.ts, entity.repositories.ts, sync.service.ts, sync.controller.ts
  src/modules/catalog/           catalog.client.ts, catalog.service.ts, catalog.controller.ts
  src/modules/ai/                ai.service.ts, ai.controller.ts
  src/modules/admin/             admin.repository.ts, admin.service.ts, admin.controller.ts
  src/container.ts               сборка графа объектов
  src/app.ts                     createApp (без listen)
  src/server.ts                  listen + graceful shutdown
  src/cli/migrate.ts             применение миграций
  src/cli/make-admin.ts          назначение админа
  test/global-setup.ts           пересоздание схемы + миграции
  test/helpers.ts                createTestContext, TestClient, FakeClock
  test/*.test.ts
```

---

### Task 1: Монорепо и перенос фронта в `apps/web`

**Files:**
- Move: `src/ public/ index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js` → `apps/web/`
- Create: `apps/web/package.json`, `package.json` (перезапись), `tsconfig.base.json`
- Delete: `README.md` (шаблонный, новый в Task 14), `package-lock.json` (пересоздаётся), `.DS_Store`, `src/.DS_Store`

- [ ] **Step 1: Переместить файлы фронта**

```bash
mkdir -p apps/web packages apps/api
git mv src public index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js apps/web/
git rm -q --cached .DS_Store 2>/dev/null; rm -f .DS_Store apps/web/src/.DS_Store
git rm -q package-lock.json
```

- [ ] **Step 2: Создать `apps/web/package.json`** (зависимости текущего фронта без изменений)

```json
{
  "name": "@libify/web",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.91.0",
    "framer-motion": "^12.27.2",
    "jszip": "^3.10.1",
    "lucide-react": "^0.562.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-pdf": "^10.3.0",
    "react-router-dom": "^7.12.0",
    "react-virtuoso": "^4.18.1",
    "recharts": "^3.6.0",
    "vite-plugin-pwa": "^1.2.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@tailwindcss/vite": "^4.1.18",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "socks-proxy-agent": "^8.0.5",
    "tailwindcss": "^4.1.18",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.46.4",
    "vite": "^7.2.4",
    "vite-plugin-compression2": "^2.4.0"
  }
}
```

- [ ] **Step 3: Создать корневой `package.json`**

```json
{
  "name": "libify",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=22.12" },
  "scripts": {
    "dev:web": "npm run dev -w @libify/web",
    "dev:api": "npm run dev -w @libify/api",
    "db:up": "docker compose -f docker-compose.dev.yml up -d --wait",
    "db:down": "docker compose -f docker-compose.dev.yml down",
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [ ] **Step 4: Создать `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

- [ ] **Step 5: Установить зависимости и собрать фронт**

Run: `npm install && npm run build -w @libify/web`
Expected: `✓ built in …`, каталог `apps/web/dist` создан. Если `tsc -b` падает на ошибках, которые были и до переноса, — проверить `git stash && npm run build` на `main`; переносом ошибки не создаются, фиксить не в этой задаче.

- [ ] **Step 6: Обновить `.gitignore`** — добавить в конец:

```
# monorepo
node_modules/
**/dist/
.env
.env.*
!.env.example
.DS_Store
coverage/
test-results/
playwright-report/
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: convert to npm workspaces, move frontend to apps/web"
```

---

### Task 2: Dev Postgres и пакет `@libify/shared`

**Files:**
- Create: `docker-compose.dev.yml`, `deploy/dev/init-test-db.sql`
- Create: `packages/shared/{package.json,tsconfig.json}`, `packages/shared/src/{index,errors,auth,sync,catalog,admin}.ts`
- Test: `packages/shared/src/sync.test.ts`

- [ ] **Step 1: `docker-compose.dev.yml`**

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: libify
      POSTGRES_PASSWORD: libify
      POSTGRES_DB: libify
    ports:
      - "5433:5432"
    volumes:
      - libify-dev-pgdata:/var/lib/postgresql/data
      - ./deploy/dev/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U libify -d libify"]
      interval: 2s
      timeout: 3s
      retries: 20
volumes:
  libify-dev-pgdata:
```

- [ ] **Step 2: `deploy/dev/init-test-db.sql`**

```sql
CREATE DATABASE libify_test OWNER libify;
```

- [ ] **Step 3: Поднять БД**

Run: `npm run db:up && docker compose -f docker-compose.dev.yml exec db psql -U libify -lqt | cut -d'|' -f1 | grep libify`
Expected: строки `libify` и `libify_test`.

- [ ] **Step 4: `packages/shared/package.json`**

```json
{
  "name": "@libify/shared",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^4.6.7" },
  "devDependencies": { "typescript": "~5.9.3", "vitest": "^5.1.1" }
}
```

- [ ] **Step 5: `packages/shared/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 6: `packages/shared/src/errors.ts`**

```ts
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'NICKNAME_TAKEN',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'AI_DISABLED',
  'UPSTREAM_FAILED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string };
}
```

- [ ] **Step 7: `packages/shared/src/auth.ts`**

```ts
import { z } from 'zod';

export const NICKNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;

export const nicknameSchema = z.string().trim().regex(NICKNAME_PATTERN, 'Nickname: 3-24 chars, letters, digits, _');
export const passwordSchema = z.string().min(8, 'Password: at least 8 chars').max(128);

/** Registration: strict rules. */
export const credentialsSchema = z.object({ nickname: nicknameSchema, password: passwordSchema });
/** Login: loose rules so wrong input yields INVALID_CREDENTIALS, not a validation hint. */
export const loginSchema = z.object({
  nickname: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface PublicUser {
  id: string;
  nickname: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
}
```

- [ ] **Step 8: Написать падающий тест `packages/shared/src/sync.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { syncKeyOf, syncPushRequestSchema } from './sync';

const book = {
  bookId: '123',
  title: 'Book',
  author: null,
  coverUrl: null,
  status: 'reading',
  format: 'fb2',
  addedAt: '2026-11-18T10:00:00.000Z',
} as const;

describe('syncKeyOf', () => {
  it('uses bookId for book-keyed entities', () => {
    expect(syncKeyOf('book', book)).toBe('123');
  });
  it('uses id for quotes', () => {
    const id = '0b0d7f5e-8a51-4a6a-9a8a-5f1d6c1d2e3f';
    expect(
      syncKeyOf('quote', { id, bookId: '1', bookTitle: null, bookAuthor: null, text: 't', note: null, color: 'yellow' }),
    ).toBe(id);
  });
});

describe('syncPushRequestSchema', () => {
  it('accepts upsert and delete ops', () => {
    const parsed = syncPushRequestSchema.parse({
      ops: [
        { entity: 'book', key: '123', clientUpdatedAt: '2026-11-18T10:00:00.000Z', data: book },
        { entity: 'favorite', key: '9', clientUpdatedAt: '2026-11-18T10:00:00.000Z', data: null },
      ],
    });
    expect(parsed.ops).toHaveLength(2);
  });
  it('rejects unknown entity', () => {
    expect(() =>
      syncPushRequestSchema.parse({ ops: [{ entity: 'x', key: '1', clientUpdatedAt: '2026-11-18T10:00:00.000Z', data: null }] }),
    ).toThrow();
  });
  it('rejects more than 200 ops', () => {
    const op = { entity: 'favorite', key: '9', clientUpdatedAt: '2026-11-18T10:00:00.000Z', data: null };
    expect(() => syncPushRequestSchema.parse({ ops: Array.from({ length: 201 }, () => op) })).toThrow();
  });
});
```

- [ ] **Step 9: Запустить, убедиться что падает**

Run: `npm install && npm test -w @libify/shared`
Expected: FAIL — `Cannot find module './sync'` / `Failed to resolve import "./sync"`.

- [ ] **Step 10: `packages/shared/src/sync.ts`**

```ts
import { z } from 'zod';

export const SYNC_ENTITIES = ['book', 'progress', 'quote', 'bookmark', 'favorite'] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export const BOOK_STATUSES = ['reading', 'plan', 'finished', 'dropped'] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

const bookId = z.string().min(1).max(64);
const nullableText = (max: number) => z.string().max(max).nullable();

export const bookDataSchema = z.object({
  bookId,
  title: z.string().min(1).max(500),
  author: nullableText(300),
  coverUrl: nullableText(2048),
  status: z.enum(BOOK_STATUSES),
  format: z.string().min(1).max(16),
  addedAt: z.iso.datetime(),
});

export const progressDataSchema = z.object({
  bookId,
  paragraphIndex: z.number().int().min(0),
  scrollRatio: z.number().min(0).max(1),
  currentPage: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export const quoteDataSchema = z.object({
  id: z.uuid(),
  bookId,
  bookTitle: nullableText(500),
  bookAuthor: nullableText(300),
  text: z.string().min(1).max(10_000),
  note: nullableText(5_000),
  color: z.string().min(1).max(16),
});

export const bookmarkDataSchema = z.object({
  id: z.uuid(),
  bookId,
  paragraphIndex: z.number().int().min(0),
  previewText: nullableText(500),
});

export const favoriteDataSchema = z.object({
  bookId,
  title: z.string().min(1).max(500),
  author: nullableText(300),
  coverUrl: nullableText(2048),
});

export type BookData = z.infer<typeof bookDataSchema>;
export type ProgressData = z.infer<typeof progressDataSchema>;
export type QuoteData = z.infer<typeof quoteDataSchema>;
export type BookmarkData = z.infer<typeof bookmarkDataSchema>;
export type FavoriteData = z.infer<typeof favoriteDataSchema>;

export interface SyncDataMap {
  book: BookData;
  progress: ProgressData;
  quote: QuoteData;
  bookmark: BookmarkData;
  favorite: FavoriteData;
}

const opFor = <E extends SyncEntity, S extends z.ZodType>(entity: E, data: S) =>
  z.object({
    entity: z.literal(entity),
    key: z.string().min(1).max(64),
    clientUpdatedAt: z.iso.datetime(),
    /** null = delete (tombstone) */
    data: data.nullable(),
  });

export const syncOpSchema = z.discriminatedUnion('entity', [
  opFor('book', bookDataSchema),
  opFor('progress', progressDataSchema),
  opFor('quote', quoteDataSchema),
  opFor('bookmark', bookmarkDataSchema),
  opFor('favorite', favoriteDataSchema),
]);
export type SyncOp = z.infer<typeof syncOpSchema>;

export const SYNC_PUSH_MAX_OPS = 200;
export const syncPushRequestSchema = z.object({ ops: z.array(syncOpSchema).min(1).max(SYNC_PUSH_MAX_OPS) });
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export interface SyncRejection {
  entity: SyncEntity;
  key: string;
  reason: 'STALE' | 'KEY_MISMATCH';
}

export interface SyncPushResponse {
  applied: number;
  rejected: SyncRejection[];
  serverTime: string;
}

export const syncPullQuerySchema = z.object({ since: z.iso.datetime().optional() });

export type SyncChange = {
  [E in SyncEntity]: { entity: E; key: string; updatedAt: string; data: SyncDataMap[E] | null };
}[SyncEntity];

export interface SyncPullResponse {
  serverTime: string;
  changes: SyncChange[];
}

/** Natural key of a record: bookId for per-book entities, id for quotes/bookmarks. */
export function syncKeyOf<E extends SyncEntity>(entity: E, data: SyncDataMap[E]): string {
  if (entity === 'quote' || entity === 'bookmark') return (data as QuoteData | BookmarkData).id;
  return (data as BookData | ProgressData | FavoriteData).bookId;
}
```

- [ ] **Step 11: `packages/shared/src/catalog.ts`**

```ts
import { z } from 'zod';

export const BOOK_FORMATS = ['fb2', 'epub', 'mobi'] as const;
export type BookFormat = (typeof BOOK_FORMATS)[number];

export const catalogSearchQuerySchema = z.object({ q: z.string().trim().min(1).max(200) });
export const catalogBookParamsSchema = z.object({
  id: z.string().regex(/^\d{1,10}$/),
  format: z.enum(BOOK_FORMATS),
});
export const catalogImageQuerySchema = z.object({ src: z.string().min(1).max(2048) });

export const aiSummarizeRequestSchema = z.object({ text: z.string().trim().min(1).max(20_000) });
export interface AiSummarizeResponse {
  summary: string;
}
export interface AiStatusResponse {
  enabled: boolean;
}
```

- [ ] **Step 12: `packages/shared/src/admin.ts`**

```ts
export interface AdminStats {
  totalUsers: number;
  activeUsers24h: number;
  activeUsers7d: number;
  totalLibraryBooks: number;
  topBooks: Array<{ bookId: string; title: string; readers: number }>;
  registrationsByDay: Array<{ day: string; count: number }>;
}
```

- [ ] **Step 13: `packages/shared/src/index.ts`**

```ts
export * from './errors';
export * from './auth';
export * from './sync';
export * from './catalog';
export * from './admin';
```

- [ ] **Step 14: Запустить тесты и typecheck**

Run: `npm test -w @libify/shared && npm run typecheck -w @libify/shared`
Expected: `Test Files 1 passed`, `Tests 5 passed`; typecheck без вывода.

- [ ] **Step 15: Commit**

```bash
git add docker-compose.dev.yml deploy/dev packages/shared package-lock.json
git commit -m "feat(shared): add dev postgres and shared zod contracts"
```

---

### Task 3: Каркас API — config, errors, clock, logger

**Files:**
- Create: `apps/api/{package.json,tsconfig.json,vitest.config.ts,eslint.config.js,.env.example}`
- Create: `apps/api/src/core/{clock,config,errors,logger}.ts`
- Test: `apps/api/test/config.test.ts`

- [ ] **Step 1: `apps/api/package.json`**

```json
{
  "name": "@libify/api",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=.env src/server.ts",
    "build": "node build.mjs",
    "start": "node dist/server.js",
    "typecheck": "tsc -p tsconfig.json",
    "lint": "eslint .",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx --env-file=.env src/cli/migrate.ts",
    "make-admin": "tsx --env-file=.env src/cli/make-admin.ts"
  },
  "dependencies": {
    "@hono/node-server": "^2.1.9",
    "@libify/shared": "*",
    "@node-rs/argon2": "^2.2.2",
    "drizzle-orm": "^0.45.4",
    "hono": "^4.13.19",
    "lru-cache": "^11.5.3",
    "pino": "^10.4.0",
    "postgres": "^3.4.9",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/node": "^24.10.1",
    "drizzle-kit": "^0.31.11",
    "esbuild": "^0.28.2",
    "eslint": "^9.39.1",
    "globals": "^16.5.0",
    "pino-pretty": "^13.2.0",
    "tsx": "^4.23.15",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.46.4",
    "vitest": "^5.1.1"
  }
}
```

- [ ] **Step 2: `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test", "drizzle.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: `apps/api/eslint.config.js`**

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'drizzle']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
]);
```

- [ ] **Step 4: `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
```

- [ ] **Step 5: `apps/api/.env.example`**

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://libify:libify@localhost:5433/libify
APP_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
# COOKIE_SECURE=false   # по умолчанию true в production, false иначе
CATALOG_HOSTS=flibusta.is,static.flibusta.is
# AI (OpenAI-совместимый провайдер). Без всех трёх переменных AI выключен.
# AI_BASE_URL=https://api.example.com/v1
# AI_API_KEY=
# AI_MODEL=
```

Затем: `cp apps/api/.env.example apps/api/.env`.

- [ ] **Step 6: Написать падающий тест `apps/api/test/config.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/core/config';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5433/db', APP_ORIGIN: 'http://localhost:5173' };

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig(base);
    expect(c.PORT).toBe(3000);
    expect(c.NODE_ENV).toBe('development');
    expect(c.cookieSecure).toBe(false);
    expect(c.catalogHosts).toEqual(['flibusta.is', 'static.flibusta.is']);
    expect(c.ai).toBeNull();
  });
  it('secure cookies by default in production', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).cookieSecure).toBe(true);
  });
  it('enables AI only when all AI vars are set', () => {
    const c = loadConfig({ ...base, AI_BASE_URL: 'https://ai.test/v1', AI_API_KEY: 'k', AI_MODEL: 'm' });
    expect(c.ai).toEqual({ baseUrl: 'https://ai.test/v1', apiKey: 'k', model: 'm' });
  });
  it('throws a readable error on invalid env', () => {
    expect(() => loadConfig({ APP_ORIGIN: 'nope' })).toThrow(/Invalid environment/);
  });
});
```

- [ ] **Step 7: Временный `apps/api/test/global-setup.ts`** (заменяется в Task 4)

```ts
export default async function setup(): Promise<void> {}
```

- [ ] **Step 8: Запустить, убедиться что падает**

Run: `npm install && npm test -w @libify/api`
Expected: FAIL — `Failed to resolve import "../src/core/config"`.

- [ ] **Step 9: `apps/api/src/core/clock.ts`**

```ts
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
```

- [ ] **Step 10: `apps/api/src/core/config.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  APP_ORIGIN: z.url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  COOKIE_SECURE: z.stringbool().optional(),
  CATALOG_HOSTS: z.string().default('flibusta.is,static.flibusta.is'),
  AI_BASE_URL: z.url().optional(),
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
});

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type Config = z.infer<typeof envSchema> & {
  cookieSecure: boolean;
  catalogHosts: string[];
  ai: AiConfig | null;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  return {
    ...e,
    cookieSecure: e.COOKIE_SECURE ?? e.NODE_ENV === 'production',
    catalogHosts: e.CATALOG_HOSTS.split(',').map((h) => h.trim()).filter(Boolean),
    ai: e.AI_BASE_URL && e.AI_API_KEY && e.AI_MODEL ? { baseUrl: e.AI_BASE_URL, apiKey: e.AI_API_KEY, model: e.AI_MODEL } : null,
  };
}
```

- [ ] **Step 11: `apps/api/src/core/errors.ts`**

```ts
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiErrorBody, ErrorCode } from '@libify/shared';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
    readonly headers: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request') {
    super('VALIDATION_FAILED', 400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('INVALID_CREDENTIALS', 401, 'Wrong nickname or password');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', 404, message);
  }
}

export class NicknameTakenError extends AppError {
  constructor() {
    super('NICKNAME_TAKEN', 409, 'This nickname is already taken');
  }
}

export class PayloadTooLargeError extends AppError {
  constructor() {
    super('PAYLOAD_TOO_LARGE', 413, 'Request body is too large');
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSec: number) {
    super('RATE_LIMITED', 429, 'Too many requests', { 'Retry-After': String(retryAfterSec) });
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'Upstream service failed') {
    super('UPSTREAM_FAILED', 502, message);
  }
}

export class AiDisabledError extends AppError {
  constructor() {
    super('AI_DISABLED', 503, 'AI is not configured');
  }
}
```

- [ ] **Step 12: `apps/api/src/core/logger.ts`**

```ts
import { pino, type Logger } from 'pino';
import type { Config } from './config';

export type { Logger };

export function createLogger(config: Pick<Config, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  return pino({
    level: config.LOG_LEVEL,
    ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
  });
}
```

- [ ] **Step 13: Запустить тесты и typecheck**

Run: `npm test -w @libify/api && npm run typecheck -w @libify/api`
Expected: `Tests 4 passed`; typecheck без ошибок.

- [ ] **Step 14: Commit**

```bash
git add apps/api package-lock.json
git commit -m "feat(api): scaffold api with config, errors, clock, logger"
```

---

### Task 4: Схема БД, миграции, тестовая инфраструктура

**Files:**
- Create: `apps/api/src/db/schema.ts`, `apps/api/src/core/db.ts`, `apps/api/drizzle.config.ts`, `apps/api/src/cli/migrate.ts`
- Generated: `apps/api/drizzle/0000_*.sql`, `apps/api/drizzle/meta/*`
- Modify: `apps/api/test/global-setup.ts`
- Create: `apps/api/test/helpers.ts` (базовая часть)
- Test: `apps/api/test/db.test.ts`

- [ ] **Step 1: `apps/api/src/db/schema.ts`**

```ts
import { sql } from 'drizzle-orm';
import { index, integer, pgEnum, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { BOOK_STATUSES, USER_ROLES } from '@libify/shared';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const userRole = pgEnum('user_role', USER_ROLES);
export const bookStatus = pgEnum('book_status', BOOK_STATUSES);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nickname: text('nickname').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('user'),
    createdAt: ts('created_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_nickname_lower_uq').on(sql`lower(${t.nickname})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/**
 * Columns shared by every synced table.
 * updated_at — client timestamp for last-write-wins.
 * synced_at  — server write time, used as the pull cursor (client clocks can lag).
 */
const syncColumns = () => ({
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  updatedAt: ts('updated_at').notNull(),
  syncedAt: ts('synced_at').notNull().defaultNow(),
  deletedAt: ts('deleted_at'),
});

export const userBooks = pgTable(
  'user_books',
  {
    ...syncColumns(),
    bookId: text('book_id').notNull(),
    title: text('title').notNull(),
    author: text('author'),
    coverUrl: text('cover_url'),
    status: bookStatus('status').notNull().default('reading'),
    format: text('format').notNull().default('fb2'),
    addedAt: ts('added_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] }), index('user_books_sync_idx').on(t.userId, t.syncedAt)],
);

export const readingProgress = pgTable(
  'reading_progress',
  {
    ...syncColumns(),
    bookId: text('book_id').notNull(),
    paragraphIndex: integer('paragraph_index').notNull().default(0),
    scrollRatio: real('scroll_ratio').notNull().default(0),
    currentPage: integer('current_page').notNull().default(0),
    totalPages: integer('total_pages').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] }), index('reading_progress_sync_idx').on(t.userId, t.syncedAt)],
);

export const quotes = pgTable(
  'quotes',
  {
    ...syncColumns(),
    id: uuid('id').primaryKey(),
    bookId: text('book_id').notNull(),
    bookTitle: text('book_title'),
    bookAuthor: text('book_author'),
    text: text('text').notNull(),
    note: text('note'),
    color: text('color').notNull().default('yellow'),
  },
  (t) => [index('quotes_sync_idx').on(t.userId, t.syncedAt)],
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    ...syncColumns(),
    id: uuid('id').primaryKey(),
    bookId: text('book_id').notNull(),
    paragraphIndex: integer('paragraph_index').notNull(),
    previewText: text('preview_text'),
  },
  (t) => [index('bookmarks_sync_idx').on(t.userId, t.syncedAt)],
);

export const favorites = pgTable(
  'favorites',
  {
    ...syncColumns(),
    bookId: text('book_id').notNull(),
    title: text('title').notNull(),
    author: text('author'),
    coverUrl: text('cover_url'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] }), index('favorites_sync_idx').on(t.userId, t.syncedAt)],
);
```

- [ ] **Step 2: `apps/api/src/core/db.ts`**

```ts
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';

export type Database = PostgresJsDatabase<typeof schema>;
/** Either the root database or a transaction handle. */
export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DatabaseHandle {
  db: Database;
  close(): Promise<void>;
}

export function createDatabase(url: string, maxConnections: number): DatabaseHandle {
  const client = postgres(url, { max: maxConnections, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
```

- [ ] **Step 3: `apps/api/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://libify:libify@localhost:5433/libify' },
});
```

- [ ] **Step 4: Сгенерировать миграцию**

Run: `npm run db:generate -w @libify/api`
Expected: `[✓] Your SQL migration file ➜ drizzle/0000_<name>.sql 🚀`, 7 таблиц. Открыть SQL и убедиться, что есть
`CREATE UNIQUE INDEX "users_nickname_lower_uq" ON "users" USING btree (lower("nickname"))`.

- [ ] **Step 5: `apps/api/src/cli/migrate.ts`**

```ts
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from '../core/db';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle');
const { db, close } = createDatabase(url, 1);
try {
  await migrate(db, { migrationsFolder });
  console.log(`Migrations applied from ${migrationsFolder}`);
} finally {
  await close();
}
```

- [ ] **Step 6: Применить к dev-БД**

Run: `npm run db:migrate -w @libify/api`
Expected: `Migrations applied from …/apps/api/drizzle`.

- [ ] **Step 7: `apps/api/test/global-setup.ts`** (полная замена)

```ts
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from '../src/core/db';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://libify:libify@localhost:5433/libify_test';

export default async function setup(): Promise<void> {
  process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;
  const { db, close } = createDatabase(TEST_DATABASE_URL, 1);
  try {
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`create schema public`);
    await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, '../drizzle') });
  } finally {
    await close();
  }
}
```

- [ ] **Step 8: `apps/api/test/helpers.ts`** (базовая часть; расширяется в Task 6)

```ts
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
```

- [ ] **Step 9: Тест `apps/api/test/db.test.ts`**

```ts
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
```

Примечание: в Drizzle 0.45 ошибка драйвера оборачивается в `DrizzleQueryError` с исходной в `cause`. Если тест
падает на `cause` — посмотреть фактическую форму ошибки (`console.log(err)`) и проверить `code === '23505'` там,
где он лежит; ту же форму использовать в `UserRepository.create` (Task 7).

- [ ] **Step 10: Запустить тесты**

Run: `npm test -w @libify/api`
Expected: `Test Files 2 passed`, `Tests 6 passed`.

- [ ] **Step 11: Commit**

```bash
git add apps/api
git commit -m "feat(api): add database schema, migrations and test db setup"
```

---

### Task 5: Rate limiter (TDD)

**Files:**
- Create: `apps/api/src/core/rate-limiter.ts`
- Test: `apps/api/test/rate-limiter.test.ts`

- [ ] **Step 1: Падающий тест**

```ts
import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter } from '../src/core/rate-limiter';
import { FakeClock } from './helpers';

describe('FixedWindowRateLimiter', () => {
  it('allows up to the limit, then blocks with retry-after', () => {
    const clock = new FakeClock();
    const limiter = new FixedWindowRateLimiter(2, 60_000, clock);
    expect(limiter.consume('k').allowed).toBe(true);
    expect(limiter.consume('k').allowed).toBe(true);
    const third = limiter.consume('k');
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBe(60);
  });
  it('resets after the window', () => {
    const clock = new FakeClock();
    const limiter = new FixedWindowRateLimiter(1, 1_000, clock);
    limiter.consume('k');
    expect(limiter.consume('k').allowed).toBe(false);
    clock.advance(1_000);
    expect(limiter.consume('k').allowed).toBe(true);
  });
  it('tracks keys independently', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000, new FakeClock());
    limiter.consume('a');
    expect(limiter.consume('b').allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить — FAIL** (`npm test -w @libify/api -- rate-limiter`, ошибка резолва модуля)

- [ ] **Step 3: Реализация `apps/api/src/core/rate-limiter.ts`**

```ts
import { systemClock, type Clock } from './clock';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/** In-memory fixed-window limiter. Single API instance, so memory is enough. */
export class FixedWindowRateLimiter {
  private static readonly SWEEP_THRESHOLD = 10_000;
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: Clock = systemClock,
  ) {}

  consume(key: string): RateLimitResult {
    const now = this.clock.now().getTime();
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      this.sweep(now);
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    current.count += 1;
    if (current.count > this.limit) {
      return { allowed: false, retryAfterSec: Math.ceil((current.resetAt - now) / 1000) };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  private sweep(now: number): void {
    if (this.windows.size < FixedWindowRateLimiter.SWEEP_THRESHOLD) return;
    for (const [key, w] of this.windows) if (w.resetAt <= now) this.windows.delete(key);
  }
}
```

- [ ] **Step 4: Запустить — PASS** (`Tests 3 passed` в rate-limiter.test.ts)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/core/rate-limiter.ts apps/api/test/rate-limiter.test.ts
git commit -m "feat(api): add fixed-window rate limiter"
```

---

### Task 6: HTTP-ядро, health, контейнер, тестовый клиент

**Files:**
- Create: `apps/api/src/core/http.ts`, `apps/api/src/core/middleware.ts`
- Create: `apps/api/src/modules/health/{health.service,health.controller}.ts`
- Create: `apps/api/src/container.ts`, `apps/api/src/app.ts`
- Modify: `apps/api/test/helpers.ts` (добавить createTestContext, TestClient)
- Test: `apps/api/test/http.test.ts`

- [ ] **Step 1: `apps/api/src/core/http.ts`**

```ts
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, Hono } from 'hono';
import type { RequestIdVariables } from 'hono/request-id';
import { z } from 'zod';
import type { PublicUser } from '@libify/shared';
import { ValidationError } from './errors';

export type SessionUser = PublicUser & { sessionId: string };

export interface AppEnv {
  Variables: RequestIdVariables & { user: SessionUser | null };
}

/** A feature module's HTTP entry point. */
export interface Controller {
  readonly basePath: string;
  /** Whether the session middleware must run before this controller. */
  readonly usesSession: boolean;
  routes(): Hono<AppEnv>;
}

export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ValidationError('Body must be valid JSON');
  }
  return parseWith(schema, raw);
}

export function parseWith<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new ValidationError(z.prettifyError(result.error));
  return result.data;
}

/** Caddy is the only client of the API and overwrites X-Forwarded-For, so it is trusted. */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function currentUser(c: Context<AppEnv>): SessionUser {
  const user = c.get('user');
  if (!user) throw new Error('currentUser() used on a route without requireAuth');
  return user;
}
```

- [ ] **Step 2: `apps/api/src/core/middleware.ts`**

```ts
import type { ErrorHandler, MiddlewareHandler } from 'hono';
import type { AppEnv } from './http';
import { clientIp } from './http';
import { AppError, ForbiddenError, RateLimitError, UnauthorizedError } from './errors';
import type { Logger } from './logger';
import type { FixedWindowRateLimiter } from './rate-limiter';

export function requestLogger(logger: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = performance.now();
    await next();
    logger.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
      },
      'request',
    );
  };
}

export function errorHandler(logger: Logger): ErrorHandler<AppEnv> {
  return (err, c) => {
    if (err instanceof AppError) {
      for (const [name, value] of Object.entries(err.headers)) c.header(name, value);
      return c.json(err.toBody(), err.status);
    }
    logger.error({ err, requestId: c.get('requestId') }, 'unhandled error');
    return c.json({ error: { code: 'INTERNAL', message: 'Internal server error' } }, 500);
  };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** CSRF defence for cookie auth: state-changing requests must come from our own origin. */
export function originCheck(allowedOrigin: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method) && c.req.header('origin') !== allowedOrigin) {
      throw new ForbiddenError('Cross-origin request blocked');
    }
    await next();
  };
}

export function rateLimit(
  limiter: FixedWindowRateLimiter,
  keyOf: (c: Parameters<MiddlewareHandler<AppEnv>>[0]) => string,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const result = limiter.consume(keyOf(c));
    if (!result.allowed) throw new RateLimitError(result.retryAfterSec);
    await next();
  };
}

export const userOrIpKey = (prefix: string) => (c: Parameters<MiddlewareHandler<AppEnv>>[0]) =>
  `${prefix}:${c.get('user')?.id ?? `ip:${clientIp(c)}`}`;

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) throw new UnauthorizedError();
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  if (user.role !== 'admin') throw new ForbiddenError('Admins only');
  await next();
};
```

- [ ] **Step 3: `apps/api/src/modules/health/health.service.ts`**

```ts
import { sql } from 'drizzle-orm';
import type { Database } from '../../core/db';

export class HealthService {
  private static readonly DB_TIMEOUT_MS = 1_000;

  constructor(private readonly db: Database) {}

  async isDatabaseUp(): Promise<boolean> {
    try {
      await Promise.race([
        this.db.execute(sql`select 1`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout')), HealthService.DB_TIMEOUT_MS)),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: `apps/api/src/modules/health/health.controller.ts`**

```ts
import { Hono } from 'hono';
import type { AppEnv, Controller } from '../../core/http';
import type { HealthService } from './health.service';

export class HealthController implements Controller {
  readonly basePath = '/health';
  readonly usesSession = false;

  constructor(private readonly health: HealthService) {}

  routes(): Hono<AppEnv> {
    return new Hono<AppEnv>().get('/', async (c) => {
      const dbUp = await this.health.isDatabaseUp();
      return dbUp ? c.json({ status: 'ok', db: 'ok' }) : c.json({ status: 'degraded', db: 'down' }, 503);
    });
  }
}
```

- [ ] **Step 5: `apps/api/src/container.ts`** (начальная версия; расширяется в Tasks 7–11)

```ts
import { systemClock, type Clock } from './core/clock';
import type { Config } from './core/config';
import type { Database } from './core/db';
import type { Controller } from './core/http';
import type { Logger } from './core/logger';
import { FixedWindowRateLimiter } from './core/rate-limiter';
import { HealthController } from './modules/health/health.controller';
import { HealthService } from './modules/health/health.service';

export interface ContainerDeps {
  db: Database;
  logger: Logger;
  clock?: Clock;
  fetch?: typeof fetch;
}

export interface Container {
  config: Config;
  logger: Logger;
  apiLimiter: FixedWindowRateLimiter;
  controllers: Controller[];
}

export function createContainer(config: Config, deps: ContainerDeps): Container {
  const clock = deps.clock ?? systemClock;
  const apiLimiter = new FixedWindowRateLimiter(120, 60_000, clock);

  const controllers: Controller[] = [new HealthController(new HealthService(deps.db))];

  return { config, logger: deps.logger, apiLimiter, controllers };
}
```

- [ ] **Step 6: `apps/api/src/app.ts`**

```ts
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import type { Container } from './container';
import { PayloadTooLargeError } from './core/errors';
import type { AppEnv } from './core/http';
import { errorHandler, originCheck, rateLimit, requestLogger, userOrIpKey } from './core/middleware';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export function createApp(container: Container): Hono<AppEnv> {
  const app = new Hono<AppEnv>().basePath('/api');

  app.use(requestId());
  app.use(async (c, next) => {
    c.set('user', null);
    await next();
  });
  app.use(requestLogger(container.logger));
  app.use(
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: () => {
        throw new PayloadTooLargeError();
      },
    }),
  );
  app.use(originCheck(container.config.APP_ORIGIN));

  for (const controller of container.controllers) {
    if (controller.usesSession && container.sessionMiddleware) {
      app.use(`${controller.basePath}/*`, container.sessionMiddleware);
    }
  }
  app.use(rateLimit(container.apiLimiter, userOrIpKey('api')));

  for (const controller of container.controllers) {
    app.route(controller.basePath, controller.routes());
  }

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404));
  app.onError(errorHandler(container.logger));
  return app;
}
```

И добавить в `Container` (container.ts) поле — сессия появится в Task 7:

```ts
// в interface Container:
  sessionMiddleware: MiddlewareHandler<AppEnv> | null;
// в import:
import type { MiddlewareHandler } from 'hono';
import type { AppEnv, Controller } from './core/http';
// в return:
  return { config, logger: deps.logger, apiLimiter, controllers, sessionMiddleware: null };
```

- [ ] **Step 7: Дополнить `apps/api/test/helpers.ts`** — добавить в конец файла:

```ts
import { pino } from 'pino';
import type { Hono } from 'hono';
import { createApp } from '../src/app';
import { loadConfig, type Config } from '../src/core/config';
import { createContainer, type Container } from '../src/container';
import type { AppEnv } from '../src/core/http';

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

  get(path: string, headers: Record<string, string> = {}): Promise<Response> {
    return this.send('GET', path, undefined, headers);
  }

  post(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
    return this.send('POST', path, body, headers);
  }

  private async send(method: string, path: string, body: unknown, extra: Record<string, string>): Promise<Response> {
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
    return res;
  }
}
```

Перенести все `import` из этого блока в начало файла `helpers.ts` (к существующим импортам).

- [ ] **Step 8: Падающий тест `apps/api/test/http.test.ts`**

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext } from './helpers';

const ctx = await createTestContext();
afterAll(() => ctx.close());

describe('http core', () => {
  it('GET /api/health reports ok', async () => {
    const res = await ctx.client().get('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: 'ok' });
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
  it('unknown route returns uniform 404 body', async () => {
    const res = await ctx.client().get('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
  it('blocks state-changing requests without our Origin', async () => {
    const res = await ctx.client().withoutOrigin().post('/api/health', {});
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });
});
```

- [ ] **Step 9: Запустить** `npm test -w @libify/api` → до Step 1–7 был бы FAIL; после них — `http.test.ts` 3 passed. Если `POST /api/health` без Origin возвращает 404 вместо 403 — middleware `originCheck` должен стоять до роутинга (он стоит), проверить порядок `app.use`.

- [ ] **Step 10: typecheck + commit**

```bash
npm run typecheck -w @libify/api
git add apps/api
git commit -m "feat(api): add http core, middleware, health endpoint and test client"
```

---

### Task 7: Авторизация (ник + пароль, cookie-сессии)

**Files:**
- Create: `apps/api/src/modules/auth/{password-hasher,user.repository,session.repository,auth.service,session-cookie,session.middleware,auth.controller}.ts`
- Create: `apps/api/src/core/pg-errors.ts`
- Modify: `apps/api/src/container.ts`
- Test: `apps/api/test/auth.test.ts`

- [ ] **Step 1: Падающий тест `apps/api/test/auth.test.ts`**

```ts
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
```

- [ ] **Step 2: Запустить — FAIL** (`npm test -w @libify/api -- auth`; 404 на `/api/auth/register`)

- [ ] **Step 3: `apps/api/src/core/pg-errors.ts`**

```ts
/** Postgres SQLSTATE of a driver error, unwrapping Drizzle's DrizzleQueryError. */
export function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export const UNIQUE_VIOLATION = '23505';
```

- [ ] **Step 4: `apps/api/src/modules/auth/password-hasher.ts`**

```ts
import { hash, verify } from '@node-rs/argon2';

/** Argon2id with OWASP-recommended minimums (19 MiB, t=2, p=1). */
export class PasswordHasher {
  private static readonly OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
  private dummyHash: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return hash(password, PasswordHasher.OPTIONS);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  /** Burns the same CPU as a real check, so unknown nicknames are not detectable by timing. */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('libify-timing-equaliser');
    await verify(await this.dummyHash, password);
    return false;
  }
}
```

- [ ] **Step 5: `apps/api/src/modules/auth/user.repository.ts`**

```ts
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
```

- [ ] **Step 6: `apps/api/src/modules/auth/session.repository.ts`**

```ts
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
```

- [ ] **Step 7: `apps/api/src/modules/auth/auth.service.ts`**

```ts
import { createHash, randomBytes } from 'node:crypto';
import type { Credentials, LoginInput, PublicUser } from '@libify/shared';
import type { Clock } from '../../core/clock';
import { InvalidCredentialsError } from '../../core/errors';
import type { SessionUser } from '../../core/http';
import type { PasswordHasher } from './password-hasher';
import type { SessionRepository } from './session.repository';
import { toPublicUser, type UserRepository, type UserRow } from './user.repository';

export interface IssuedSession {
  user: PublicUser;
  token: string;
  expiresAt: Date;
}

export interface AuthenticatedSession {
  user: SessionUser;
  /** Set when the session was extended and the cookie must be re-issued. */
  renewedUntil: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class AuthService {
  static readonly SESSION_TTL_MS = 30 * DAY_MS;
  private static readonly RENEW_WHEN_REMAINING_MS = 15 * DAY_MS;
  private static readonly LAST_SEEN_GRANULARITY_MS = 5 * 60 * 1000;

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async register(input: Credentials, userAgent: string | null): Promise<IssuedSession> {
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create(input.nickname, passwordHash);
    return this.issueSession(user, userAgent);
  }

  async login(input: LoginInput, userAgent: string | null): Promise<IssuedSession> {
    const user = await this.users.findByNickname(input.nickname);
    const valid = user
      ? await this.hasher.verify(user.passwordHash, input.password)
      : await this.hasher.verifyAgainstDummy(input.password);
    if (!user || !valid) throw new InvalidCredentialsError();
    return this.issueSession(user, userAgent);
  }

  async logout(token: string): Promise<void> {
    await this.sessions.delete(AuthService.hashToken(token));
  }

  async authenticate(token: string): Promise<AuthenticatedSession | null> {
    const id = AuthService.hashToken(token);
    const session = await this.sessions.findWithUser(id);
    if (!session) return null;

    const now = this.clock.now();
    if (session.expiresAt <= now) {
      await this.sessions.delete(id);
      return null;
    }

    let renewedUntil: Date | null = null;
    if (session.expiresAt.getTime() - now.getTime() < AuthService.RENEW_WHEN_REMAINING_MS) {
      renewedUntil = new Date(now.getTime() + AuthService.SESSION_TTL_MS);
      await this.sessions.extend(id, renewedUntil);
    }
    if (now.getTime() - session.user.lastSeenAt.getTime() > AuthService.LAST_SEEN_GRANULARITY_MS) {
      await this.users.touchLastSeen(session.user.id, now);
    }

    return { user: { ...toPublicUser(session.user), sessionId: id }, renewedUntil };
  }

  purgeExpiredSessions(): Promise<number> {
    return this.sessions.deleteExpired(this.clock.now());
  }

  private async issueSession(user: UserRow, userAgent: string | null): Promise<IssuedSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.clock.now().getTime() + AuthService.SESSION_TTL_MS);
    await this.sessions.create(AuthService.hashToken(token), user.id, expiresAt, userAgent?.slice(0, 300) ?? null);
    return { user: toPublicUser(user), token, expiresAt };
  }

  /** Only the hash is stored, so a leaked sessions table cannot be replayed. */
  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
```

- [ ] **Step 8: `apps/api/src/modules/auth/session-cookie.ts`**

```ts
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

export class SessionCookie {
  static readonly NAME = 'libify_sid';

  constructor(private readonly secure: boolean) {}

  read(c: Context): string | null {
    return getCookie(c, SessionCookie.NAME) ?? null;
  }

  set(c: Context, token: string, expiresAt: Date): void {
    setCookie(c, SessionCookie.NAME, token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'Lax',
      path: '/',
      expires: expiresAt,
    });
  }

  clear(c: Context): void {
    deleteCookie(c, SessionCookie.NAME, { path: '/', secure: this.secure });
  }
}
```

- [ ] **Step 9: `apps/api/src/modules/auth/session.middleware.ts`**

```ts
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../../core/http';
import type { AuthService } from './auth.service';
import type { SessionCookie } from './session-cookie';

export function sessionMiddleware(auth: AuthService, cookie: SessionCookie): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = cookie.read(c);
    if (token) {
      const session = await auth.authenticate(token);
      if (session) {
        c.set('user', session.user);
        if (session.renewedUntil) cookie.set(c, token, session.renewedUntil);
      } else {
        cookie.clear(c);
      }
    }
    await next();
  };
}
```

- [ ] **Step 10: `apps/api/src/modules/auth/auth.controller.ts`**

```ts
import { Hono, type Context } from 'hono';
import { credentialsSchema, loginSchema, type AuthResponse } from '@libify/shared';
import { RateLimitError } from '../../core/errors';
import { clientIp, currentUser, readJson, type AppEnv, type Controller } from '../../core/http';
import { rateLimit, requireAuth } from '../../core/middleware';
import type { FixedWindowRateLimiter } from '../../core/rate-limiter';
import type { AuthService, IssuedSession } from './auth.service';
import type { SessionCookie } from './session-cookie';

export interface AuthLimiters {
  /** Per IP: register + login attempts. */
  ip: FixedWindowRateLimiter;
  /** Per nickname: login attempts, against password guessing from many IPs. */
  nickname: FixedWindowRateLimiter;
}

export class AuthController implements Controller {
  readonly basePath = '/auth';
  readonly usesSession = true;

  constructor(
    private readonly auth: AuthService,
    private readonly cookie: SessionCookie,
    private readonly limiters: AuthLimiters,
  ) {}

  routes(): Hono<AppEnv> {
    const ipLimit = rateLimit(this.limiters.ip, (c) => `auth-ip:${clientIp(c)}`);

    return new Hono<AppEnv>()
      .post('/register', ipLimit, async (c) => {
        const input = await readJson(c, credentialsSchema);
        const session = await this.auth.register(input, c.req.header('user-agent') ?? null);
        return this.respondWithSession(c, session, 201);
      })
      .post('/login', ipLimit, async (c) => {
        const input = await readJson(c, loginSchema);
        const byNick = this.limiters.nickname.consume(`auth-nick:${input.nickname.toLowerCase()}`);
        if (!byNick.allowed) throw new RateLimitError(byNick.retryAfterSec);
        const session = await this.auth.login(input, c.req.header('user-agent') ?? null);
        return this.respondWithSession(c, session, 200);
      })
      .post('/logout', async (c) => {
        const token = this.cookie.read(c);
        if (token) await this.auth.logout(token);
        this.cookie.clear(c);
        return c.body(null, 204);
      })
      .get('/me', requireAuth, (c) => {
        const { sessionId: _sessionId, ...user } = currentUser(c);
        return c.json<AuthResponse>({ user });
      });
  }

  private respondWithSession(c: Context<AppEnv>, session: IssuedSession, status: 200 | 201) {
    this.cookie.set(c, session.token, session.expiresAt);
    return c.json<AuthResponse>({ user: session.user }, status);
  }
}
```

- [ ] **Step 11: Подключить в `apps/api/src/container.ts`**

Добавить импорты:

```ts
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { PasswordHasher } from './modules/auth/password-hasher';
import { SessionCookie } from './modules/auth/session-cookie';
import { sessionMiddleware } from './modules/auth/session.middleware';
import { SessionRepository } from './modules/auth/session.repository';
import { UserRepository } from './modules/auth/user.repository';
```

В `interface Container` добавить `auth: AuthService;` и `users: UserRepository;`. Тело `createContainer` заменить на:

```ts
  const clock = deps.clock ?? systemClock;
  const apiLimiter = new FixedWindowRateLimiter(120, 60_000, clock);

  const users = new UserRepository(deps.db);
  const auth = new AuthService(users, new SessionRepository(deps.db), new PasswordHasher(), clock);
  const cookie = new SessionCookie(config.cookieSecure);

  const controllers: Controller[] = [
    new HealthController(new HealthService(deps.db)),
    new AuthController(auth, cookie, {
      ip: new FixedWindowRateLimiter(5, 60_000, clock),
      nickname: new FixedWindowRateLimiter(10, 60 * 60_000, clock),
    }),
  ];

  return {
    config,
    logger: deps.logger,
    apiLimiter,
    controllers,
    auth,
    users,
    sessionMiddleware: sessionMiddleware(auth, cookie),
  };
```

И поменять тип поля на необязательность-free: `sessionMiddleware: MiddlewareHandler<AppEnv>;` (в `app.ts` условие `&& container.sessionMiddleware` оставить — оно безвредно).

- [ ] **Step 12: Запустить — PASS**

Run: `npm test -w @libify/api`
Expected: все файлы зелёные, `auth.test.ts` — 7 passed. Тест rate limit регистрирует 5 пользователей
— если какой-то из первых пяти возвращает не 201, проверить уникальность ников в цикле.

- [ ] **Step 13: typecheck + lint + commit**

```bash
npm run typecheck -w @libify/api && npm run lint -w @libify/api
git add apps/api
git commit -m "feat(api): nickname/password auth with argon2id and cookie sessions"
```

---

### Task 8: Синхронизация (push/pull, last-write-wins, tombstones)

**Files:**
- Create: `apps/api/src/modules/sync/{base-sync.repository,entity.repositories,sync.service,sync.controller}.ts`
- Modify: `apps/api/src/container.ts`
- Test: `apps/api/test/sync.test.ts`

- [ ] **Step 1: Падающий тест `apps/api/test/sync.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { SyncPullResponse, SyncPushResponse } from '@libify/shared';
import { createTestContext, type TestClient } from './helpers';

const ctx = await createTestContext();
afterAll(() => ctx.close());

let alice: TestClient;
let bob: TestClient;

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
  alice = ctx.client();
  bob = ctx.client();
  await alice.post('/api/auth/register', { nickname: 'alice', password: 'password1' });
  await bob.post('/api/auth/register', { nickname: 'bob_b', password: 'password1' });
});

const book = (title: string) => ({
  bookId: '42',
  title,
  author: 'Author',
  coverUrl: null,
  status: 'reading',
  format: 'fb2',
  addedAt: '2026-11-18T09:00:00.000Z',
});
const at = (minute: number) => `2026-11-18T10:${String(minute).padStart(2, '0')}:00.000Z`;

async function push(client: TestClient, ops: unknown[]): Promise<SyncPushResponse> {
  const res = await client.post('/api/sync/push', { ops });
  expect(res.status).toBe(200);
  return res.json();
}
async function pull(client: TestClient, since?: string): Promise<SyncPullResponse> {
  const res = await client.get(`/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`);
  expect(res.status).toBe(200);
  return res.json();
}

describe('sync', () => {
  it('requires authentication', async () => {
    expect((await ctx.client().get('/api/sync/pull')).status).toBe(401);
  });

  it('pushes an upsert and pulls it back', async () => {
    const result = await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(1), data: book('First') }]);
    expect(result).toMatchObject({ applied: 1, rejected: [] });
    const { changes } = await pull(alice);
    expect(changes).toEqual([{ entity: 'book', key: '42', updatedAt: at(1), data: book('First') }]);
  });

  it('applies last-write-wins and rejects stale writes', async () => {
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(5), data: book('Newer') }]);
    const stale = await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(3), data: book('Older') }]);
    expect(stale.rejected).toEqual([{ entity: 'book', key: '42', reason: 'STALE' }]);
    const { changes } = await pull(alice);
    expect(changes[0]?.data).toMatchObject({ title: 'Newer' });
  });

  it('deletes via tombstone visible to incremental pull but not to initial pull', async () => {
    const first = await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(1), data: book('X') }]);
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(2), data: null }]);
    const incremental = await pull(alice, first.serverTime);
    expect(incremental.changes).toEqual([{ entity: 'book', key: '42', updatedAt: at(2), data: null }]);
    expect((await pull(alice)).changes).toEqual([]);
  });

  it('re-creates a deleted record when a newer upsert arrives', async () => {
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(1), data: book('X') }]);
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(2), data: null }]);
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: at(3), data: book('Back') }]);
    expect((await pull(alice)).changes[0]?.data).toMatchObject({ title: 'Back' });
  });

  it('rejects ops whose key does not match the data', async () => {
    const r = await push(alice, [{ entity: 'book', key: '999', clientUpdatedAt: at(1), data: book('X') }]);
    expect(r.rejected).toEqual([{ entity: 'book', key: '999', reason: 'KEY_MISMATCH' }]);
  });

  it('isolates users, including id-keyed quotes', async () => {
    const id = '0b0d7f5e-8a51-4a6a-9a8a-5f1d6c1d2e3f';
    const quote = (text: string) => ({ id, bookId: '42', bookTitle: null, bookAuthor: null, text, note: null, color: 'yellow' });
    await push(alice, [{ entity: 'quote', key: id, clientUpdatedAt: at(1), data: quote('alice') }]);
    const hijack = await push(bob, [{ entity: 'quote', key: id, clientUpdatedAt: at(9), data: quote('bob') }]);
    expect(hijack.rejected).toEqual([{ entity: 'quote', key: id, reason: 'STALE' }]);
    expect((await pull(bob)).changes).toEqual([]);
    expect((await pull(alice)).changes[0]?.data).toMatchObject({ text: 'alice' });
  });

  it('syncs every entity type', async () => {
    const qid = '1b0d7f5e-8a51-4a6a-9a8a-5f1d6c1d2e3f';
    const bid = '2b0d7f5e-8a51-4a6a-9a8a-5f1d6c1d2e3f';
    const r = await push(alice, [
      { entity: 'book', key: '42', clientUpdatedAt: at(1), data: book('B') },
      { entity: 'progress', key: '42', clientUpdatedAt: at(1), data: { bookId: '42', paragraphIndex: 10, scrollRatio: 0.5, currentPage: 3, totalPages: 9 } },
      { entity: 'quote', key: qid, clientUpdatedAt: at(1), data: { id: qid, bookId: '42', bookTitle: 'B', bookAuthor: null, text: 'q', note: null, color: 'blue' } },
      { entity: 'bookmark', key: bid, clientUpdatedAt: at(1), data: { id: bid, bookId: '42', paragraphIndex: 7, previewText: 'p' } },
      { entity: 'favorite', key: '42', clientUpdatedAt: at(1), data: { bookId: '42', title: 'B', author: null, coverUrl: null } },
    ]);
    expect(r.applied).toBe(5);
    const entities = (await pull(alice)).changes.map((c) => c.entity).sort();
    expect(entities).toEqual(['book', 'bookmark', 'favorite', 'progress', 'quote']);
  });

  it('clamps client timestamps from the future', async () => {
    await push(alice, [{ entity: 'book', key: '42', clientUpdatedAt: '2099-01-01T00:00:00.000Z', data: book('Future') }]);
    const { changes } = await pull(alice);
    expect(new Date(changes[0]!.updatedAt).getFullYear()).toBe(2026);
  });
});
```

- [ ] **Step 2: Запустить — FAIL** (`npm test -w @libify/api -- sync`; 404 на `/api/sync/*`)

- [ ] **Step 3: `apps/api/src/modules/sync/base-sync.repository.ts`**

```ts
import { and, eq, gt, isNull, lt, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Database, DbExecutor } from '../../core/db';

export interface SyncRecord<D> {
  key: string;
  updatedAt: Date;
  /** null = tombstone */
  data: D | null;
}

export interface SyncEntityRepository<D> {
  /** Returns true when the write was applied (newer than what is stored). */
  write(tx: DbExecutor, userId: string, key: string, data: D | null, updatedAt: Date): Promise<boolean>;
  changedSince(userId: string, since: Date | null): Promise<SyncRecord<D>[]>;
}

type SyncTable = PgTable & {
  userId: PgColumn;
  updatedAt: PgColumn;
  syncedAt: PgColumn;
  deletedAt: PgColumn;
};

interface SyncRowBase {
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Generic last-write-wins persistence for one synced table.
 * Drizzle's generic table types do not narrow through an abstract base class,
 * so the few `as never` casts below are confined to this file.
 */
export abstract class BaseSyncRepository<D, Row extends SyncRowBase> implements SyncEntityRepository<D> {
  protected abstract readonly table: SyncTable;
  protected abstract readonly keyColumn: PgColumn;
  protected abstract readonly conflictTarget: PgColumn[];
  protected abstract toValues(data: D): Record<string, unknown>;
  protected abstract fromRow(row: Row): D;
  protected abstract keyOf(row: Row): string;

  constructor(protected readonly db: Database) {}

  async write(tx: DbExecutor, userId: string, key: string, data: D | null, updatedAt: Date): Promise<boolean> {
    return data === null ? this.tombstone(tx, userId, key, updatedAt) : this.upsert(tx, userId, data, updatedAt);
  }

  async changedSince(userId: string, since: Date | null): Promise<SyncRecord<D>[]> {
    const t = this.table;
    const where: SQL | undefined = since
      ? and(eq(t.userId, userId), gt(t.syncedAt, since))
      : and(eq(t.userId, userId), isNull(t.deletedAt));
    const rows = (await this.db.select().from(t as never).where(where)) as Row[];
    return rows.map((row) => ({
      key: this.keyOf(row),
      updatedAt: row.updatedAt,
      data: row.deletedAt ? null : this.fromRow(row),
    }));
  }

  private async upsert(tx: DbExecutor, userId: string, data: D, updatedAt: Date): Promise<boolean> {
    const t = this.table;
    const values = { ...this.toValues(data), userId, updatedAt, deletedAt: null };
    const { userId: _owner, ...updatable } = values;
    const rows = await tx
      .insert(t)
      .values(values as never)
      .onConflictDoUpdate({
        target: this.conflictTarget,
        set: { ...updatable, syncedAt: sql`now()` } as never,
        // Only overwrite rows that belong to this user and are older.
        setWhere: and(eq(t.userId, userId), lt(t.updatedAt, updatedAt)),
      })
      .returning({ key: this.keyColumn });
    return rows.length > 0;
  }

  private async tombstone(tx: DbExecutor, userId: string, key: string, updatedAt: Date): Promise<boolean> {
    const t = this.table;
    const owned = and(eq(t.userId, userId), eq(this.keyColumn, key));
    const updated = await tx
      .update(t)
      .set({ deletedAt: updatedAt, updatedAt, syncedAt: sql`now()` } as never)
      .where(and(owned, lt(t.updatedAt, updatedAt)))
      .returning({ key: this.keyColumn });
    if (updated.length > 0) return true;
    // Deleting something that never reached the server is a no-op success.
    const existing = await tx.select({ key: this.keyColumn }).from(t as never).where(owned).limit(1);
    return existing.length === 0;
  }
}
```

- [ ] **Step 4: `apps/api/src/modules/sync/entity.repositories.ts`**

```ts
import type { BookData, BookmarkData, FavoriteData, ProgressData, QuoteData } from '@libify/shared';
import { bookmarks, favorites, quotes, readingProgress, userBooks } from '../../db/schema';
import { BaseSyncRepository } from './base-sync.repository';

type BookRow = typeof userBooks.$inferSelect;
type ProgressRow = typeof readingProgress.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;
type BookmarkRow = typeof bookmarks.$inferSelect;
type FavoriteRow = typeof favorites.$inferSelect;

export class BookSyncRepository extends BaseSyncRepository<BookData, BookRow> {
  protected readonly table = userBooks;
  protected readonly keyColumn = userBooks.bookId;
  protected readonly conflictTarget = [userBooks.userId, userBooks.bookId];

  protected toValues(d: BookData) {
    return {
      bookId: d.bookId,
      title: d.title,
      author: d.author,
      coverUrl: d.coverUrl,
      status: d.status,
      format: d.format,
      addedAt: new Date(d.addedAt),
    };
  }
  protected fromRow(r: BookRow): BookData {
    return {
      bookId: r.bookId,
      title: r.title,
      author: r.author,
      coverUrl: r.coverUrl,
      status: r.status,
      format: r.format,
      addedAt: r.addedAt.toISOString(),
    };
  }
  protected keyOf(r: BookRow) {
    return r.bookId;
  }
}

export class ProgressSyncRepository extends BaseSyncRepository<ProgressData, ProgressRow> {
  protected readonly table = readingProgress;
  protected readonly keyColumn = readingProgress.bookId;
  protected readonly conflictTarget = [readingProgress.userId, readingProgress.bookId];

  protected toValues(d: ProgressData) {
    return { ...d };
  }
  protected fromRow(r: ProgressRow): ProgressData {
    return {
      bookId: r.bookId,
      paragraphIndex: r.paragraphIndex,
      scrollRatio: r.scrollRatio,
      currentPage: r.currentPage,
      totalPages: r.totalPages,
    };
  }
  protected keyOf(r: ProgressRow) {
    return r.bookId;
  }
}

export class QuoteSyncRepository extends BaseSyncRepository<QuoteData, QuoteRow> {
  protected readonly table = quotes;
  protected readonly keyColumn = quotes.id;
  protected readonly conflictTarget = [quotes.id];

  protected toValues(d: QuoteData) {
    return { ...d };
  }
  protected fromRow(r: QuoteRow): QuoteData {
    return {
      id: r.id,
      bookId: r.bookId,
      bookTitle: r.bookTitle,
      bookAuthor: r.bookAuthor,
      text: r.text,
      note: r.note,
      color: r.color,
    };
  }
  protected keyOf(r: QuoteRow) {
    return r.id;
  }
}

export class BookmarkSyncRepository extends BaseSyncRepository<BookmarkData, BookmarkRow> {
  protected readonly table = bookmarks;
  protected readonly keyColumn = bookmarks.id;
  protected readonly conflictTarget = [bookmarks.id];

  protected toValues(d: BookmarkData) {
    return { ...d };
  }
  protected fromRow(r: BookmarkRow): BookmarkData {
    return { id: r.id, bookId: r.bookId, paragraphIndex: r.paragraphIndex, previewText: r.previewText };
  }
  protected keyOf(r: BookmarkRow) {
    return r.id;
  }
}

export class FavoriteSyncRepository extends BaseSyncRepository<FavoriteData, FavoriteRow> {
  protected readonly table = favorites;
  protected readonly keyColumn = favorites.bookId;
  protected readonly conflictTarget = [favorites.userId, favorites.bookId];

  protected toValues(d: FavoriteData) {
    return { ...d };
  }
  protected fromRow(r: FavoriteRow): FavoriteData {
    return { bookId: r.bookId, title: r.title, author: r.author, coverUrl: r.coverUrl };
  }
  protected keyOf(r: FavoriteRow) {
    return r.bookId;
  }
}
```

- [ ] **Step 5: `apps/api/src/modules/sync/sync.service.ts`**

```ts
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
```

Замечание к тесту «tombstone visible to incremental pull»: курсор `first.serverTime` взят после первой записи,
pull вычитает 10 с overlap — первая запись (book 'X') тоже попадёт в окно, но это та же строка, которая теперь
tombstone, поэтому в ответе одна запись с `data: null`. Тест это и проверяет.

- [ ] **Step 6: `apps/api/src/modules/sync/sync.controller.ts`**

```ts
import { Hono } from 'hono';
import { syncPullQuerySchema, syncPushRequestSchema, type SyncPullResponse, type SyncPushResponse } from '@libify/shared';
import { currentUser, parseWith, readJson, type AppEnv, type Controller } from '../../core/http';
import { requireAuth } from '../../core/middleware';
import type { SyncService } from './sync.service';

export class SyncController implements Controller {
  readonly basePath = '/sync';
  readonly usesSession = true;

  constructor(private readonly sync: SyncService) {}

  routes(): Hono<AppEnv> {
    return new Hono<AppEnv>()
      .use(requireAuth)
      .post('/push', async (c) => {
        const { ops } = await readJson(c, syncPushRequestSchema);
        return c.json<SyncPushResponse>(await this.sync.push(currentUser(c).id, ops));
      })
      .get('/pull', async (c) => {
        const { since } = parseWith(syncPullQuerySchema, c.req.query());
        return c.json<SyncPullResponse>(await this.sync.pull(currentUser(c).id, since));
      });
  }
}
```

- [ ] **Step 7: Подключить в `container.ts`**

Импорты:

```ts
import {
  BookmarkSyncRepository,
  BookSyncRepository,
  FavoriteSyncRepository,
  ProgressSyncRepository,
  QuoteSyncRepository,
} from './modules/sync/entity.repositories';
import { SyncController } from './modules/sync/sync.controller';
import { SyncService } from './modules/sync/sync.service';
```

Перед `const controllers`:

```ts
  const sync = new SyncService(
    deps.db,
    {
      book: new BookSyncRepository(deps.db),
      progress: new ProgressSyncRepository(deps.db),
      quote: new QuoteSyncRepository(deps.db),
      bookmark: new BookmarkSyncRepository(deps.db),
      favorite: new FavoriteSyncRepository(deps.db),
    },
    clock,
  );
```

В массив `controllers` добавить `new SyncController(sync),`.

- [ ] **Step 8: Запустить — PASS**

Run: `npm test -w @libify/api`
Expected: `sync.test.ts` 9 passed, остальные зелёные. Если Drizzle ругается на `setWhere` — в 0.45 параметр
называется `setWhere` (а `where` — устаревший); проверить по `node_modules/drizzle-orm/pg-core/query-builders/insert.d.ts`.

- [ ] **Step 9: typecheck + lint + commit**

```bash
npm run typecheck -w @libify/api && npm run lint -w @libify/api
git add apps/api
git commit -m "feat(api): offline-first sync with last-write-wins and tombstones"
```

---

### Task 9: Каталог Flibusta (белый список хостов, кеш, стриминг)

**Files:**
- Create: `apps/api/src/modules/catalog/{catalog.client,catalog.service,catalog.controller}.ts`
- Modify: `apps/api/src/container.ts`
- Test: `apps/api/test/catalog.test.ts`

- [ ] **Step 1: Падающий тест `apps/api/test/catalog.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CatalogClient } from '../src/modules/catalog/catalog.client';
import { createTestContext } from './helpers';

type Handler = (url: URL) => Response | Promise<Response>;
let handler: Handler = () => new Response('not set', { status: 500 });
const calls: string[] = [];
const fakeFetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  calls.push(url.toString());
  return handler(url);
}) as typeof fetch;

const ctx = await createTestContext({ fetch: fakeFetch });
afterAll(() => ctx.close());
beforeEach(() => {
  calls.length = 0;
});

describe('CatalogClient', () => {
  const client = new CatalogClient(['flibusta.is'], fakeFetch, 1_000, 2, 0);

  it('refuses hosts outside the allow-list', async () => {
    await expect(client.get(new URL('http://169.254.169.254/latest'))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(calls).toEqual([]);
  });

  it('refuses redirects to foreign hosts', async () => {
    handler = () => new Response(null, { status: 302, headers: { location: 'http://evil.test/x' } });
    await expect(client.get(new URL('https://flibusta.is/b/1/fb2'))).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('retries on 5xx and then succeeds', async () => {
    let n = 0;
    handler = () => (++n < 3 ? new Response('down', { status: 503 }) : new Response('ok'));
    const res = await client.get(new URL('https://flibusta.is/opds'));
    expect(await res.text()).toBe('ok');
    expect(calls).toHaveLength(3);
  });
});

describe('catalog routes', () => {
  it('proxies OPDS search and caches it', async () => {
    handler = () => new Response('<feed/>', { headers: { 'content-type': 'application/atom+xml' } });
    const first = await ctx.client().get('/api/catalog/search?q=Tolstoy');
    expect(first.status).toBe(200);
    expect(await first.text()).toBe('<feed/>');
    expect(calls[0]).toBe('https://flibusta.is/opds/search?searchType=books&searchTerm=Tolstoy');
    await ctx.client().get('/api/catalog/search?q=tolstoy');
    expect(calls).toHaveLength(1);
  });

  it('streams a book download', async () => {
    handler = () => new Response('BOOK', { headers: { 'content-type': 'application/zip' } });
    const res = await ctx.client().get('/api/catalog/book/123/fb2');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(await res.text()).toBe('BOOK');
  });

  it('validates book id and format', async () => {
    expect((await ctx.client().get('/api/catalog/book/abc/fb2')).status).toBe(400);
    expect((await ctx.client().get('/api/catalog/book/1/exe')).status).toBe(400);
  });

  it('serves images only from allowed hosts and with image extensions', async () => {
    handler = () => new Response('IMG', { headers: { 'content-type': 'image/jpeg' } });
    const ok = await ctx.client().get(`/api/catalog/image?src=${encodeURIComponent('https://static.flibusta.is/i/1/cover.jpg')}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toMatch(/max-age=604800/);
    const foreign = await ctx.client().get(`/api/catalog/image?src=${encodeURIComponent('https://evil.test/a.jpg')}`);
    expect(foreign.status).toBe(400);
    const notImage = await ctx.client().get(`/api/catalog/image?src=${encodeURIComponent('https://flibusta.is/b/1/fb2')}`);
    expect(notImage.status).toBe(400);
  });

  it('maps upstream 404 to NOT_FOUND', async () => {
    handler = () => new Response('nope', { status: 404 });
    const res = await ctx.client().get('/api/catalog/book/5/epub');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Запустить — FAIL** (модуль catalog.client не найден)

- [ ] **Step 3: `apps/api/src/modules/catalog/catalog.client.ts`**

```ts
import { UpstreamError, ValidationError } from '../../core/errors';

/** Fetches only from allow-listed hosts; follows redirects manually to re-check every hop. */
export class CatalogClient {
  private static readonly MAX_REDIRECTS = 3;
  private static readonly USER_AGENT = 'LibifyBot/2.0 (+https://libify.store)';

  constructor(
    private readonly allowedHosts: readonly string[],
    private readonly fetchFn: typeof fetch,
    private readonly timeoutMs = 15_000,
    private readonly retries = 2,
    private readonly backoffMs = 500,
  ) {}

  async get(url: URL): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await this.fetchFollowingRedirects(url);
        if (res.status >= 500) throw new UpstreamError(`Catalog responded ${res.status}`);
        return res;
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        lastError = err;
        if (attempt < this.retries) await sleep(this.backoffMs * 2 ** attempt);
      }
    }
    throw new UpstreamError(`Catalog unavailable: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }

  private async fetchFollowingRedirects(start: URL): Promise<Response> {
    let url = start;
    for (let hop = 0; hop <= CatalogClient.MAX_REDIRECTS; hop++) {
      this.assertAllowed(url);
      const res = await this.fetchFn(url, {
        headers: { 'User-Agent': CatalogClient.USER_AGENT },
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const location = res.headers.get('location');
      if (res.status < 300 || res.status >= 400 || !location) return res;
      url = new URL(location, url);
    }
    throw new UpstreamError('Too many redirects');
  }

  private assertAllowed(url: URL): void {
    if (!['http:', 'https:'].includes(url.protocol) || !this.allowedHosts.includes(url.hostname)) {
      throw new ValidationError(`Host not allowed: ${url.hostname}`);
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
```

- [ ] **Step 4: `apps/api/src/modules/catalog/catalog.service.ts`**

```ts
import { LRUCache } from 'lru-cache';
import type { BookFormat } from '@libify/shared';
import { NotFoundError, UpstreamError, ValidationError } from '../../core/errors';
import type { CatalogClient } from './catalog.client';

const IMAGE_PATH = /\.(jpe?g|png|gif|webp)$/i;

export class CatalogService {
  private readonly searchCache = new LRUCache<string, string>({
    max: 200,
    ttl: 10 * 60_000,
    maxSize: 10 * 1024 * 1024,
    sizeCalculation: (xml) => Math.max(1, xml.length),
  });

  constructor(
    private readonly client: CatalogClient,
    private readonly baseUrl: URL,
  ) {}

  async searchOpds(term: string): Promise<string> {
    const cacheKey = term.trim().toLowerCase();
    const cached = this.searchCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const url = new URL('/opds/search', this.baseUrl);
    url.searchParams.set('searchType', 'books');
    url.searchParams.set('searchTerm', term.trim());
    const xml = await (await this.ensureOk(await this.client.get(url))).text();
    this.searchCache.set(cacheKey, xml);
    return xml;
  }

  async downloadBook(bookId: string, format: BookFormat): Promise<Response> {
    return this.ensureOk(await this.client.get(new URL(`/b/${bookId}/${format}`, this.baseUrl)));
  }

  async image(src: string): Promise<Response> {
    let url: URL;
    try {
      url = new URL(src, this.baseUrl);
    } catch {
      throw new ValidationError('Invalid image URL');
    }
    if (!IMAGE_PATH.test(url.pathname)) throw new ValidationError('Not an image path');
    return this.ensureOk(await this.client.get(url));
  }

  private ensureOk(res: Response): Response {
    if (res.status === 404) throw new NotFoundError('Not found in catalog');
    if (!res.ok) throw new UpstreamError(`Catalog responded ${res.status}`);
    return res;
  }
}
```

- [ ] **Step 5: `apps/api/src/modules/catalog/catalog.controller.ts`**

```ts
import { Hono } from 'hono';
import { catalogBookParamsSchema, catalogImageQuerySchema, catalogSearchQuerySchema } from '@libify/shared';
import { parseWith, type AppEnv, type Controller } from '../../core/http';
import type { CatalogService } from './catalog.service';

const passthrough = (upstream: Response, cacheControl: string, extra: string[] = []): Response => {
  const headers = new Headers({
    'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    'Cache-Control': cacheControl,
  });
  for (const name of extra) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
};

export class CatalogController implements Controller {
  readonly basePath = '/catalog';
  readonly usesSession = false;

  constructor(private readonly catalog: CatalogService) {}

  routes(): Hono<AppEnv> {
    return new Hono<AppEnv>()
      .get('/search', async (c) => {
        const { q } = parseWith(catalogSearchQuerySchema, c.req.query());
        const xml = await this.catalog.searchOpds(q);
        return c.body(xml, 200, { 'Content-Type': 'application/atom+xml; charset=utf-8', 'Cache-Control': 'private, max-age=300' });
      })
      .get('/book/:id/:format', async (c) => {
        const { id, format } = parseWith(catalogBookParamsSchema, c.req.param());
        const upstream = await this.catalog.downloadBook(id, format);
        return passthrough(upstream, 'private, max-age=86400', ['content-disposition', 'content-length']);
      })
      .get('/image', async (c) => {
        const { src } = parseWith(catalogImageQuerySchema, c.req.query());
        return passthrough(await this.catalog.image(src), 'public, max-age=604800', ['content-length']);
      });
  }
}
```

- [ ] **Step 6: Подключить в `container.ts`**

Импорты:

```ts
import { CatalogClient } from './modules/catalog/catalog.client';
import { CatalogController } from './modules/catalog/catalog.controller';
import { CatalogService } from './modules/catalog/catalog.service';
```

Перед `const controllers`:

```ts
  const fetchFn = deps.fetch ?? fetch;
  const [primaryCatalogHost = 'flibusta.is'] = config.catalogHosts;
  const catalog = new CatalogService(
    new CatalogClient(config.catalogHosts, fetchFn),
    new URL(`https://${primaryCatalogHost}`),
  );
```

В `controllers` добавить `new CatalogController(catalog),`.

В тестах ретраи с backoff 500 мс замедлят тест 404 — нет, 404 не ретраится (ретрай только на ≥500).
Тест `retries on 5xx` создаёт свой клиент с `backoffMs = 0`.

- [ ] **Step 7: Запустить — PASS**

Run: `npm test -w @libify/api -- catalog`
Expected: 8 passed.

- [ ] **Step 8: Commit**

```bash
npm run typecheck -w @libify/api && npm run lint -w @libify/api
git add apps/api
git commit -m "feat(api): allow-listed Flibusta catalog proxy with caching and streaming"
```

---

### Task 10: AI-пересказ

**Files:**
- Create: `apps/api/src/modules/ai/{ai.service,ai.controller}.ts`
- Modify: `apps/api/src/container.ts`
- Test: `apps/api/test/ai.test.ts`

- [ ] **Step 1: Падающий тест `apps/api/test/ai.test.ts`**

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers';

const aiFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body));
  return Response.json({ choices: [{ message: { content: `summary of ${body.messages[1].content}` } }] });
}) as typeof fetch;

const disabled = await createTestContext();
const enabled: TestContext = await createTestContext({
  fetch: aiFetch,
  env: { AI_BASE_URL: 'https://ai.test/v1', AI_API_KEY: 'k', AI_MODEL: 'm' },
});
afterAll(async () => {
  await disabled.close();
  await enabled.close();
});

async function loggedIn(ctx: TestContext) {
  const client = ctx.client();
  await client.post('/api/auth/register', { nickname: `ai_${Math.random().toString(36).slice(2, 8)}`, password: 'password1' });
  return client;
}

describe('ai', () => {
  it('reports status', async () => {
    expect(await (await disabled.client().get('/api/ai/status')).json()).toEqual({ enabled: false });
    expect(await (await enabled.client().get('/api/ai/status')).json()).toEqual({ enabled: true });
  });
  it('requires auth to summarize', async () => {
    expect((await enabled.client().post('/api/ai/summarize', { text: 'x' })).status).toBe(401);
  });
  it('returns 503 AI_DISABLED when not configured', async () => {
    const res = await (await loggedIn(disabled)).post('/api/ai/summarize', { text: 'hello' });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('AI_DISABLED');
  });
  it('summarizes via the configured provider', async () => {
    const res = await (await loggedIn(enabled)).post('/api/ai/summarize', { text: 'chapter' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: 'summary of chapter' });
  });
});
```

- [ ] **Step 2: Запустить — FAIL** (404 на `/api/ai/status`)

- [ ] **Step 3: `apps/api/src/modules/ai/ai.service.ts`**

```ts
import type { AiConfig } from '../../core/config';
import { AiDisabledError, UpstreamError } from '../../core/errors';

const SYSTEM_PROMPT =
  'You are a reading assistant. Summarize the passage briefly (max 150 words) so the reader remembers ' +
  'what is happening. Answer in the same language as the passage.';

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
}

export class AiService {
  private static readonly TIMEOUT_MS = 20_000;

  constructor(
    private readonly config: AiConfig | null,
    private readonly fetchFn: typeof fetch,
  ) {}

  get enabled(): boolean {
    return this.config !== null;
  }

  async summarize(text: string): Promise<string> {
    if (!this.config) throw new AiDisabledError();
    let res: Response;
    try {
      res = await this.fetchFn(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
          temperature: 0.5,
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(AiService.TIMEOUT_MS),
      });
    } catch (err) {
      throw new UpstreamError(`AI request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) throw new UpstreamError(`AI provider responded ${res.status}`);
    const summary = ((await res.json()) as ChatCompletion).choices?.[0]?.message?.content?.trim();
    if (!summary) throw new UpstreamError('AI provider returned an empty answer');
    return summary;
  }
}
```

- [ ] **Step 4: `apps/api/src/modules/ai/ai.controller.ts`**

```ts
import { Hono } from 'hono';
import { aiSummarizeRequestSchema, type AiStatusResponse, type AiSummarizeResponse } from '@libify/shared';
import { readJson, type AppEnv, type Controller } from '../../core/http';
import { rateLimit, requireAuth, userOrIpKey } from '../../core/middleware';
import type { FixedWindowRateLimiter } from '../../core/rate-limiter';
import type { AiService } from './ai.service';

export class AiController implements Controller {
  readonly basePath = '/ai';
  readonly usesSession = true;

  constructor(
    private readonly ai: AiService,
    private readonly limiter: FixedWindowRateLimiter,
  ) {}

  routes(): Hono<AppEnv> {
    return new Hono<AppEnv>()
      .get('/status', (c) => c.json<AiStatusResponse>({ enabled: this.ai.enabled }))
      .post('/summarize', requireAuth, rateLimit(this.limiter, userOrIpKey('ai')), async (c) => {
        const { text } = await readJson(c, aiSummarizeRequestSchema);
        return c.json<AiSummarizeResponse>({ summary: await this.ai.summarize(text) });
      });
  }
}
```

- [ ] **Step 5: Подключить в `container.ts`**

Импорты:

```ts
import { AiController } from './modules/ai/ai.controller';
import { AiService } from './modules/ai/ai.service';
```

В `controllers` добавить:

```ts
    new AiController(new AiService(config.ai, fetchFn), new FixedWindowRateLimiter(20, 60_000, clock)),
```

- [ ] **Step 6: Запустить — PASS** (`npm test -w @libify/api -- ai` → 4 passed)

- [ ] **Step 7: Commit**

```bash
npm run typecheck -w @libify/api && npm run lint -w @libify/api
git add apps/api
git commit -m "feat(api): optional OpenAI-compatible summarize endpoint"
```

---

### Task 11: Админ-статистика и CLI make-admin

**Files:**
- Create: `apps/api/src/modules/admin/{admin.repository,admin.service,admin.controller}.ts`, `apps/api/src/cli/make-admin.ts`
- Modify: `apps/api/src/container.ts`
- Test: `apps/api/test/admin.test.ts`

- [ ] **Step 1: Падающий тест `apps/api/test/admin.test.ts`**

```ts
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
```

Примечание: окна статистики (`24 hours`, `7 days`, `30 days`) считаются от `now()` базы, а не от FakeClock —
`created_at` тоже ставит база, поэтому тест не зависит от реальной даты запуска.

- [ ] **Step 2: Запустить — FAIL** (404 на `/api/admin/stats`)

- [ ] **Step 3: `apps/api/src/modules/admin/admin.repository.ts`**

```ts
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
```

- [ ] **Step 4: `apps/api/src/modules/admin/admin.service.ts`**

```ts
import type { AdminStats } from '@libify/shared';
import type { AdminRepository } from './admin.repository';

export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  getStats(): Promise<AdminStats> {
    return this.repo.stats();
  }
}
```

- [ ] **Step 5: `apps/api/src/modules/admin/admin.controller.ts`**

```ts
import { Hono } from 'hono';
import type { AdminStats } from '@libify/shared';
import type { AppEnv, Controller } from '../../core/http';
import { requireAdmin } from '../../core/middleware';
import type { AdminService } from './admin.service';

export class AdminController implements Controller {
  readonly basePath = '/admin';
  readonly usesSession = true;

  constructor(private readonly admin: AdminService) {}

  routes(): Hono<AppEnv> {
    return new Hono<AppEnv>()
      .use(requireAdmin)
      .get('/stats', async (c) => c.json<AdminStats>(await this.admin.getStats()));
  }
}
```

- [ ] **Step 6: `apps/api/src/cli/make-admin.ts`**

```ts
import { createDatabase } from '../core/db';
import { UserRepository } from '../modules/auth/user.repository';

const nickname = process.argv[2];
const url = process.env.DATABASE_URL;
if (!nickname || !url) {
  console.error('Usage: DATABASE_URL=... make-admin <nickname>');
  process.exit(1);
}

const { db, close } = createDatabase(url, 1);
try {
  const ok = await new UserRepository(db).setRole(nickname, 'admin');
  console.log(ok ? `User "${nickname}" is now admin` : `User "${nickname}" not found`);
  process.exitCode = ok ? 0 : 2;
} finally {
  await close();
}
```

- [ ] **Step 7: Финальная версия `apps/api/src/container.ts`** (полная замена — сверка после Tasks 6–11)

```ts
import type { MiddlewareHandler } from 'hono';
import { systemClock, type Clock } from './core/clock';
import type { Config } from './core/config';
import type { Database } from './core/db';
import type { AppEnv, Controller } from './core/http';
import type { Logger } from './core/logger';
import { FixedWindowRateLimiter } from './core/rate-limiter';
import { AdminController } from './modules/admin/admin.controller';
import { AdminRepository } from './modules/admin/admin.repository';
import { AdminService } from './modules/admin/admin.service';
import { AiController } from './modules/ai/ai.controller';
import { AiService } from './modules/ai/ai.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { PasswordHasher } from './modules/auth/password-hasher';
import { SessionCookie } from './modules/auth/session-cookie';
import { sessionMiddleware } from './modules/auth/session.middleware';
import { SessionRepository } from './modules/auth/session.repository';
import { UserRepository } from './modules/auth/user.repository';
import { CatalogClient } from './modules/catalog/catalog.client';
import { CatalogController } from './modules/catalog/catalog.controller';
import { CatalogService } from './modules/catalog/catalog.service';
import { HealthController } from './modules/health/health.controller';
import { HealthService } from './modules/health/health.service';
import {
  BookmarkSyncRepository,
  BookSyncRepository,
  FavoriteSyncRepository,
  ProgressSyncRepository,
  QuoteSyncRepository,
} from './modules/sync/entity.repositories';
import { SyncController } from './modules/sync/sync.controller';
import { SyncService } from './modules/sync/sync.service';

export interface ContainerDeps {
  db: Database;
  logger: Logger;
  clock?: Clock;
  fetch?: typeof fetch;
}

export interface Container {
  config: Config;
  logger: Logger;
  apiLimiter: FixedWindowRateLimiter;
  sessionMiddleware: MiddlewareHandler<AppEnv>;
  controllers: Controller[];
  auth: AuthService;
  users: UserRepository;
}

export function createContainer(config: Config, deps: ContainerDeps): Container {
  const clock = deps.clock ?? systemClock;
  const fetchFn = deps.fetch ?? fetch;
  const { db } = deps;

  const users = new UserRepository(db);
  const auth = new AuthService(users, new SessionRepository(db), new PasswordHasher(), clock);
  const cookie = new SessionCookie(config.cookieSecure);

  const sync = new SyncService(
    db,
    {
      book: new BookSyncRepository(db),
      progress: new ProgressSyncRepository(db),
      quote: new QuoteSyncRepository(db),
      bookmark: new BookmarkSyncRepository(db),
      favorite: new FavoriteSyncRepository(db),
    },
    clock,
  );

  const [primaryCatalogHost = 'flibusta.is'] = config.catalogHosts;
  const catalog = new CatalogService(
    new CatalogClient(config.catalogHosts, fetchFn),
    new URL(`https://${primaryCatalogHost}`),
  );

  const controllers: Controller[] = [
    new HealthController(new HealthService(db)),
    new AuthController(auth, cookie, {
      ip: new FixedWindowRateLimiter(5, 60_000, clock),
      nickname: new FixedWindowRateLimiter(10, 60 * 60_000, clock),
    }),
    new SyncController(sync),
    new CatalogController(catalog),
    new AiController(new AiService(config.ai, fetchFn), new FixedWindowRateLimiter(20, 60_000, clock)),
    new AdminController(new AdminService(new AdminRepository(db))),
  ];

  return {
    config,
    logger: deps.logger,
    apiLimiter: new FixedWindowRateLimiter(120, 60_000, clock),
    sessionMiddleware: sessionMiddleware(auth, cookie),
    controllers,
    auth,
    users,
  };
}
```

И в `app.ts` упростить цикл сессии (поле теперь обязательное):

```ts
  for (const controller of container.controllers) {
    if (controller.usesSession) app.use(`${controller.basePath}/*`, container.sessionMiddleware);
  }
```

- [ ] **Step 8: Запустить весь набор — PASS**

Run: `npm test -w @libify/api && npm run typecheck -w @libify/api && npm run lint -w @libify/api`
Expected: все тестовые файлы зелёные (config, db, rate-limiter, http, auth, sync, catalog, ai, admin).

- [ ] **Step 9: Commit**

```bash
git add apps/api
git commit -m "feat(api): admin stats endpoint and make-admin cli"
```

---

### Task 12: Сервер, сборка, Docker-образ

**Files:**
- Create: `apps/api/src/server.ts`, `apps/api/build.mjs`, `apps/api/Dockerfile`, `.dockerignore`

- [ ] **Step 1: `apps/api/src/server.ts`**

```ts
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './core/config';
import { createDatabase } from './core/db';
import { createLogger } from './core/logger';
import { createContainer } from './container';

const SESSION_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config.DATABASE_URL, config.DB_POOL_MAX);
const container = createContainer(config, { db: database.db, logger });
const app = createApp(container);

const server = serve({ fetch: app.fetch, port: config.PORT, hostname: '0.0.0.0' }, (info) =>
  logger.info({ port: info.port }, 'libify api listening'),
);

const purge = setInterval(() => {
  container.auth
    .purgeExpiredSessions()
    .then((n) => n > 0 && logger.info({ removed: n }, 'expired sessions purged'))
    .catch((err) => logger.warn({ err }, 'session purge failed'));
}, SESSION_PURGE_INTERVAL_MS);
purge.unref();

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  clearInterval(purge);
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  server.close(() => {
    database
      .close()
      .catch((err) => logger.error({ err }, 'db close failed'))
      .finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 2: Проверить dev-запуск**

Run (в одном терминале): `npm run dev:api`
Run (в другом): `curl -s localhost:3000/api/health`
Expected: `{"status":"ok","db":"ok"}`. Остановить Ctrl+C — в логе `shutting down`.

- [ ] **Step 3: `apps/api/build.mjs`** — бандлим всё, кроме нативного argon2

```js
import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  external: ['@node-rs/argon2', 'pino-pretty'],
  // ESM bundles of CJS deps need require():
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
};

await build({
  ...common,
  entryPoints: { server: 'src/server.ts', migrate: 'src/cli/migrate.ts', 'make-admin': 'src/cli/make-admin.ts' },
  outdir: 'dist',
});
console.log('api bundled to dist/');
```

Run: `npm run build -w @libify/api && ls apps/api/dist`
Expected: `make-admin.js migrate.js server.js` (+ `.map`).

- [ ] **Step 4: `.dockerignore`** (корень репо)

```
**/node_modules
**/dist
**/.env
.git
apps/web
docs
```

- [ ] **Step 5: `apps/api/Dockerfile`** (контекст сборки — корень репо)

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @libify/api --include-workspace-root
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @libify/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN npm install --no-save --omit=dev @node-rs/argon2@2.2.2 && npm cache clean --force
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--max-old-space-size=96", "dist/server.js"]
```

- [ ] **Step 6: Собрать образ под сервер и проверить размер**

Run: `docker buildx build --platform linux/amd64 -f apps/api/Dockerfile -t libify-api:dev --load . && docker image ls libify-api:dev`
Expected: сборка успешна, размер образа порядка 60–90 МБ.

- [ ] **Step 7: Smoke-тест образа против dev-БД**

```bash
docker run --rm --platform linux/amd64 --network host \
  -e DATABASE_URL=postgres://libify:libify@localhost:5433/libify -e APP_ORIGIN=http://localhost:5173 \
  -e PORT=3001 libify-api:dev node dist/migrate.js
docker run -d --name libify-api-smoke --platform linux/amd64 --network host --memory 160m \
  -e DATABASE_URL=postgres://libify:libify@localhost:5433/libify -e APP_ORIGIN=http://localhost:5173 \
  -e PORT=3001 libify-api:dev
sleep 3 && curl -s localhost:3001/api/health && docker stats --no-stream libify-api-smoke
docker rm -f libify-api-smoke
```

Expected: `Migrations applied from /app/drizzle`, `{"status":"ok","db":"ok"}`, MEM USAGE < 100 МБ.
Примечание: на macOS `--network host` работает в Docker Desktop ≥4.34 (включить в Settings → Resources → Network).
Если недоступно — заменить `localhost` на `host.docker.internal` и использовать `-p 3001:3001` вместо `--network host`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/server.ts apps/api/build.mjs apps/api/Dockerfile .dockerignore
git commit -m "feat(api): production server with graceful shutdown and docker image"
```

---

### Task 13: CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main, v2]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: libify
          POSTGRES_PASSWORD: libify
          POSTGRES_DB: libify_test
        ports: ["5433:5432"]
        options: >-
          --health-cmd "pg_isready -U libify" --health-interval 2s --health-timeout 3s --health-retries 20
    env:
      TEST_DATABASE_URL: postgres://libify:libify@localhost:5433/libify_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Прогнать то же локально**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: всё зелёное.
Если падает только `lint` фронта (`@libify/web`) на ошибках, которые были и до переноса: в `ci.yml` заменить
`- run: npm run lint` на `- run: npm run lint -w @libify/api`, а в сообщение коммита дописать
«web lint is enabled in plan 3». Ошибки фронта не глушить через `|| true`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck, lint, test with postgres, build"
```

---

### Task 14: README и сверка со спекой

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/specs/2026-11-18-libify-v2-design.md`

- [ ] **Step 1: `README.md`**

````markdown
# Libify

Читалка книг: FB2 / EPUB / PDF, поиск по каталогу Flibusta, синхронизация библиотеки, прогресса,
цитат и закладок между устройствами, офлайн-режим (PWA).

## Структура

| Путь | Что это |
|---|---|
| `apps/web` | SPA на React 19 + Vite + Tailwind |
| `apps/api` | API на Hono + Drizzle + Postgres |
| `packages/shared` | общие zod-схемы и типы |
| `deploy/` | конфиги деплоя |
| `docs/superpowers` | спеки и планы |

## Запуск локально

Нужны Node ≥ 22.12 и Docker.

```bash
npm install
npm run db:up
cp apps/api/.env.example apps/api/.env
npm run db:migrate -w @libify/api
npm run dev:api     # http://localhost:3000/api/health
npm run dev:web     # http://localhost:5173
```

Сделать пользователя админом: `npm run make-admin -w @libify/api -- <nickname>`.

## Проверки

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
````

- [ ] **Step 2: Сверить спеку с реализацией** — в `docs/superpowers/specs/2026-11-18-libify-v2-design.md`:
  - в разделе «Синхронизация» заменить абзац про «Обычные REST-эндпоинты (`/api/library`, `/api/quotes`…)» на:
    «Все пользовательские данные пишутся и читаются только через `/api/sync/push|pull`; отдельных REST-эндпоинтов
    для библиотеки нет (YAGNI).»
  - в разделе «Каталог» заменить список эндпоинтов на `GET /api/catalog/search?q=` (OPDS XML),
    `GET /api/catalog/book/:id/:format` (fb2|epub|mobi), `GET /api/catalog/image?src=`; убрать «метаданные 1 час».
  - в «Схеме БД» дописать колонку `synced_at` (серверное время записи, курсор pull) и что у bookmarks нет
    `unique(user_id, book_id, paragraph_index)`.
  - в «AI» заменить `POST /api/ai/explain` на `POST /api/ai/summarize` + `GET /api/ai/status`.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/specs/2026-11-18-libify-v2-design.md
git commit -m "docs: project readme and spec sync with plan 1 decisions"
```

---

## Готово, когда

- `npm run typecheck && npm run lint -w @libify/api && npm test && npm run build` зелёные локально и в CI.
- `docker buildx build --platform linux/amd64 …` собирает образ, контейнер с лимитом 160m отвечает на `/api/health`.
- Фронт (`apps/web`) собирается как раньше (он ещё на Supabase — это План 2).
