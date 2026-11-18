# План 3: структура по фичам, производительность, надёжность

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline, без субагентов). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Обновить фронт до актуальных Vite 8 / plugin-react 6 с React Compiler, разложить код по фичам
(без файлов > ~250 строк), ужать стартовый JS с ~170 КБ gzip до ≤ 120 КБ, добавить кеш серверных запросов,
обработку ошибок по маршрутам, тост обновления PWA, индикатор синхронизации и e2e-тесты на мобилке и десктопе.
Визуальный редизайн — **План 4** (здесь внешний вид не меняется, кроме замены анимаций framer-motion на CSS).
Деплой — **План 5**.

**Architecture:** `src/app` (точка входа, роутер, провайдеры, layout), `src/features/*` (auth, library, reader,
search, admin — у каждой `ui/`, `model/`, при необходимости `api/`), `src/entities/book` (типы и общие
UI-кусочки книги), `src/shared` (api, db, sync, ui-kit, i18n, lib). Локальные данные — через хуки над
`ReplicaStore` (`useSyncExternalStore`), удалённые запросы (каталог, админка) — TanStack Query с сохранением кеша.
Настройки читалки — zustand-стор с сохранением в localStorage.

**Tech Stack:** Vite 8, @vitejs/plugin-react 6 + React Compiler (Babel-пресет), React 19, React Router 7,
TanStack Query 5, zustand 5, Tailwind 4, vite-plugin-pwa, Vitest, Playwright, size-limit.

**Спека:** `docs/superpowers/specs/2026-11-18-libify-v2-design.md` (разделы 5, 7).

**Предусловие:** ветка `v2`, `npm test` зелёный, Docker запущен, `npm run db:up`.

**Правила для рефакторинга (Tasks 6–9):** поведение не меняется. Перенос кода — через `git mv`, где файл
переезжает целиком, чтобы сохранить историю. После каждой задачи: `npm run typecheck && npm test && npm run build`
и, начиная с Task 5, `npm run e2e`. Номера строк в цитатах могли сдвинуться — ориентируйся на код.

**Измерение стартового JS** (используется в нескольких задачах):

```bash
npm run build -w @libify/web && node -e "
const fs=require('fs'),z=require('zlib'),p='apps/web/dist/';
const html=fs.readFileSync(p+'index.html','utf8');
const files=[...html.matchAll(/(?:src|href)=\"\/(assets\/[^\"]+\.js)\"/g)].map(m=>m[1]);
let t=0;for(const f of files){const s=z.gzipSync(fs.readFileSync(p+f)).length;t+=s;console.log((s/1024).toFixed(1).padStart(7),'KB',f)}
console.log((t/1024).toFixed(1).padStart(7),'KB TOTAL initial JS (gzip)')"
```

Исходная точка (до плана): ~170 КБ (`index` 107 КБ из-за zod, `animation` 42 КБ framer-motion, `vendor` 18 КБ, `ui`).

---

## Целевая структура `apps/web/src`

```
app/
  main.tsx                    initServices → render
  App.tsx                     провайдеры + роутер
  router.tsx                  маршруты, lazy-страницы, ProtectedRoute, GuestRoute
  providers.tsx               QueryClientProvider (+persist), LanguageProvider, AuthProvider
  layouts/AppLayout.tsx       Sidebar (lg) / BottomNav (mobile) + <Outlet/>, ErrorBoundary маршрута
  layouts/RouteErrorBoundary.tsx
  pwa/UpdatePrompt.tsx        тост «Доступна новая версия»
features/
  auth/                       model/AuthContext.tsx, ui/AuthPage.tsx, ui/GuestRoute.tsx, ui/ProtectedRoute.tsx
  library/
    model/useLibrary.ts       книги + прогресс из реплики (useSyncExternalStore)
    model/useCollections.ts   избранное, цитаты, закладки из реплики
    model/useBookImport.ts    загрузка локального файла (бывший handleFileUpload)
    model/useLibraryExport.ts экспорт (бывший handleExportAll)
    ui/MyBooksPage.tsx        шапка + вкладки (≤ 150 строк)
    ui/MyBooksHeader.tsx, ui/LibraryTab.tsx, ui/FavoritesTab.tsx, ui/QuotesTab.tsx, ui/BookmarksTab.tsx,
    ui/BookListItem.tsx, ui/UploadButton.tsx, ui/ExportProgress.tsx
  reader/
    model/readerSettingsStore.ts   zustand (шрифт, кегль, тема, режим, яркость)
    model/useBookContent.ts        загрузка книги/PDF, главы, ошибки
    model/useReadingPosition.ts    восстановление и сохранение позиции
    model/usePagination.ts         постраничный режим + клавиатура
    model/useReaderTts.ts          обёртка над useTextToSpeech
    model/useReaderTranslation.ts
    model/useQuoteSelection.ts     выделение текста → меню цитаты, закладки
    ui/ReaderPage.tsx              композиция (≤ 200 строк)
    ui/ReaderScrollView.tsx, ui/ReaderPagedView.tsx
    ui/ (переехавшие ReaderHeader, ReaderFooter, ReaderPdfViewer, ReaderSettingsModal→ReaderSettingsSheet,
         ReaderTocDrawer, ReaderTranslateModal→ReaderTranslateSheet, ReaderTtsControls, QuoteMenu)
  search/   model/useCatalogSearch.ts, model/useRecommendations.ts, ui/SearchPage.tsx
  home/     ui/HomePage.tsx
  admin/    model/useAdminStats.ts, ui/AdminPage.tsx (на реальных данных; моки удалить)
entities/book/   ui/BookCard.tsx, ui/BookCoverFallback.tsx, ui/ImageWithLoader.tsx, lib/useBookCover.ts
shared/
  api/ db/ sync/ services.ts       (уже есть)
  catalog/flibustaApi.ts, catalog/fb2Parser.ts, catalog/bookCache.ts   (из services/ и utils/)
  storage/storage.ts, storage/collections.ts                          (бывшие utils/storage.ts, services/db.ts)
  i18n/LanguageContext.tsx, i18n/locales/*.json, i18n/languages.ts
  ui/ Sheet.tsx, Drawer.tsx, ConfirmDialog.tsx, Toast.tsx, Skeleton.tsx, ProgressBar.tsx, ErrorBoundary.tsx,
      BottomNav.tsx, Sidebar.tsx, SyncStatusBadge.tsx
  lib/ hooks (useInstallPrompt, useKeyboardHeight, useScrollRestoration, useSwipeGesture, useTextToSpeech),
       export.ts, translationService.ts
  workers/bookParser.worker.ts
```

Удаляются: `services/mockStats.ts`, `data/books.ts` (если после переноса никем не используется), `App.css` (если пуст
по смыслу), `assets/react.svg`.

---

### Task 1: Vite 8, plugin-react 6, React Compiler

**Files:** `apps/web/package.json`, `apps/web/vite.config.ts`

- [ ] **Step 1: Обновить зависимости**

```bash
npm install -w @libify/web -D vite@^8 @vitejs/plugin-react@^6 @rolldown/plugin-babel @babel/core babel-plugin-react-compiler@^1 @types/babel__core
npm uninstall -w @libify/web vite-plugin-compression2
npm ls vite --all | head -20
```

