# Libify v2: дизайн-спецификация

Дата: 2026-11-18 · Ветка: `v2` · Репозиторий: github.com/nazarn1xyy/books

## 1. Цель и контекст

Читалка книг (FB2/EPUB/PDF, поиск по Flibusta, TTS, перевод, AI, цитаты, закладки, PWA).
Сейчас: Vite 7 + React 19 + Tailwind 4 + Supabase, деплой на Vercel.

Проблемы текущей версии:
- **Регистрация и вся синхронизация сломаны:** Supabase-проект `tczvevxgyxancoaqrfkc`
  удалён, домен не резолвится. Ключ зашит в `src/lib/supabase.ts`.
- Монолиты: `MyBooks.tsx` (802 строки), `Reader.tsx` (706), `Admin.tsx` (500, на моках).
- `storage.ts` делает `JSON.parse` всего состояния при каждом вызове, в том числе при скролле.
- `api/proxy.ts` принимает `host` от клиента, то есть работает как открытый прокси (SSRF).
- Захардкожен email админа, нет тестов, README остался от шаблона.

Цели v2:
1. Свой бэкенд на Postgres вместо Supabase, рабочая регистрация по нику и паролю.
2. Чистая архитектура: ООП-слои на бэке, структура по фичам на фронте, общие типы.
3. Заметный рост производительности и надёжности (офлайн, ретраи, бюджеты).
4. Отполированный дизайн для мобилки и десктопа, светлая и тёмная темы.
5. Деплой на свой сервер, домен `libify.store`.

Вне рамок: перенос данных из Supabase (данных больше нет, стартуем с пустой базы),
подтверждение email и сброс пароля по почте, нативные приложения.

## 2. Инфраструктура и деплой

**Сервер:** Oracle Cloud VM.Standard.E2.1.Micro, x86_64, 1 ГБ RAM, Ubuntu 24.04,
`ubuntu@79.76.50.187`, ключ `~/.ssh/id_ed25519`, sudo без пароля.

**Очистка сервера (подтверждено пользователем, без бэкапа):** удалить всё прежнее:
- Звонилку: `docker compose down -v` в `~/zvonilka/deploy/server` (контейнеры
  `server-caddy-1`, `server-api-1`, `server-livekit-1`, volumes `server_api-data`,
  `server_caddy-config`, `server_caddy-data`), образы `zvonilka-api`, `caddy:2` (будет
  скачан заново), `livekit/livekit-server`, каталог `~/zvonilka`;
- портфолио: `/opt/site`.

После очистки на сервере работает только Libify.

**Целевая схема** (`/opt/libify/docker-compose.yml`, сеть `libify`):

