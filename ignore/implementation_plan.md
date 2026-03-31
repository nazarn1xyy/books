gjcv# Улучшения производительности LibifyStore

Подробный анализ и план по улучшению производительности проекта.

## 🔴 Критические проблемы (высокий приоритет)

### 1. `storage.ts` — массивный JSON парсится при КАЖДОМ вызове функции

> [!CAUTION]
> **Самая серьёзная проблема производительности.** Каждый вызов `getReadingProgress()`, `getMyBookIds()`, `getSettings()`, `isInMyBooks()`, `getBookMetadata()` делает `JSON.parse(localStorage.getItem(...))` — **полный парсинг всего состояния приложения**. В `Reader.tsx` это происходит при каждом скролле (через `handleRangeChanged` → `saveReadingProgress` → `getAppState` + `saveAppState`).

**Сейчас:**
```typescript
// Каждый вызов = JSON.parse всего состояния (включая ВСЁ bookMetadata, ВСЮ readingProgress)
export function getReadingProgress(bookId: string): ReadingProgress | null {
    const state = getAppState(); // ← JSON.parse ВСЕГО localStorage каждый раз
    return state.readingProgress[bookId] || null;
}
```

**Решение:** Кешировать состояние в памяти. Парсить только при инициализации. `saveAppState` обновляет и кеш, и localStorage.