Expected: одна версия vite 8.x во всём дереве (vitest 5, vite-plugin-pwa, @tailwindcss/vite поддерживают vite 8).
Сжатие делает Caddy (`encode zstd gzip`), поэтому plugin-compression не нужен.

- [ ] **Step 2: `vite.config.ts`**
  - импорты:

```ts
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
```

  - в `plugins`: `react(), babel({ presets: [reactCompilerPreset()] }),` вместо `react(),`; удалить `compression(...)`
    и его импорт.
  - удалить весь блок `build.rollupOptions.output.manualChunks` (Rolldown сам режет чанки, ленивые импорты
    уже задают границы) и `chunkSizeWarningLimit`.

- [ ] **Step 3: Проверить, что компилятор работает**

```bash
npm run build -w @libify/web
grep -l "react/compiler-runtime\|react.memo_cache_sentinel" apps/web/dist/assets/*.js | head
```

Expected: сборка успешна, grep находит файлы (компонентный код скомпилирован). Если компилятор пропускает
компонент из-за нарушения правил React — `react({})` + `babel` логируют диагностику; нарушения будут видны
и в lint (`eslint-plugin-react-hooks` v7 содержит правила компилятора).

- [ ] **Step 4: Прогон**: `npm run typecheck && npm test && npm run build`, затем dev-сервер `npm run dev:web` открывается.

- [ ] **Step 5: Commit**

```bash
git add apps/web package-lock.json
git commit -m "build(web): vite 8, plugin-react 6 with React Compiler"
```

---

### Task 2: Убрать zod из стартового бандла

Фронт импортирует из `@libify/shared` значения (`NICKNAME_PATTERN`, `SYNC_PUSH_MAX_OPS`, `syncOpSchema`), и весь zod
попадает в `index`-чанк.

**Files:** `packages/shared/src/constants.ts` (новый), `packages/shared/src/{auth,sync,catalog,errors}.ts`,
`packages/shared/package.json`, `apps/web/src/shared/sync/SyncEngine.ts`, `apps/web/eslint.config.js`, места
импорта в `apps/web/src`

- [ ] **Step 1: `packages/shared/src/constants.ts`** — константы без zod:

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

export const NICKNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
export const PASSWORD_MIN_LENGTH = 8;

export const USER_ROLES = ['user', 'admin'] as const;
export const BOOK_STATUSES = ['reading', 'plan', 'finished', 'dropped'] as const;
export const BOOK_FORMATS = ['fb2', 'epub', 'mobi'] as const;
export const SYNC_ENTITIES = ['book', 'progress', 'quote', 'bookmark', 'favorite'] as const;
export const SYNC_PUSH_MAX_OPS = 200;
```

Если после исправлений ревью значения в shared отличаются (например, другой `SYNC_PUSH_MAX_OPS` или добавлены коды
ошибок) — перенести **текущие** значения, а не значения из этого плана.

- [ ] **Step 2:** В `errors.ts`, `auth.ts`, `sync.ts`, `catalog.ts` удалить определения перенесённых констант и
импортировать их из `./constants` (`import { NICKNAME_PATTERN, PASSWORD_MIN_LENGTH } from './constants';` и т. д.).
`passwordSchema` использует `PASSWORD_MIN_LENGTH`. В `index.ts` добавить `export * from './constants';`.

- [ ] **Step 3: `packages/shared/package.json`** — экспорт подпутей:

```json
  "exports": {
    ".": "./src/index.ts",
    "./constants": "./src/constants.ts",
    "./sync": "./src/sync.ts"
  },
```

- [ ] **Step 4: Правило ESLint для фронта** — в `apps/web/eslint.config.js` в объект с `files: ['**/*.{ts,tsx}']`
добавить:

```js
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@libify/shared',
              allowTypeImports: true,
              message: 'Runtime imports pull zod into the bundle. Use @libify/shared/constants, or import type.',
            },
          ],
        },
      ],
    },
```

- [ ] **Step 5: Исправить импорты фронта.** `npm run lint -w @libify/web` покажет все нарушения. Типы → `import type`,
константы → `@libify/shared/constants`.

- [ ] **Step 6: Ленивая валидация в `SyncEngine`.** Схема нужна только при записи — грузим её отдельным чанком.
`start()` предзагружает схему, поэтому после старта `record()` остаётся синхронным до `replica.apply`
(память реплики обновляется до первого `await`, на это опираются страницы).

Вверху `apps/web/src/shared/sync/SyncEngine.ts` вместо значимых импортов из `'@libify/shared'`:

```ts
import { SYNC_PUSH_MAX_OPS } from '@libify/shared/constants';
import type { SyncDataMap, SyncEntity } from '@libify/shared';

type OpSchema = (typeof import('@libify/shared/sync'))['syncOpSchema'];
let opSchemaLoaded: OpSchema | null = null;

/** Loads zod + the op schema on demand (separate chunk). Exported for tests. */
export async function preloadSyncSchema(): Promise<OpSchema> {
  opSchemaLoaded ??= (await import('@libify/shared/sync')).syncOpSchema;
  return opSchemaLoaded;
}
```

В `start()` первой строкой: `await preloadSyncSchema();`. В `record()` первой строкой:

```ts
    const schema = opSchemaLoaded ?? (await preloadSyncSchema());
```

и далее `schema.safeParse(...)` вместо `syncOpSchema.safeParse(...)`; остальной код `record()` без изменений.
Если тест SyncEngine вызывает `record()` до `start()` и проверяет синхронное обновление памяти — добавить в
`beforeAll` теста `await preloadSyncSchema()`.

- [ ] **Step 7: Проверка размера.** Выполнить скрипт «Измерение стартового JS» из шапки.
Expected: в начальных чанках нет zod (`grep -c ZodError` по ним → 0), TOTAL уменьшился на ~70–90 КБ.

```bash
for f in $(grep -o 'assets/[^"]*\.js' apps/web/dist/index.html); do printf "%s %s\n" "$(grep -c ZodError apps/web/dist/$f)" $f; done
```

- [ ] **Step 8:** `npm run typecheck && npm test && npm run build && npm run lint -w @libify/api` → commit

```bash
git add packages/shared apps/web
git commit -m "perf(web): keep zod out of the initial bundle via constants subpath and lazy sync schema"
```

---

### Task 3: Убрать framer-motion — CSS-переходы и общий `Sheet`

framer-motion (42 КБ gzip в стартовом бандле) используется в 9 файлах: `App.tsx`, `components/QuoteMenu.tsx`,
`components/BottomNav.tsx`, `pages/MyBooks.tsx`, `pages/Reader/{ReaderTranslateModal,ReaderTocDrawer,
ReaderSettingsModal,ReaderTtsControls}.tsx`, `pages/Admin/Admin.tsx`.

**Files:** `apps/web/src/shared/ui/{Sheet,Presence}.tsx`, тест `Presence.test.ts` не нужен (UI), `apps/web/src/index.css`,
перечисленные файлы

- [ ] **Step 1: `apps/web/src/shared/ui/usePresence.ts`** — монтирование с анимацией выхода без библиотек:

```ts
import { useEffect, useState } from 'react';