| Сервис | Образ | Порты | Лимит памяти | Назначение |
|---|---|---|---|---|
| caddy | caddy:2-alpine | 80, 443 | 64m | TLS (Let's Encrypt), статика, reverse proxy |
| api | libify-api:<git-sha> | только внутри сети, 3000 | 160m | Hono API |
| db | postgres:17-alpine | наружу не открыт | 192m | Postgres |

Caddyfile (в репозитории, `deploy/Caddyfile`):
- `libify.store`: `/api/*` → `reverse_proxy api:3000`, остальное `root /srv/web`,
  `try_files {path} /index.html`, `encode zstd gzip`, `/assets/*` с
  `Cache-Control: public, max-age=31536000, immutable`, `index.html` и `sw.js` с `no-cache`.
  Заголовки безопасности: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, CSP.
- `www.libify.store` → 308 на `libify.store`.

Postgres: `shared_buffers=32MB`, `max_connections=20`, `work_mem=2MB`,
`effective_cache_size=128MB`. Данные в volume `libify-pgdata`.

**Сборка только локально.** На сервере ничего не собирается.
- Веб: `npm run build -w apps/web` → `rsync --delete` в `/opt/libify/web`.
- API: `docker buildx build --platform linux/amd64 -t libify-api:<sha>` →
  `docker save | gzip | ssh … docker load`.
- `deploy/deploy.sh` выполняет: проверки (lint, typecheck, tests) → сборка → загрузка →
  `docker compose up -d` → `drizzle migrate` (одноразовый контейнер api) →
  smoke-тест `curl -fsS https://libify.store/api/health` и `https://libify.store/`.
- Секреты лежат в `/opt/libify/.env` на сервере (права 600), в репозитории только `.env.example`.

**Бэкапы:** cron-задача хоста выполняет `docker exec db pg_dump -Fc` раз в сутки в
`/opt/libify/backups`, хранит последние 7 копий.

**DNS (делает пользователь):** A-записи `libify.store` и `www.libify.store` → `79.76.50.187`.
Сейчас они указывают на Vercel (216.198.79.1). После переключения проект на Vercel отключить.

## 3. Репозиторий

npm workspaces, Node 24 LTS, TypeScript 5.9 strict.

```
apps/web        Vite + React 19 SPA
apps/api        Hono API
packages/shared zod-схемы DTO, типы, коды ошибок (общие для web и api)
deploy/         Caddyfile, docker-compose.yml, deploy.sh, postgres.conf
docs/
```

Удаляется: `api/` (Vercel functions), `vercel.json`, `schema.sql`, `@supabase/supabase-js`,
`src/lib/supabase.ts`, `services/mockStats.ts`, закоммиченный `dist/`, `.DS_Store`.
README переписывается: описание проекта, запуск, деплой.

Инструменты: ESLint с проверкой типов, Prettier, Vitest, Playwright, size-limit,
GitHub Actions CI (lint, typecheck, test, build).

## 4. Бэкенд (`apps/api`)

**Стек:** Hono + `@hono/node-server`, Drizzle ORM + `postgres` (postgres.js, пул на 10
соединений), zod, `@node-rs/argon2`, pino.

**Слои (ООП, внедрение зависимостей через конструкторы):**
```
src/core/
  config.ts          env через zod, при невалидной конфигурации сервер не стартует
  db.ts              клиент Drizzle, схема в db/schema.ts, миграции в db/migrations
  errors.ts          AppError (code, status) → ValidationError, UnauthorizedError,
                     ForbiddenError, NotFoundError, ConflictError, RateLimitError
  middleware/        requestId, logger, errorHandler, session, requireAuth,
                     requireAdmin, originCheck, rateLimit
src/modules/<name>/
  <name>.controller.ts   HTTP: валидация (zod из shared), вызов сервиса, ответ
  <name>.service.ts      класс с бизнес-логикой, без знаний об HTTP
  <name>.repository.ts   класс над Drizzle, без бизнес-логики
src/container.ts     собирает граф объектов: репозитории → сервисы → контроллеры
src/app.ts           создаёт Hono-приложение (для тестов, без listen)
src/server.ts        listen + graceful shutdown (SIGTERM: стоп приёма, дождаться запросов, закрыть пул)
src/cli/make-admin.ts  назначение роли admin по нику
```

Модули: `auth`, `library`, `progress`, `quotes`, `bookmarks`, `favorites`, `sync`,
`catalog`, `ai`, `admin`, `health`.

**Схема БД:**
- `users`: `id uuid pk`, `nickname citext unique`, `password_hash text`,
  `role enum('user','admin') default 'user'`, `created_at`, `last_seen_at`.
- `sessions`: `id text pk` (SHA-256 от токена, сам токен хранится только в cookie),
  `user_id fk cascade`, `expires_at`, `created_at`, `user_agent`. Индекс по `user_id`.
- `user_books`: `pk(user_id, book_id)`, `title`, `author`, `cover_url`,
  `status enum(reading,plan,finished,dropped)`, `format`, `added_at`, `updated_at`, `deleted_at`.
- `reading_progress`: `pk(user_id, book_id)`, `paragraph_index int`, `scroll_ratio real`,
  `current_page int`, `total_pages int`, `updated_at`.
- `quotes`: `id uuid pk` (генерируется клиентом), `user_id`, `book_id`, `text`, `note`,
  `color`, `created_at`, `updated_at`, `deleted_at`.
- `bookmarks`: `id uuid pk`, `user_id`, `book_id`, `paragraph_index`, `preview_text`,
  `updated_at`, `deleted_at`. Уникальности `(user_id, book_id, paragraph_index)` нет: ключ закладки —
  `id`, дубликаты разрешает клиент.
- `favorites`: `pk(user_id, book_id)`, `title`, `author`, `cover_url`, `updated_at`, `deleted_at`.
- У всех синхронизируемых таблиц есть `synced_at` — серверное время записи, курсор pull
  (`updated_at` — клиентское время для last-write-wins). Индексы `(user_id, synced_at)`.

Обложки хранятся как URL, а не base64.

**Авторизация:**
- `POST /api/auth/register {nickname, password}`: ник `^[a-zA-Z0-9_]{3,24}$`
  без учёта регистра, пароль от 8 до 128 символов. Создаёт пользователя и сессию,
  возвращает `201 {user}`. Занятый ник даёт `409 NICKNAME_TAKEN`.
- `POST /api/auth/login`: неверная пара ник/пароль даёт `401 INVALID_CREDENTIALS`
  (одно сообщение на оба случая). Хеш argon2id: m=19 МиБ, t=2, p=1.
- `POST /api/auth/logout`, `GET /api/auth/me`.
- Cookie `libify_sid`: случайные 32 байта в base64url, `HttpOnly; Secure; SameSite=Lax;
  Path=/; Max-Age=30d`. Срок продлевается, если до истечения осталось меньше 15 дней.
- Для изменяющих методов `Origin` должен совпадать с `APP_ORIGIN`, иначе `403`.
- Rate limit в памяти (окно токенов): `login` и `register` 5 запросов в минуту на IP и
  10 в час на ник, остальное API 120 запросов в минуту на сессию.

**Синхронизация (вместо Supabase realtime):**
- `GET /api/sync/pull?since=<ISO>` возвращает все изменённые после `since` записи
  синхронизируемых таблиц (включая tombstones с `deleted_at`) и `serverTime`.
- `POST /api/sync/push {ops: [{entity, op: 'upsert'|'delete', data, clientUpdatedAt}]}`,
  до 200 операций в пачке, выполняется в одной транзакции. Конфликты решаются по принципу
  «последняя запись побеждает»: запись применяется, только если
  `clientUpdatedAt > updated_at` в базе. Ответ `{applied, rejected, serverTime}`.
- Все пользовательские данные пишутся и читаются только через `/api/sync/push|pull`; отдельных REST-эндпоинтов
  для библиотеки нет (YAGNI).

**Каталог (прокси Flibusta):** `GET /api/catalog/search?q=` (OPDS XML),
`GET /api/catalog/book/:id/:format` (fb2|epub|mobi), `GET /api/catalog/image?src=`.
- Белый список хостов задаётся в конфиге (`flibusta.is`, `static.flibusta.is`), клиент
  не передаёт хост. Таймаут 15 с, 2 ретрая с паузой, `User-Agent` свой.
- LRU-кеш в памяти: поиск 10 минут / 200 записей, ограничение кеша ~10 МБ. Файлы книг не кешируются на сервере, это делает клиент в IndexedDB.
- Ответы потоковые (stream), без буферизации книги целиком в памяти.

**AI:** `POST /api/ai/summarize {text}` (пересказ отрывка) требует авторизацию, лимит 20 запросов в минуту на
пользователя. Провайдер и ключ задаются в env (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`,
совместимо с OpenAI). Если ключа нет, возвращается `503 AI_DISABLED`, и UI скрывает кнопку
(узнаёт через `GET /api/ai/status` → `{enabled}`).

**Админка:** `GET /api/admin/stats`: число пользователей, активные за 24 ч и 7 дней,
книги в библиотеках, топ книг, регистрации по дням. Доступ только с `role=admin`.

**Формат ошибок:** `{ "error": { "code": "NICKNAME_TAKEN", "message": "..." } }`.
Коды хранятся в `packages/shared`, фронт показывает локализованный текст по коду.
Ошибки 5xx логируются со стеком и `requestId`, клиенту стек не отдаётся.

**Health:** `GET /api/health` возвращает `{status:'ok', db:'ok'}` (`select 1` с таймаутом 1 с).

## 5. Фронтенд (`apps/web`)

**Стек:** Vite (актуальная версия), React 19 + React Compiler, React Router 7,
TanStack Query 5, zustand, Tailwind 4, vite-plugin-pwa (Workbox), react-virtuoso,
pdf.js через react-pdf (лениво), jszip (лениво), recharts (только в админке, лениво),
lucide-react (импорт иконок по одной).
framer-motion удаляется, вместо него CSS-переходы и View Transitions API.

**Структура:**
```
src/app/         main.tsx, router.tsx, providers.tsx, layouts/ (AppLayout, ReaderLayout)
src/features/
  auth/          ui/AuthPage, model/useSession, api/authApi
  library/       ui/Shelf, Filters, BookCard, Import; model/ useLibrary
  reader/        ui/ReaderView, Pagination, TocDrawer, SettingsSheet, TtsBar, TranslateSheet,
                 QuoteMenu, PdfViewer; model/readerStore (zustand), useReadingProgress
  search/        ui/SearchPage, model/useCatalogSearch
  quotes/        цитаты и закладки
  admin/         AdminPage (на реальных данных)
src/entities/    book, user: типы, мапперы, мелкие UI-компоненты
src/shared/
  api/ApiClient.ts     класс: fetch с credentials, таймаут, ретраи для GET,
                       разбор ошибок в ApiError(code)
  db/BookCache.ts      класс над IndexedDB (idb): тексты, главы, pdf-данные, LRU по размеру
  db/LocalStore.ts     класс: настройки и состояние в памяти + отложенная запись в localStorage
  sync/SyncEngine.ts   класс: outbox в IndexedDB, push пачками, pull по курсору,
                       триггеры online / visibilitychange / интервал 60 с, повторы с
                       нарастающей паузой, мьютекс от параллельных запусков
  ui/                  ui-kit: Button, Sheet, Dialog, Skeleton, Toast, Icon
  i18n/                uk (по умолчанию), en; словари грузятся лениво, тексты ошибок по кодам из shared
  config/, lib/
```
Ориентир размера: до ~250 строк на файл, один компонент на файл.

**Поток данных:**
- Серверные данные живут в TanStack Query (staleTime 30 с, кеш сохраняется в IndexedDB
  для офлайн-старта).
- Изменения пользователя: оптимистичное обновление кеша → операция в outbox →
  SyncEngine отправляет её. После pull кеш Query инвалидируется.
- Настройки читалки в zustand с селекторами, сохраняются в localStorage.
- Прогресс чтения сохраняется с задержкой 2 с и при `pagehide`/`visibilitychange`.

**Производительность:**
- Разделение по маршрутам (Home, Search, Library, Reader, Admin, Auth). Модули
  pdf/jszip/recharts/tts/translate грузятся только при использовании.
- Парсинг FB2/EPUB в Web Worker, результат (абзацы и оглавление) кешируется в IndexedDB,
  повторное открытие книги без повторного парсинга.
- Виртуализация длинных текстов и списков (react-virtuoso).
- Обложки: `width`/`height`, `loading="lazy"`, `decoding="async"`, `fetchpriority="high"`
  у первой видимой; Workbox кеширует обложки (CacheFirst, 300 записей, 30 дней).
- Шрифты: системный стек для UI и один self-hosted вариативный шрифт для чтения с `preload`.
- Бюджет (size-limit в CI): стартовый JS ≤ 120 КБ gzip, CSS ≤ 20 КБ gzip.
  Цели: LCP < 1.5 с (4G, средний телефон), INP < 200 мс, CLS < 0.05.

**Надёжность:**
- ErrorBoundary на уровне приложения и каждого маршрута, с кнопкой «повторить».
- Повторная загрузка чанка при сбое один раз, потом перезагрузка страницы с флагом от зацикливания.
- PWA: приложение, библиотека и скачанные книги работают офлайн. При новой версии SW
  показывается тост «Обновить».
- Индикатор офлайн-режима и статуса синхронизации.

## 6. Дизайн

Направление: **отполировать текущий тёмный Apple-стиль** и добавить светлую тему.
- Дизайн-токены в CSS-переменных (`@theme` Tailwind 4): цвета (фоны, текст, разделители,
  акцент), отступы по сетке 8px, радиусы, тени, типографическая шкала. Темы: тёмная
  (по умолчанию), светлая и системная.
- Мобилка: BottomNav, обложки в 2 колонки, bottom-sheet для настроек, safe-area отступы,
  тач-зоны от 44px.
- Десктоп (≥1024px): Sidebar, сетка обложек 4–6 колонок, читалка с ограниченной шириной
  строки (60–75 символов), поддержка клавиатуры (←/→, Esc, `/` для поиска).
- Читалка: темы (светлая, сепия, тёмная, OLED-чёрная), шрифт, кегль, межстрочный
  интервал, ширина колонки, режим страниц или скролла.
- Доступность: контраст по WCAG AA, видимый фокус, aria-метки, `prefers-reduced-motion`.
- Страница авторизации: одна форма «ник + пароль» с переключением вход/регистрация,
  ошибки показываются инлайн у полей.

## 7. Тестирование

- **API (Vitest):** unit-тесты сервисов с фейковыми репозиториями; интеграционные тесты
  репозиториев и HTTP через `app.request()` на настоящем Postgres (docker compose
  `db-test`). Обязательные сценарии: регистрация, занятый ник (регистр не важен), вход,
  неверный пароль, истёкшая сессия, проверка Origin, rate limit, sync push/pull с
  конфликтами, удаление через tombstone, проверка белого списка хостов каталога.
- **Web (Vitest + Testing Library):** SyncEngine (outbox, ретраи, мьютекс), BookCache,
  парсер FB2, ApiClient.
- **E2E (Playwright, viewport 390×844 и 1440×900):** регистрация → вход → поиск →
  добавить книгу → открыть читалку → прогресс сохраняется после перезагрузки → выход.
- **CI (GitHub Actions):** lint, typecheck, unit и integration (с Postgres-сервисом),
  build, size-limit. E2E запускается локально перед деплоем.

## 8. Порядок работ

1. Монорепо, инструменты, CI, перенос текущего фронта в `apps/web` без изменения поведения.
2. `packages/shared` + `apps/api`: core, схема БД, миграции, auth, тесты.
3. Модули sync, library, progress, quotes, bookmarks, favorites, catalog, ai, admin, тесты.
4. Фронт: ApiClient, SyncEngine, BookCache, LocalStore; удаление Supabase; новая авторизация.
5. Рефакторинг по фичам (Reader, MyBooks, Search, Admin) и производительность.
6. Дизайн-система, темы, адаптивность.
7. Деплой: очистка сервера, compose, Caddy, бэкапы, smoke-тесты. Пользователь переключает DNS.
8. Финальное ревью кода (`/code-review`).

## 9. Риски и открытые вопросы

- **Доступность Flibusta с IP Oracle:** проверить на этапе 3 (`curl` с сервера). Если
  заблокировано, поиск по каталогу не заработает, и нужно будет решать отдельно.
- **AI-провайдер:** текущий GLHF может быть недоступен. По умолчанию AI выключен, пока
  в `.env` не задан рабочий OpenAI-совместимый ключ.
- **Память сервера:** суммарный лимит ~420 МБ из ~950 МБ. На сервере есть swap 2 ГБ.
  Проверить `docker stats` после деплоя.
- **Перевод** идёт напрямую из браузера через неофициальный endpoint Google Translate
  и может перестать работать. Поведение не меняется, ошибки показываются аккуратно.