```typescript
let _cachedState: AppState | null = null;

export function getAppState(): AppState {
    if (_cachedState) return _cachedState;
    // ... parse from localStorage only once ...
    _cachedState = state;
    return state;
}

export function saveAppState(state: AppState): void {
    _cachedState = state; // Update in-memory cache
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

**Влияние:** Убирает сотни лишних `JSON.parse` за сессию чтения. Особенно заметно на слабых мобильных устройствах.

---

### 2. `Reader.tsx` — 1088 строк, гигантский монолит (~53KB)

> [!WARNING]
> Reader.tsx содержит **1088 строк** и 25+ useState. Это один из самых тяжёлых компонентов. Каждый setState вызывает ре-рендер ВСЕГО компонента, включая все модалы, TTS-контролы, переводчик.

**Решение:** Разбить на подкомпоненты:
- `ReaderContent.tsx` — основной текст (Virtuoso / Page mode)
- `ReaderSettings.tsx` — модал настроек
- `ReaderTTS.tsx` — TTS-контролы и логика
- `ReaderTranslation.tsx` — модал перевода
- `ReaderSummary.tsx` — AI summary модал
- `useReaderState.ts` — основной хук с логикой

**Влияние:** Когда пользователь меняет TTS speed — перерендерится только TTS-блок, а не вся читалка с тысячами параграфов.

---

### 3. `Home.tsx` — API-вызов с хардкоженным запросом при каждом монтировании

> [!WARNING]
> Главная страница **каждый раз при монтировании** делает `fetchBooks('Толстой')` — сетевой запрос через Tor прокси. Нет кеширования. Каждый переход на главную = ожидание загрузки.

**Сейчас:**
```typescript
useEffect(() => {
    const loadBooks = async () => {
        const fetchedBooks = await fetchBooks('Толстой'); // ← Tor запрос каждый раз
        setBooks(fetchedBooks);
    };
    loadBooks();
}, []);
```

**Решение:** Использовать `sessionStorage` (как уже сделано в Search.tsx) или кешировать в памяти модуля:

```typescript
let homeCache: { books: Book[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

useEffect(() => {
    if (homeCache && Date.now() - homeCache.timestamp < CACHE_TTL) {
        setBooks(homeCache.books);
        setLoading(false);
        return;
    }
    // ... fetch and cache ...
}, []);
```

---

## 🟡 Средний приоритет

### 4. `BookCard.tsx` — два async-вызова `useEffect` при КАЖДОМ рендере карточки

Каждая карточка при монтировании:
1. `isBookFavorite(book.id)` — запрос к Supabase
2. `isBookCached(book.id)` — запрос к IndexedDB

Когда на Home 10+ карточек — это **10+ параллельных запросов** к Supabase и 10+ к IndexedDB.

**Решение:** 
- Загружать список избранных `book_id` один раз на уровне контекста/страницы и передавать через props
- Для `isBookCached` — кешировать набор cached IDs один раз при монтировании страницы

---

### 5. `data/books.ts` — 14KB статичных mock-данных в бандле

Файл содержит 6 книг с полным контентом (массивы строк). Этот файл:
- Импортируется в `MyBooks.tsx` на строке 6: `import { books } from '../data/books'`
- Используется только для маппинга `books.find(b => b.id === id)` — что **никогда не найдёт ничего** для flibusta/local книг (их id это `local-*` или числовые id)

> [!IMPORTANT]
> Этот файл по сути мёртвый код для реальных данных. Все реальные книги хранятся в `bookMetadata` в localStorage. Статичные книги с unsplash обложками существуют только для демо.

**Решение:** Удалить импорт из `MyBooks.tsx` и использовать только `getBookMetadata(id)`.

---

### 6. `recharts` — 354KB в бандле для одной admin-страницы

`recharts` (354KB gzip: 106KB) загружается в бандл и используется только в `Admin/Admin.tsx`. Он уже lazy-loaded, но определён в `manualChunks`. Это нормально, но стоит убедиться что chunk не подтягивается в precache PWA.

**Решение:** Проверить и исключить admin chunk из PWA precache если ещё не сделано.

---

### 7. `getAppState()` вызывается в `BookListItem` при каждом рендере

В `MyBooks.tsx`, строка 648:
```typescript
function BookListItem({ book, onRemove }) {
    const progress = getReadingProgress(book.id); // ← JSON.parse при каждом рендере каждого элемента списка
```

Это вызывается для КАЖДОЙ книги в списке, и каждый раз парсит localStorage. При 20 книгах = 20 `JSON.parse`.

**Решение:** Связано с пунктом 1 (кеш в памяти).

---

## 🟢 Низкий приоритет (nice-to-have)

### 8. PDF worker загружается всегда, даже для FB2

Строки 21-24 Reader.tsx:
```typescript
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();
```

Этот код выполняется при импорте Reader чанка, даже если книга — FB2.

**Решение:** Инициализировать PDF worker лениво, только когда `book?.format === 'pdf'`.

### 9. Отсутствие `React.memo` на модальных подкомпонентах

Settings modal, TTS controls, Translation modal — все инлайн в Reader.tsx и перерендериваются при любом изменении состояния.

### 10. `translationService.ts` — перевод всех абзацев сразу

При переводе книги переводятся ВСЕ абзацы (даже те что пользователь ещё не прочитал). Для книги в 1000 абзацев это 200 запросов к Google Translate API.

**Решение:** Переводить только видимые абзацы + буфер (50 вперёд, 50 назад).

---

## Предлагаемый план действий

| # | Что | Влияние | Сложность | Риск |
|---|-----|---------|-----------|------|
| 1 | ⬆️ Кеш `storage.ts` в памяти | 🔥🔥🔥 Высокое | 🟢 Низкая | 🟢 Минимальный |
| 3 | ⬆️ Кеш Home API | 🔥🔥 Среднее | 🟢 Низкая | 🟢 Нет |
| 5 | ⬆️ Удалить мёртвый data/books.ts | 🔥 Экономия 14KB | 🟢 Низкая | 🟡 Проверить |
| 8 | ⬆️ Ленивый PDF worker | 🔥 Среднее | 🟢 Низкая | 🟢 Нет |
| 2 | 📦 Разбить Reader.tsx | 🔥🔥🔥 Высокое | 🔴 Высокая | 🟡 Средний |
| 4 | 📦 Batch favorites check | 🔥🔥 Среднее | 🟡 Средняя | 🟢 Нет |
| 10 | 📦 Lazy translation | 🔥🔥 Среднее | 🟡 Средняя | 🟢 Нет |

## Рекомендация

> [!IMPORTANT]
> Я предлагаю выполнить пункты **1, 3, 5, 8** — это безопасные улучшения с низким риском и максимальным эффектом. Пункт 2 (разбиение Reader) — это самый большой выигрыш, но и самый рискованный рефакторинг. Я бы оставил его на отдельную итерацию.

Какие пункты хочешь реализовать? Или может все безопасные (1, 3, 5, 8)?