/**
 * Keeps an element mounted while its exit transition plays.
 * `visible` toggles the CSS state one frame after mount so the enter transition runs.
 */
export function usePresence(open: boolean, exitMs = 220): { mounted: boolean; visible: boolean } {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const mount = requestAnimationFrame(() => {
        setMounted(true);
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(mount);
    }
    const hide = requestAnimationFrame(() => setVisible(false));
    const unmount = setTimeout(() => setMounted(false), exitMs);
    return () => {
      cancelAnimationFrame(hide);
      clearTimeout(unmount);
    };
  }, [open, exitMs]);

  return { mounted: mounted || open, visible };
}
```

(Все `setState` внутри rAF/таймеров — правило `set-state-in-effect` не срабатывает.)

- [ ] **Step 2: `apps/web/src/shared/ui/Sheet.tsx`** — нижняя шторка (мобилка) / центрированная панель (≥ sm):

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { usePresence } from './usePresence';

interface SheetProps {
  open: boolean;
  onClose(): void;
  title?: string;
  children: ReactNode;
  /** Extra classes for the panel. */
  className?: string;
}

export function Sheet({ open, onClose, title, children, className = '' }: SheetProps) {
  const { mounted, visible } = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:w-[min(92vw,480px)]
          max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#1C1C1E] border border-white/10 shadow-2xl
          pb-[env(safe-area-inset-bottom)] outline-none
          transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none
          ${visible ? 'translate-y-0 sm:-translate-x-1/2 sm:-translate-y-1/2 opacity-100' : 'translate-y-full sm:-translate-x-1/2 sm:-translate-y-[45%] opacity-0'}
          ${className}`}
      >
        {title && (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Миграция файлов.** Для каждого файла из списка:
  - **Модалки/шторки** (`ReaderSettingsModal`, `ReaderTranslateModal`, `ReaderTocDrawer`, подтверждения и
    экспорт в `MyBooks`): заменить пару `AnimatePresence` + `motion.div` (фон + панель) на
    `<Sheet open={...} onClose={...} title={...}>…содержимое панели…</Sheet>`. Содержимое и классы внутренней
    разметки сохранить. Для `ReaderTocDrawer` (выезжает сбоку) — тот же подход, но панель
    `inset-y-0 left-0 w-[min(85vw,360px)]` с `translate-x` вместо `translate-y`: сделать `Drawer.tsx` копией
    `Sheet` с этими классами (одна ответственность — боковая панель).
  - **Появляющиеся элементы** (`BottomNav` при скрытии на скролле, `ReaderTtsControls`, `QuoteMenu`, тосты):
    `const { mounted, visible } = usePresence(show)`; `if (!mounted) return null;` и классы
    `transition-[opacity,transform] duration-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`.
  - **`App.tsx` переходы страниц**: удалить `AnimatePresence`/`motion.div` в `PageWrapper`; вместо них у корневого
    `div` класс `animate-page-in` (см. Step 4). `key={location.pathname}` у `<Routes>` убрать — он заставлял
    перемонтировать все страницы.
  - **`MyBooks` `BookListItem` (свайп для удаления, `PanInfo`)**: заменить `drag` на существующий
    `hooks/useSwipeGesture.ts` (прочитать его API) или на pointer-события: `onPointerDown/Move/Up` двигают
    `transform: translateX(...)` через `style`, порог −80px открывает кнопку удаления, отпускание без порога
    возвращает на место с `transition-transform`. Кнопка удаления остаётся доступной с клавиатуры (видна при фокусе).
  - **`Admin.tsx`**: убрать `motion.*` (заменить на обычные `div` с теми же классами); админка переписывается в Task 9.

- [ ] **Step 4: `apps/web/src/index.css`** — добавить в конец:

```css
@keyframes page-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@utility animate-page-in {
  animation: page-in 150ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
```

- [ ] **Step 5: Удалить зависимость и проверить**

```bash
npm uninstall -w @libify/web framer-motion
grep -rn "framer-motion" apps/web/src && echo "STILL USED" || echo "clean"
npm run typecheck && npm run build -w @libify/web
```

Затем «Измерение стартового JS». Expected: чанка `animation` нет; TOTAL ≤ 120 КБ.

- [ ] **Step 6: Ручная проверка** (dev): открыть/закрыть настройки читалки, оглавление, перевод, TTS, меню цитаты,
подтверждение удаления, свайп книги в «Моих книгах» на viewport 390×844. Escape закрывает шторки, фокус
возвращается на кнопку, которая их открыла.

- [ ] **Step 7: Commit**

```bash
git add apps/web package-lock.json
git commit -m "perf(web): replace framer-motion with CSS transitions and an accessible Sheet"
```

---

### Task 4: Чистый lint и строгий TypeScript фронта

**Files:** 5 мест с `set-state-in-effect` (найти `npm run lint -w @libify/web`), `apps/web/tsconfig.app.json`,
`.github/workflows/ci.yml`

- [ ] **Step 1:** Для каждой ошибки `Calling setState synchronously within an effect` выбрать правильный приём:
  - состояние, вычисляемое из пропсов/других состояний → убрать `useState` + `useEffect`, считать в рендере
    (с React Compiler мемоизация автоматическая);
  - сброс состояния при смене id → `key={id}` на компоненте, а не эффект;
  - подписка на внешний источник (localStorage, `storage-update`, реплика) → `useSyncExternalStore`
    (для реплики уже есть `useReplicaVersion`);
  - начальная загрузка данных → оставить эффект, но `setState` только в `.then`/после `await`, начальное значение
    задать в `useState(() => …)`.

  Не глушить правило комментариями `eslint-disable`.

- [ ] **Step 2: `tsconfig.app.json`** — добавить `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`.
Исправить появившиеся ошибки typecheck честно (проверки на `undefined`, `?.`, ранние return), без `!` там, где
значение действительно может отсутствовать.

- [ ] **Step 3: CI** — в `.github/workflows/ci.yml` вернуть общий `- run: npm run lint` (если в Плане 1 его
заменили на `-w @libify/api`).

- [ ] **Step 4:** `npm run typecheck && npm run lint && npm test && npm run build` → всё зелёное → commit

```bash
git add apps/web .github
git commit -m "chore(web): zero lint errors, noUncheckedIndexedAccess, lint web in CI"
```

---

### Task 5: Playwright e2e — страховка перед рефакторингом

E2E идут против настоящих dev-серверов (API + Postgres + Vite). Каталог Flibusta в тестах подменяется через
`page.route`, чтобы тесты не зависели от внешней сети.

**Files:** `apps/web/playwright.config.ts`, `apps/web/e2e/fixtures/{sample.fb2,opds-search.xml}`,
`apps/web/e2e/{auth,library,reader}.spec.ts`, `apps/web/e2e/helpers.ts`, `apps/web/package.json`

- [ ] **Step 1: Установка**

```bash
npm install -w @libify/web -D @playwright/test@^1.65
npx -w @libify/web playwright install chromium webkit
```

В `apps/web/package.json` → `"e2e": "playwright test"`. В корневой `package.json` → `"e2e": "npm run e2e -w @libify/web"`.
Добавить в `.gitignore` (уже есть `test-results/`, `playwright-report/`).

- [ ] **Step 2: `apps/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 15'], browserName: 'webkit' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: 'npm run dev -w @libify/api',
      cwd: '../..',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w @libify/web',
      cwd: '../..',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
```

Если `devices['iPhone 15']` нет в установленной версии — взять ближайший iPhone из
`node -e "console.log(Object.keys(require('@playwright/test').devices).filter(d=>d.startsWith('iPhone')))"`.

- [ ] **Step 3: Фикстуры.**
  - `e2e/fixtures/sample.fb2` — минимальная валидная FB2 (UTF-8):

```xml
<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <author><first-name>Test</first-name><last-name>Author</last-name></author>
      <book-title>E2E Sample Book</book-title>
      <lang>en</lang>
    </title-info>
  </description>
  <body>
    <section><title><p>Chapter One</p></title><p>First paragraph of the sample book.</p><p>Second paragraph with a quotable sentence.</p></section>
    <section><title><p>Chapter Two</p></title><p>Third paragraph.</p><p>Fourth paragraph.</p></section>
  </body>
</FictionBook>
```

  - `e2e/fixtures/opds-search.xml` — OPDS-ответ с одной книгой (id 777):

```xml
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Mocked Catalog Book</title>
    <author><name>Mock Author</name></author>
    <id>tag:book:777</id>
    <link href="/b/777/fb2" type="application/fb2+zip"/>
  </entry>
</feed>
```

- [ ] **Step 4: `e2e/helpers.ts`**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);

export function uniqueNickname(prefix = 'e2e'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 24);
}

