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