export async function register(page: Page, nickname: string, password = 'password123'): Promise<void> {
  await page.goto('/auth');
  await page.getByRole('tab', { name: /sign up|реєстрац/i }).click();
  await page.getByLabel(/username|ім'я/i).fill(nickname);
  await page.getByLabel(/password|пароль/i).fill(password);
  await page.getByRole('button', { name: /create account|створити/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'));
}

/** Serves the catalog from fixtures so tests never touch Flibusta. */
export async function mockCatalog(page: Page): Promise<void> {
  const opds = readFileSync(fixture('opds-search.xml'), 'utf8');
  const fb2 = readFileSync(fixture('sample.fb2'));
  await page.route('**/api/catalog/search**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/atom+xml', body: opds }),
  );
  await page.route('**/api/catalog/book/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/octet-stream', body: fb2 }),
  );
}
```

Тексты кнопок/лейблов сверить с `en.json`/`uk.json`; язык по умолчанию определяет `LanguageContext` — если тесты
нестабильны из-за языка, перед `goto` выставить язык через `page.addInitScript(() => localStorage.setItem(<ключ языка>, 'en'))`
(ключ найти в `LanguageContext`).

- [ ] **Step 5: `e2e/auth.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { register, uniqueNickname } from './helpers';

test('register, reload stays logged in, logout, login again', async ({ page }) => {
  const nick = uniqueNickname();
  await register(page, nick);
  await page.reload();
  await expect(page).not.toHaveURL(/\/auth/);

  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'libify_sid')?.httpOnly).toBe(true);

  await page.context().clearCookies();
  await page.goto('/');
  await page.getByLabel(/username|ім'я/i).fill(nick.toUpperCase());
  await page.getByLabel(/password|пароль/i).fill('password123');
  await page.getByRole('button', { name: /^log in$|^увійти$/i }).click();
  await expect(page).not.toHaveURL(/\/auth/);
});

test('shows a readable error for a taken nickname', async ({ page }) => {
  const nick = uniqueNickname();
  await register(page, nick);
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/auth');
  await page.getByRole('tab', { name: /sign up|реєстрац/i }).click();
  await page.getByLabel(/username|ім'я/i).fill(nick);
  await page.getByLabel(/password|пароль/i).fill('password123');
  await page.getByRole('button', { name: /create account|створити/i }).click();
  await expect(page.getByRole('alert')).toContainText(/taken|зайнят/i);
});
```

- [ ] **Step 6: `e2e/library.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { fixture, mockCatalog, register, uniqueNickname } from './helpers';

test('upload a local FB2, read it, progress and quote survive reload', async ({ page }) => {
  await register(page, uniqueNickname());
  await page.goto('/my-books');
  await page.locator('input[type=file]').setInputFiles(fixture('sample.fb2'));
  await expect(page.getByText('E2E Sample Book')).toBeVisible();

  await page.getByText('E2E Sample Book').click();
  await expect(page.getByText('First paragraph of the sample book.')).toBeVisible();

  await page.reload();
  await page.goto('/my-books');
  await expect(page.getByText('E2E Sample Book')).toBeVisible();
});

test('search the (mocked) catalog and open a book', async ({ page }) => {
  await mockCatalog(page);
  await register(page, uniqueNickname());
  await page.goto('/search');
  await page.getByRole('searchbox').or(page.getByRole('textbox')).first().fill('mock');
  await expect(page.getByText('Mocked Catalog Book')).toBeVisible();
  await page.getByText('Mocked Catalog Book').click();
  await expect(page.getByText('First paragraph of the sample book.')).toBeVisible();
});
```

Мок отдаёт сырой FB2, а не zip: проверить, что `parseBookData` принимает несжатый FB2 (так загружаются
локальные файлы). Если нет — запаковать фикстуру в zip через `jszip` в `helpers.ts`.

- [ ] **Step 7: `e2e/reader.spec.ts`** — офлайн-цитата:

```ts
import { expect, test } from '@playwright/test';
import { fixture, register, uniqueNickname } from './helpers';

test('a quote saved offline is synced when back online', async ({ page, context }) => {
  await register(page, uniqueNickname());
  await page.goto('/my-books');
  await page.locator('input[type=file]').setInputFiles(fixture('sample.fb2'));
  await page.getByText('E2E Sample Book').click();
  const paragraph = page.getByText('Second paragraph with a quotable sentence.');
  await expect(paragraph).toBeVisible();

  await context.setOffline(true);
  await paragraph.selectText();
  await page.dispatchEvent('body', 'mouseup');
  await page.getByRole('button', { name: /save quote|зберегти/i }).click();

  const pushed = page.waitForRequest((r) => r.url().includes('/api/sync/push') && r.method() === 'POST');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await pushed;
});
```

Тексты кнопки цитаты сверить с `QuoteMenu` и локалями.

- [ ] **Step 8: Прогон**: `npm run e2e` → все тесты в двух проектах зелёные. Если сценарий не проходит из-за
реальной ошибки приложения — это баг: починить в приложении, не в тесте, и упомянуть в коммите.

- [ ] **Step 9: Commit**

```bash
git add apps/web package.json package-lock.json
git commit -m "test(web): playwright e2e for auth, library, reader on mobile and desktop"
```

---

### Task 6: Каркас `app/`, `shared/` и переезд общих модулей

Механический перенос без изменения логики. Импорты обновлять поиском (`grep -rn "from '.*<старый путь>'"`).

- [ ] **Step 1: Переезд файлов** (`git mv`):

| Было | Стало |
|---|---|
| `main.tsx` | `app/main.tsx` (обновить `index.html`: `src="/src/app/main.tsx"`) |
| `App.tsx` | `app/App.tsx` |
| `contexts/LanguageContext.tsx` | `shared/i18n/LanguageContext.tsx` |
| `locales/*.json` | `shared/i18n/locales/*.json` |
| `constants/languages.ts` | `shared/i18n/languages.ts` |
| `contexts/AuthContext.tsx` | `features/auth/model/AuthContext.tsx` |
| `pages/Auth.tsx` | `features/auth/ui/AuthPage.tsx` (экспорт `AuthPage`) |
| `services/flibustaApi.ts` | `shared/catalog/flibustaApi.ts` |
| `utils/fb2Parser.ts` | `shared/catalog/fb2Parser.ts` |
| `utils/cache.ts` | `shared/catalog/bookCache.ts` |
| `utils/storage.ts` | `shared/storage/storage.ts` |
| `services/db.ts` | `shared/storage/collections.ts` |
| `utils/export.ts` | `shared/lib/export.ts` |
| `services/translationService.ts` | `shared/lib/translationService.ts` |
| `hooks/*.ts` | `shared/lib/hooks/*.ts` (кроме `useBookCover.ts` → `entities/book/lib/useBookCover.ts`) |
| `workers/bookParser.worker.ts` | `shared/workers/bookParser.worker.ts` |
| `components/{ErrorBoundary,Skeleton,ProgressBar,BottomNav,Sidebar}.tsx` | `shared/ui/` |
| `components/{BookCard,BookCoverFallback,ImageWithLoader}.tsx` | `entities/book/ui/` |
| `components/QuoteMenu.tsx` | `features/reader/ui/QuoteMenu.tsx` |
| `pages/Reader/*.tsx` | `features/reader/ui/*.tsx` |
| `pages/Reader.tsx` | `features/reader/ui/ReaderPage.tsx` (экспорт `ReaderPage`) |
| `pages/MyBooks.tsx` | `features/library/ui/MyBooksPage.tsx` (экспорт `MyBooksPage`) |
| `pages/Search.tsx` | `features/search/ui/SearchPage.tsx` |
| `pages/Home.tsx` | `features/home/ui/HomePage.tsx` |
| `pages/Admin/Admin.tsx` | `features/admin/ui/AdminPage.tsx` |
| `types/index.ts` | `entities/book/model/types.ts` (+ `shared/types.ts` для не-книжных типов, если есть) |

Worker подключается через `new URL('./bookParser.worker.ts', import.meta.url)` — после переезда путь должен
указывать на новое место (проверить `grep -rn "bookParser.worker" apps/web/src`).

- [ ] **Step 2: Удалить мёртвый код**: `services/mockStats.ts`, `assets/react.svg`, `App.css` (если стили не
используются — проверить `grep -rn "App.css"`), `data/books.ts` (если не импортируется). Пустые каталоги удалить.

- [ ] **Step 3: Алиас `@/`.** В `vite.config.ts` `resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }`
(импорт `fileURLToPath` из `node:url`), в `tsconfig.app.json` `"paths": { "@/*": ["./src/*"] }`, в
`vitest.config.ts` тот же alias. Межслойные импорты переписать на `@/shared/...`, `@/features/...`,
`@/entities/...`; относительные импорты оставить только внутри одной фичи.

- [ ] **Step 4: Правило слоёв** — в `apps/web/eslint.config.js` добавить в `@typescript-eslint/no-restricted-imports`
`patterns`:

```js
          patterns: [
            { group: ['@/features/*/*'], message: 'Import a feature only via its public entry (index.ts) or keep it inside the feature.' },
          ],
```

и в каждой фиче `index.ts`, реэкспортирующий то, что нужно снаружи (страницы для роутера, `useAuth`).
`shared/` и `entities/` не импортируют из `features/` — проверка: `grep -rn "@/features" apps/web/src/shared apps/web/src/entities` пусто.

- [ ] **Step 5:** `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e` → commit

```bash
git add -A apps/web
git commit -m "refactor(web): feature-sliced layout (app, features, entities, shared)"
```

---

### Task 7: Роутер, провайдеры, ошибки маршрутов, TanStack Query, PWA-обновление

**Files:** `app/{App,router,providers}.tsx`, `app/layouts/{AppLayout,RouteErrorBoundary}.tsx`, `app/pwa/UpdatePrompt.tsx`,
`shared/ui/SyncStatusBadge.tsx`, `shared/lib/lazyWithReload.ts` + тест, `vite.config.ts`

- [ ] **Step 1: Зависимости**

```bash
npm install -w @libify/web @tanstack/react-query@^5 @tanstack/react-query-persist-client@^5 @tanstack/query-sync-storage-persister@^5 zustand@^5
```

- [ ] **Step 2: Тест `shared/lib/lazyWithReload.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { loadWithReload } from './lazyWithReload';

const storage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe('loadWithReload', () => {
  it('returns the module and clears the guard on success', async () => {
    const s = storage();
    s.setItem('libify.chunk-reload', '1');
    const mod = await loadWithReload(async () => ({ default: 1 }), s, vi.fn());
    expect(mod).toEqual({ default: 1 });
    expect(s.getItem('libify.chunk-reload')).toBeNull();
  });
  it('reloads once on a failed chunk, then rethrows', async () => {
    const s = storage();
    const reload = vi.fn();
    const failing = async () => {
      throw new TypeError('Failed to fetch dynamically imported module');
    };
    void loadWithReload(failing, s, reload);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    await expect(loadWithReload(failing, s, reload)).rejects.toThrow();
    expect(reload).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: `shared/lib/lazyWithReload.ts`** — заменяет `lazyWithRetry` из `App.tsx`:

```ts
import { lazy, type ComponentType } from 'react';

const GUARD_KEY = 'libify.chunk-reload';
type GuardStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * A failed dynamic import after a deploy means our HTML references chunks that no longer exist.
 * Reload once to fetch the new HTML; a guard prevents reload loops.
 */
export async function loadWithReload<T>(
  importFn: () => Promise<T>,
  storage: GuardStorage = sessionStorage,
  reload: () => void = () => window.location.reload(),
): Promise<T> {
  try {
    const mod = await importFn();
    storage.removeItem(GUARD_KEY);
    return mod;
  } catch (err) {
    if (storage.getItem(GUARD_KEY)) throw err;
    storage.setItem(GUARD_KEY, '1');
    reload();
    return new Promise<T>(() => {}); // the page is going away
  }
}

export function lazyWithReload<P extends object>(importFn: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(() => loadWithReload(importFn));
}
```

- [ ] **Step 4: `app/providers.tsx`**

```tsx
import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/features/auth';
import { LanguageProvider } from '@/shared/i18n/LanguageContext';
import { ApiError } from '@/shared/api/ApiError';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      // ApiClient already retries network/5xx for GET; do not multiply attempts.
      retry: (count, err) => count < 1 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
    },
  },
});

const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'libify.query-cache' });

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        // Only catalog results are worth persisting; admin stats must be fresh.
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.queryKey[0] === 'catalog' && q.state.status === 'success' },
      }}
    >
      <LanguageProvider>
        <AuthProvider>{children}</AuthProvider>
      </LanguageProvider>
    </PersistQueryClientProvider>
  );
}
```

При выходе (`signOut` в AuthContext) вызывать `queryClient.clear()` — экспортировать `queryClient` из отдельного
модуля `app/queryClient.ts`, чтобы AuthContext не импортировал `app/` (вместо этого AuthProvider принимает
`onSignOut?: () => void` проп, а `providers.tsx` передаёт `() => queryClient.clear()`).

- [ ] **Step 5: `app/layouts/RouteErrorBoundary.tsx`** — переиспользовать `shared/ui/ErrorBoundary.tsx` (прочитать его
API). Если у него нет `resetKeys`/кнопки «Повторить» — добавить: проп `onRetry`, кнопка вызывает
`onRetry ?? (() => window.location.reload())`. Обернуть каждый маршрут:
`<RouteErrorBoundary key={location.pathname}>…страница…</RouteErrorBoundary>` в `AppLayout`, чтобы ошибка одной
страницы не роняла навигацию, а переход на другую страницу сбрасывал ошибку.

- [ ] **Step 6: `app/router.tsx`** — маршруты из старого `App.tsx` на `createBrowserRouter` не переводить (YAGNI);
оставить `<BrowserRouter>` + `<Routes>`, вынести сюда: lazy-страницы через `lazyWithReload`, `ProtectedRoute`,
`GuestRoute` (редирект залогиненного с `/auth`), `AppLayout` как layout-route с `<Outlet/>` для `/`, `/search`,
`/my-books`, `/admin`; `/reader/:id` и `/auth` — без layout. `App.tsx` = `<AppProviders><BrowserRouter><AppRoutes/>
<UpdatePrompt/></BrowserRouter></AppProviders>`.

- [ ] **Step 7: PWA-обновление.** `vite.config.ts`: `VitePWA({ registerType: 'prompt', …, workbox: { …без skipWaiting/clientsClaim… } })`.
Удалить из `main.tsx` обработчик `controllerchange` с перезагрузкой. `app/pwa/UpdatePrompt.tsx`:

```tsx
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLanguage } from '@/shared/i18n/LanguageContext';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function UpdatePrompt() {
  const { t } = useLanguage();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] lg:bottom-6 lg:left-auto lg:right-6 lg:w-96 z-50 rounded-2xl bg-[#1C1C1E] border border-white/10 p-4 shadow-2xl flex items-center gap-3">
      <p className="flex-1 text-sm text-white">{t('pwa.updateAvailable')}</p>
      <button type="button" className="text-sm text-neutral-400 px-2 py-1" onClick={() => setNeedRefresh(false)}>
        {t('pwa.later')}
      </button>
      <button type="button" className="text-sm font-semibold bg-white text-black rounded-lg px-3 py-1.5" onClick={() => void updateServiceWorker(true)}>
        {t('pwa.reload')}
      </button>
    </div>
  );
}
```

В `tsconfig.app.json` → `"types": ["vite/client", "vite-plugin-pwa/react"]`. Локали: `pwa.updateAvailable`
(«New version available» / «Доступна нова версія»), `pwa.later` («Later» / «Пізніше»), `pwa.reload`
(«Update» / «Оновити»).

- [ ] **Step 8: `shared/ui/SyncStatusBadge.tsx`** — маленький индикатор для Sidebar/шапок:

```tsx
import { useSyncExternalStore } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { services } from '@/shared/services';
import { useLanguage } from '@/shared/i18n/LanguageContext';

export function SyncStatusBadge() {
  const { t } = useLanguage();
  const { sync } = services();
  const status = useSyncExternalStore((cb) => sync.onStatusChange(cb), () => sync.getStatus());
  if (status === 'idle') return null;
  const offline = status === 'offline' || status === 'error';
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
      {offline ? <CloudOff size={14} aria-hidden="true" /> : <RefreshCw size={14} className="animate-spin" aria-hidden="true" />}
      {offline ? t('sync.offline') : t('sync.syncing')}
    </span>
  );
}
```

Если сигнатура `onStatusChange` после исправлений ревью другая — подстроиться (нужна функция подписки, возвращающая
отписку). Локали `sync.offline` («Offline — changes will sync later» / «Офлайн — зміни синхронізуються пізніше»),
`sync.syncing` («Syncing…» / «Синхронізація…»). Показать в `Sidebar` под логотипом и в шапке `MyBooks` на мобилке.

- [ ] **Step 9:** `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e` → commit

```bash
git add apps/web package-lock.json
git commit -m "feat(web): router/providers split, per-route error boundaries, query cache, PWA update prompt, sync badge"
```

---

### Task 8: Модель данных фич — хуки над репликой и TanStack Query

**Files:** `features/library/model/{useLibrary,useCollections}.ts`, `features/search/model/{useCatalogSearch,useRecommendations}.ts`,
`features/admin/model/useAdminStats.ts`, `features/reader/model/readerSettingsStore.ts` + тесты

- [ ] **Step 1: `features/library/model/useLibrary.ts`**

```ts
import { useMemo } from 'react';
import { getAppState } from '@/shared/storage/storage';
import { useReplicaVersion } from '@/shared/sync/useReplicaVersion';
import type { Book, ReadingProgress } from '@/entities/book/model/types';

export interface LibraryItem {
  book: Book;
  progress: ReadingProgress | null;
}

/** Books in the user's library with progress; re-renders when the replica changes. */
export function useLibrary(): LibraryItem[] {
  const version = useReplicaVersion();
  return useMemo(() => {
    void version;
    const state = getAppState();
    return state.myBooks.flatMap((id) => {
      const book = state.bookMetadata[id];
      return book ? [{ book, progress: state.readingProgress[id] ?? null }] : [];
    });
  }, [version]);
}

/** Books started but not finished, most recent first. */
export function useContinueReading(limit = 5): LibraryItem[] {
  const items = useLibrary();
  return useMemo(
    () =>
      items
        .filter((i) => i.progress && i.progress.currentPage < i.progress.totalPages - 1)
        .sort((a, b) => (b.progress?.lastRead ?? 0) - (a.progress?.lastRead ?? 0))
        .slice(0, limit),
    [items, limit],
  );
}
```

(Если `getAppState()` после правок ревью называется иначе или локальные метаданные хранятся по-другому — адаптировать,
сохранив контракт хука.)

- [ ] **Step 2: `features/library/model/useCollections.ts`**

```ts
import { useEffect, useState } from 'react';
import { getBookmarks, getFavorites, getQuotes } from '@/shared/storage/collections';
import { useReplicaVersion } from '@/shared/sync/useReplicaVersion';
import type { Bookmark, Favorite, Quote } from '@/entities/book/model/types';

export interface Collections {
  favorites: Favorite[];
  quotes: Quote[];
  bookmarks: Bookmark[];
}

const EMPTY: Collections = { favorites: [], quotes: [], bookmarks: [] };

export function useCollections(): Collections {
  const version = useReplicaVersion();
  const [data, setData] = useState<Collections>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getFavorites(), getQuotes(), getBookmarks()]).then(([favorites, quotes, bookmarks]) => {
      if (!cancelled) setData({ favorites, quotes, bookmarks });
    });
    return () => {
      cancelled = true;
    };
  }, [version]);
  return data;
}
```

- [ ] **Step 3: `features/search/model/useCatalogSearch.ts`**

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchBooks } from '@/shared/catalog/flibustaApi';

export function useCatalogSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['catalog', 'search', q.toLowerCase()],
    queryFn: () => fetchBooks(q),
    enabled: q.length >= 2,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
```

Важно: `fetchBooks` сейчас глотает ошибки и возвращает `[]` — тогда Query не видит ошибку и кеширует пустоту.
Изменить `fetchBooks`: пробрасывать ошибку (убрать `catch → return []`), а UI показывает состояние ошибки
(`isError`) с кнопкой «Повторить» (`refetch`).

- [ ] **Step 4: `features/search/model/useRecommendations.ts`** — Home сейчас при каждом открытии ищет «Толстой»
(холодный поиск у Flibusta ~35 с):

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchBooks } from '@/shared/catalog/flibustaApi';

const RECOMMENDATION_QUERY = 'Толстой';

/** Persisted for a day, so Home renders instantly after the first visit. */
export function useRecommendations() {
  return useQuery({
    queryKey: ['catalog', 'recommendations', RECOMMENDATION_QUERY],
    queryFn: () => fetchBooks(RECOMMENDATION_QUERY),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
```

- [ ] **Step 5: `features/admin/model/useAdminStats.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { services } from '@/shared/services';

export function useAdminStats(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => services().admin.stats(),
    enabled,
    refetchInterval: 30_000,
  });
}
```

- [ ] **Step 6: Тест `features/reader/model/readerSettingsStore.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createReaderSettingsStore } from './readerSettingsStore';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe('readerSettingsStore', () => {
  let storage: ReturnType<typeof memory>;
  beforeEach(() => {
    storage = memory();
  });

  it('clamps font size and persists', () => {
    const store = createReaderSettingsStore(storage);
    store.getState().changeFontSize(100);
    expect(store.getState().fontSize).toBe(32);
    store.getState().changeFontSize(-100);
    expect(store.getState().fontSize).toBe(12);
    expect(JSON.parse(storage.getItem('libify.reader-settings')!).state.fontSize).toBe(12);
  });

  it('restores persisted settings', () => {
    createReaderSettingsStore(storage).getState().setTheme('sepia');
    expect(createReaderSettingsStore(storage).getState().theme).toBe('sepia');
  });
});
```

- [ ] **Step 7: `features/reader/model/readerSettingsStore.ts`**

```ts
import { createStore, useStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { UserSettings } from '@/entities/book/model/types';

type Theme = NonNullable<UserSettings['theme']>;
type FontFamily = NonNullable<UserSettings['fontFamily']>;
type ReaderMode = NonNullable<UserSettings['readerMode']>;

export interface ReaderSettingsState {
  fontSize: number;
  brightness: number;
  theme: Theme;
  fontFamily: FontFamily;
  readerMode: ReaderMode;
  changeFontSize(delta: number): void;
  setBrightness(value: number): void;
  setTheme(theme: Theme): void;
  setFontFamily(fontFamily: FontFamily): void;
  setReaderMode(mode: ReaderMode): void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function createReaderSettingsStore(storage: StateStorage = localStorage) {
  return createStore<ReaderSettingsState>()(
    persist(
      (set) => ({
        fontSize: 18,
        brightness: 100,
        theme: 'dark',
        fontFamily: 'serif',
        readerMode: 'scroll',
        changeFontSize: (delta) => set((s) => ({ fontSize: clamp(s.fontSize + delta, 12, 32) })),
        setBrightness: (value) => set({ brightness: clamp(value, 30, 100) }),
        setTheme: (theme) => set({ theme }),
        setFontFamily: (fontFamily) => set({ fontFamily }),
        setReaderMode: (readerMode) => set({ readerMode }),
      }),
      {
        name: 'libify.reader-settings',
        storage: createJSONStorage(() => storage),
        partialize: ({ fontSize, brightness, theme, fontFamily, readerMode }) => ({ fontSize, brightness, theme, fontFamily, readerMode }),
      },
    ),
  );
}

export const readerSettingsStore = createReaderSettingsStore();

/** Select only what a component needs, so unrelated setting changes do not re-render it. */
export function useReaderSettings<T>(selector: (s: ReaderSettingsState) => T): T {
  return useStore(readerSettingsStore, selector);
}
```

Миграция: при первом создании, если `libify.reader-settings` отсутствует, взять значения из `getSettings()`
(старые настройки в `book-library-state`) — сделать это в `readerSettingsStore` через `persist`'s `onRehydrateStorage`
или явной функцией `migrateLegacySettings()` в `app/main.tsx` до рендера. Значения по умолчанию сверить с
текущим `defaultSettings` в `storage.ts` и `ReaderSettingsModal` (мин./макс. кегля, яркости).

- [ ] **Step 8:** `npm test -w @libify/web` → PASS → commit

```bash
git add apps/web
git commit -m "feat(web): feature models — replica hooks, catalog/admin queries, reader settings store"
```

---

### Task 9: Разбор монолитов на компоненты и хуки

Цель: каждый файл ≤ ~250 строк, у каждого одна ответственность. Поведение и разметка не меняются (кроме
подключения хуков из Task 8). После каждого подпункта — `npm run typecheck && npm run e2e`.

- [ ] **Step 1: Reader (`features/reader/ui/ReaderPage.tsx`, ~700 строк).** Вынести по группам состояния:
  - `model/useBookContent.ts(id)` — `book, fullText, pdfData, chapters, loading, error` и эффект загрузки
    (бывший `useEffect` с `fetchBookContent`/кешем, `abortControllerRef`). Возвращает
    `{ book, paragraphs, pdfData, chapters, loading, error }` (`paragraphs` = `useMemo(split('\n\n'))`).
  - `model/useReadingPosition.ts({ bookId, paragraphs, virtuosoRef, searchParams })` — начальная позиция
    (закладка `?p=` / сохранённый прогресс), `handleRangeChanged`, отложенное сохранение (`scrollTimeoutRef`,
    `pendingProgressRef`, сохранение при `pagehide`), `scrollProgress`, `visibleRange`.
  - `model/usePagination.ts({ paragraphs, bookId, enabled })` — `currentPageIndex`, `totalFlipPages`,
    `currentPageParagraphs`, `goToNextPage/goToPrevPage`, обработчик клавиатуры (←/→/PageUp/PageDown/пробел).
  - `model/useReaderTts.ts({ paragraphs, onParagraph })` — `ttsActiveParagraph`, `ttsRate`, `showTtsControls`,
    `speakParagraph`, play/next/prev (поверх `useTextToSpeech`).
  - `model/useReaderTranslation.ts(paragraphs)` — `translatedParagraphs`, `isTranslating`, `translationLang`,
    `translationProgress`, `translate(lang)`, `reset()`.
  - `model/useQuoteSelection.ts({ book, paragraphs, visibleRange, onToast })` — выделение текста, позиция меню,
    `saveQuote`, `addBookmark`, подписки `mouseup/touchend`.
  - Настройки (`settings`, `updateFontSize/Brightness/Theme/FontFamily/ReaderMode`) → `useReaderSettings` из
    стора; `ReaderSettingsSheet` читает и пишет стор напрямую, без прокидывания 8 колбэков.
  - `ui/ReaderScrollView.tsx` (Virtuoso + `renderScrollItem`) и `ui/ReaderPagedView.tsx` (страничный режим +
    кнопки навигации).
  - `ReaderPage.tsx` только собирает: хуки + `ReaderHeader`, view по режиму, `ReaderFooter`, шторки, `QuoteMenu`, тост.
  - Тосты: вынести `shared/ui/Toast.tsx` + `useToast()` (state + таймер), использовать в Reader и BookCard.

- [ ] **Step 2: MyBooks (`features/library/ui/MyBooksPage.tsx`, ~800 строк).**
  - `model/useBookImport.ts` — бывший `handleFileUpload` (+ `isUploading`, `uploadError`).
  - `model/useLibraryExport.ts` — бывший `handleExportAll` (+ `isExporting`, `exportProgress`).
  - `model/useLibraryGrouping.ts(items, sortBy)` — группировка по сериям и сортировка (бывший `useMemo items`),
    с unit-тестом на сортировку по `title`/`author`/`date` и группировку серии по `seriesNumber`.
  - `shared/ui/ConfirmDialog.tsx` (на `Sheet`) — заменяет `pendingDelete` + разметку подтверждения;
    хук `useConfirm()` возвращает `confirm(label): Promise<boolean>`.
  - `ui/MyBooksHeader.tsx` (заголовок, счётчики, язык, экспорт, сортировка, вкладки), `ui/LibraryTab.tsx`
    (+ `BookListItem.tsx`, серии), `ui/FavoritesTab.tsx`, `ui/QuotesTab.tsx` (копирование), `ui/BookmarksTab.tsx`,
    `ui/UploadButton.tsx`, `ui/ExportProgress.tsx`.
  - Данные: `useLibrary()` и `useCollections()` вместо `myBookIds` + ручных подписок на `storage-update`.

- [ ] **Step 3: Home, Search, Admin.**
  - `HomePage`: `useRecommendations()` + `useContinueReading()`; убрать ручной `progressTick` и эффекты загрузки.
    Пока рекомендации грузятся — `Skeleton`; при ошибке — блок с «Повторить».
  - `SearchPage`: `useCatalogSearch(debouncedQuery)` (debounce 300 мс через маленький `useDebouncedValue` в
    `shared/lib/hooks`); состояния loading/empty/error.
  - `AdminPage`: только реальные данные `useAdminStats(user.role === 'admin')` — карточки (пользователи, активные
    24 ч / 7 д, книги в библиотеках), топ-10 книг списком, регистрации по дням — `recharts` `AreaChart`
    (импорт только здесь; страница ленивая). Удалить все моки (уведомления, «системные» CPU/RAM, жанры,
    случайные пользователи).

- [ ] **Step 4: Проверка размеров**

```bash
find apps/web/src -name "*.tsx" -o -name "*.ts" | grep -v test | xargs wc -l | sort -n | tail -8
```

Expected: самый большой файл — не страница-монолит; файлы > 250 строк допустимы только для чистой логики
(`fb2Parser.ts`) — перечислить их в отчёте.

- [ ] **Step 5:** `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e` → commit
(можно несколькими коммитами по подпунктам)

```bash
git add -A apps/web
git commit -m "refactor(web): split Reader, MyBooks, Home, Search, Admin into hooks and focused components"
```

---

### Task 10: Бюджеты производительности и финальные проверки

**Files:** `apps/web/.size-limit.json`, `apps/web/package.json`, `.github/workflows/ci.yml`, `apps/web/index.html`,
`entities/book/ui/{BookCard,ImageWithLoader}.tsx`

- [ ] **Step 1: size-limit**

```bash
npm install -w @libify/web -D size-limit@^14 @size-limit/file@^14
```

`apps/web/.size-limit.json`:

```json
[
  { "name": "initial JS", "path": ["dist/assets/index-*.js", "dist/assets/vendor-*.js"], "limit": "120 KB", "gzip": true },
  { "name": "CSS", "path": "dist/assets/*.css", "limit": "20 KB", "gzip": true }
]
```

Имена начальных чанков после Rolldown могут отличаться: взять фактический список из `dist/index.html`
(скрипт «Измерение стартового JS») и прописать их глобы. Скрипт: `"size": "size-limit"`. В CI после `npm run build`
добавить `- run: npm run size -w @libify/web`.

- [ ] **Step 2: Картинки обложек.** В `ImageWithLoader`/`BookCard`: у `<img>` всегда `width`/`height` (или
`aspect-[2/3]` у контейнера), `loading="lazy"`, `decoding="async"`; первые 4 карточки первого экрана на Home —
`loading="eager"` + `fetchPriority="high"` (проп `priority`).

- [ ] **Step 3: `index.html`** — удалить устаревшие `preconnect`/`dns-prefetch` (Google Fonts, если шрифты не
используются; проверить `grep -rn "fonts.googleapis" apps/web`), добавить `<meta name="theme-color" content="#000000">`
если нет.

- [ ] **Step 4: Lighthouse (локально, мобильный профиль)**

```bash
npm run build -w @libify/web && npx -w @libify/web vite preview --port 4173 &
npx lighthouse http://localhost:4173/auth --preset=perf --form-factor=mobile --quiet --chrome-flags="--headless" --output=json --output-path=/tmp/lh.json
node -e "const r=require('/tmp/lh.json');for(const k of ['largest-contentful-paint','total-blocking-time','cumulative-layout-shift'])console.log(k, r.audits[k].displayValue);console.log('score', r.categories.performance.score)"
kill %1
```

Expected: performance ≥ 0.9, CLS < 0.05. Записать цифры до (с `main`-сборки по желанию) и после в отчёт.

- [ ] **Step 5: Итог**: `npm run typecheck && npm run lint && npm test && npm run build && npm run size -w @libify/web && npm run e2e`

- [ ] **Step 6: Commit**

```bash
git add apps/web .github package-lock.json
git commit -m "perf(web): size budgets in CI, cover image hints, head cleanup"
```

---

## Готово, когда

- Стартовый JS ≤ 120 КБ gzip (size-limit в CI), нет zod и framer-motion в начальных чанках.
- Vite 8, plugin-react 6, React Compiler включён (подтверждено grep по сборке).
- `npm run lint` фронта и API — 0 ошибок; `noUncheckedIndexedAccess` включён.
- Структура `app/ features/ entities/ shared/`; нет страниц-монолитов > 250 строк.
- e2e (mobile WebKit + desktop Chromium) зелёные; unit-тесты зелёные.
- Отчёт пользователю: размеры чанков до/после, Lighthouse, отклонения от плана. Затем `/code-review`.
