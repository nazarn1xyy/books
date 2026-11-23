# План 4: дизайн — токены, светлая тема, раскладки, доступность

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, без субагентов). Checkbox-шаги.
> **graphify обязателен:** перед чтением файлов находить их через `graphify query "<имена>" --budget 1500`,
> `graphify explain "<Компонент>"`, `graphify path`. Граф: `graphify-out/` (если нет — `graphify update .`).

**Goal:** Отполировать текущий тёмный Apple-стиль и добавить светлую и системную темы для всего приложения
(у читалки свои темы остаются), сделать раскладки аккуратными на телефоне и десктопе, довести доступность
(фокус, контраст, тач-зоны 44px, клавиатура).

**Architecture:** Семантические цветовые токены Tailwind 4 (`@theme` + CSS-переменные), значения переключаются
атрибутом `data-theme` на `<html>`. Тема хранится в localStorage и применяется инлайн-скриптом в `index.html`
до первой отрисовки (без мигания). Захардкоженные цвета (~350 мест в 32 файлах) переводятся на токены кодмодом
с последующей ручной проверкой неоднозначных мест.

**Спека:** раздел 6 `docs/superpowers/specs/2026-11-18-libify-v2-design.md`.
**Предусловие:** ветка `v2`, находки ревью Плана 3 исправлены, `npm test && npm run e2e` зелёные.

---

### Task 1: Токены и темы

**Files:** `apps/web/src/app/index.css`, `apps/web/index.html`, `apps/web/src/shared/theme/{theme.ts,theme.test.ts,useTheme.ts}`

- [ ] **Step 1: Токены** — в начало `apps/web/src/app/index.css` (после `@import "tailwindcss";`):

```css
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

@theme {
  --color-app: var(--c-app);
  --color-surface: var(--c-surface);
  --color-surface-2: var(--c-surface-2);
  --color-fg: var(--c-fg);
  --color-muted: var(--c-muted);
  --color-subtle: var(--c-subtle);
  --color-line: var(--c-line);
  --color-accent: var(--c-accent);
  --color-on-accent: var(--c-on-accent);
  --color-danger: var(--c-danger);
  --color-success: var(--c-success);
}

:root,
[data-theme='dark'] {
  color-scheme: dark;
  --c-app: #000000;
  --c-surface: #1c1c1e;
  --c-surface-2: #2c2c2e;
  --c-fg: #ffffff;
  --c-muted: #a1a1aa;   /* контраст на #000 ≈ 8:1 */
  --c-subtle: #8e8e93;  /* ≈ 6:1 — не ниже AA для мелкого текста */
  --c-line: rgb(255 255 255 / 0.1);
  --c-accent: #ffffff;
  --c-on-accent: #000000;
  --c-danger: #ff453a;
  --c-success: #30d158;
}

[data-theme='light'] {
  color-scheme: light;
  --c-app: #f2f2f7;
  --c-surface: #ffffff;
  --c-surface-2: #e5e5ea;
  --c-fg: #000000;
  --c-muted: #3c3c43;
  --c-subtle: #6c6c70;  /* ≈ 5:1 на #f2f2f7 */
  --c-line: rgb(0 0 0 / 0.1);
  --c-accent: #000000;
  --c-on-accent: #ffffff;
  --c-danger: #d70015;
  --c-success: #248a3d;
}

body {
  background: var(--c-app);
  color: var(--c-fg);
}

:focus-visible {
  outline: 2px solid var(--c-fg);
  outline-offset: 2px;
  border-radius: 6px;
}
```

Если в `index.css` уже есть `body { background… }` или глобальный фон — заменить на этот. Темы читалки
(`.theme-light/dark/oled/sepia`, `--reader-*`) не трогать.

- [ ] **Step 2: Тест `apps/web/src/shared/theme/theme.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('uses explicit choice', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('follows the system for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
```

- [ ] **Step 3: `apps/web/src/shared/theme/theme.ts`**

```ts
export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'libify.theme';
const META_COLOR: Record<ResolvedTheme, string> = { dark: '#000000', light: '#f2f2f7' };

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

export function readThemeChoice(): ThemeChoice {
  const v = localStorage.getItem(THEME_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
}

/** Applies the theme to <html> and the browser chrome (status bar / tab colour). */
export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme]);
}
```

По умолчанию `'dark'` — текущий вид сохраняется для всех существующих пользователей.

- [ ] **Step 4: `apps/web/src/shared/theme/useTheme.ts`**

```ts
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { applyTheme, readThemeChoice, resolveTheme, THEME_KEY, type ThemeChoice } from './theme';

const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = media();
  mq.addEventListener('change', cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', cb);
    window.removeEventListener('storage', cb);
  };
}

export function useTheme() {
  const choice = useSyncExternalStore(subscribe, readThemeChoice);
  const systemDark = useSyncExternalStore(subscribe, () => media().matches);
  const resolved = resolveTheme(choice, systemDark);

  useEffect(() => applyTheme(resolved), [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    localStorage.setItem(THEME_KEY, next);
    notify();
  }, []);

  return { choice, resolved, setChoice };
}
```

- [ ] **Step 5: Без мигания при загрузке** — в `apps/web/index.html` в `<head>` перед подключением скриптов:

```html
<meta name="theme-color" content="#000000">
<script>
  (function () {
    try {
      var c = localStorage.getItem('libify.theme') || 'dark';
      var dark = c === 'dark' || (c === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      var t = dark ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
      document.querySelector('meta[name="theme-color"]').content = t === 'dark' ? '#000000' : '#f2f2f7';
    } catch (e) {}
  })();
</script>
```

Если `theme-color` уже есть — не дублировать. Если CSP (заголовок в `deploy/Caddyfile`) запрещает инлайн-скрипты —
сейчас CSP не задан; если появится, добавить hash скрипта.

`apple-mobile-web-app-status-bar-style` оставить `black-translucent`: шапки сами красят область статус-бара (`pt-[env(safe-area-inset-top)]` + фон `bg-app`).

- [ ] **Step 6:** `npm test -w @libify/web` → PASS → commit `feat(web): semantic colour tokens with light/dark/system themes`.

---

### Task 2: Кодмод цветов на токены

**Files:** `scripts/codemod-colors.mjs` (временный, удалить после), все `apps/web/src/**/*.tsx`

- [ ] **Step 1:** Найти затронутые файлы через граф и grep (CSS-классы в граф не попадают, поэтому здесь
grep — это нормально): `grep -rlE "text-white|bg-black|bg-white|border-white|text-(gray|neutral)-[456]00|#1C1C1E|#2C2C2E" apps/web/src`.
**Не трогать:** `features/reader/**` (у читалки свои темы через `--reader-*`), кроме `ReaderSettingsSheet`,
`ReaderTocDrawer`, `ReaderTranslateSheet` — это шторки приложения.

- [ ] **Step 2: `scripts/codemod-colors.mjs`**

```js
// Usage: node scripts/codemod-colors.mjs <files...>
import { readFileSync, writeFileSync } from 'node:fs';

const rules = [
  // surfaces
  [/\bbg-\[#1C1C1E\]/gi, 'bg-surface'],
  [/\bbg-\[#2C2C2E\]/gi, 'bg-surface-2'],
  [/\bbg-\[#141416\]/gi, 'bg-surface'],
  [/\bbg-\[#18181b\]/gi, 'bg-surface'],
  [/\bbg-black(?!\/)/g, 'bg-app'],
  [/\bbg-black\/(9\d|8\d)\b/g, 'bg-app/$1'], // translucent bars → themed
  // foreground
  [/\btext-white\b/g, 'text-fg'],
  [/\bbg-white\/(\[[\d.]+\]|\d+)/g, 'bg-fg/$1'],
  [/\bborder-white\/10\b/g, 'border-line'],
  [/\bborder-white\/(\[[\d.]+\]|\d+)/g, 'border-fg/$1'],
  [/\bhover:bg-white\/(\[[\d.]+\]|\d+)/g, 'hover:bg-fg/$1'],
  [/\bring-white\/(\[[\d.]+\]|\d+)/g, 'ring-fg/$1'],
  [/\btext-(gray|neutral)-(300|400)\b/g, 'text-muted'],
  [/\btext-(gray|neutral)-(500|600)\b/g, 'text-subtle'],
  [/\bplaceholder-(gray|neutral)-(400|500)\b/g, 'placeholder-subtle'],
  // solid primary button: white bg + black text
  [/\bbg-white text-black\b/g, 'bg-accent text-on-accent'],
  [/\bhover:bg-neutral-200\b/g, 'hover:opacity-90'],
];

for (const file of process.argv.slice(2)) {
  const before = readFileSync(file, 'utf8');
  let after = before;
  for (const [re, to] of rules) after = after.replace(re, to);
  if (after !== before) {
    writeFileSync(file, after);
    console.log('updated', file);
  }
}
```

Затёмняющие подложки модалок `bg-black/40..70` оставить чёрными
(scrim одинаков в обеих темах) — правило выше их не трогает, т.к. ловит только `/8x` и `/9x`.

- [ ] **Step 3: Прогнать и вычитать дифф**

```bash
node scripts/codemod-colors.mjs $(grep -rlE "text-white|bg-black|bg-white|border-white|text-(gray|neutral)-[3456]00|#1C1C1E|#2C2C2E|#141416|#18181b" apps/web/src --include='*.tsx' | grep -v 'features/reader/ui/Reader\(Page\|ScrollView\|PagedView\|Header\|Footer\|PdfViewer\|TtsControls\)' | grep -v QuoteMenu)
git diff --stat
grep -rnE "text-white|bg-white(?!/)|text-black|bg-black(?!/)" apps/web/src --include='*.tsx' | grep -v features/reader
```

Оставшиеся вхождения разобрать вручную (обычно: `bg-white` как фон кнопки без `text-black` рядом → `bg-accent`;
`text-black` на светлой кнопке → `text-on-accent`; градиенты обложек-заглушек в `BookCoverFallback` — оставить как есть,
это иллюстрация). Удалить `scripts/codemod-colors.mjs`.

- [ ] **Step 4: Проверка в обеих темах.** `npm run dev:web`, в консоли браузера
`localStorage.setItem('libify.theme','light'); location.reload()` — пройти Home, Search, My Books (все вкладки),
шторки читалки, Auth, Admin на 390×844 и 1440×900. Нечитаемый текст / пропавшие границы — исправить классами токенов.

- [ ] **Step 5:** `npm run typecheck && npm run lint && npm run build && npm run e2e` → commit `refactor(web): app colours on semantic tokens`.

---

### Task 3: Переключатель темы

**Files:** `apps/web/src/shared/theme/ThemeSwitcher.tsx`, `apps/web/src/app/layouts/Sidebar.tsx`,
`apps/web/src/features/library/ui/MyBooksHeader.tsx` (найти через `graphify explain`), локали

- [ ] **Step 1: `ThemeSwitcher.tsx`** — сегментированный контрол:

```tsx
import { Monitor, Moon, Sun } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import type { ThemeChoice } from './theme';
import { useTheme } from './useTheme';

const OPTIONS: Array<{ value: ThemeChoice; icon: typeof Sun; labelKey: string }> = [
  { value: 'light', icon: Sun, labelKey: 'theme.light' },
  { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
  { value: 'system', icon: Monitor, labelKey: 'theme.system' },
];

export function ThemeSwitcher() {
  const { t } = useLanguage();
  const { choice, setChoice } = useTheme();
  return (
    <div role="radiogroup" aria-label={t('theme.label')} className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-fg/5 border border-line">
      {OPTIONS.map(({ value, icon: Icon, labelKey }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          onClick={() => setChoice(value)}
          className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
            choice === value ? 'bg-surface text-fg shadow-sm' : 'text-subtle hover:text-fg'
          }`}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
```

`useTheme()` также вызвать один раз в `app/App.tsx` (чтобы реагировать на смену системной темы на любой странице).

- [ ] **Step 2:** Встроить: в `Sidebar` (десктоп) над блоком пользователя; на мобилке — в меню/шапку `MyBooksHeader`
рядом с переключателем языка (как bottom-sheet пункт «Оформлення», если места мало).

- [ ] **Step 3: Локали** `en`/`uk`: `theme.label` («Appearance»/«Оформлення»), `theme.light` («Light»/«Світла»),
`theme.dark` («Dark»/«Темна»), `theme.system` («System»/«Системна»).

- [ ] **Step 4: e2e `apps/web/e2e/theme.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { register, uniqueNickname } from './helpers';

test('switching to light theme persists across reloads', async ({ page }) => {
  await register(page, uniqueNickname());
  await page.goto('/my-books');
  await page.getByRole('radio', { name: /light|світла/i }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
```

Если на мобилке переключатель спрятан в шторку — открыть её в тесте перед кликом.

- [ ] **Step 5:** проверки + commit `feat(web): theme switcher (light/dark/system)`.

---

### Task 4: Раскладки телефон / десктоп

Найти компоненты через `graphify explain "HomePage"`, `"LibraryTab"`, `"SearchPage"`, `"ReaderScrollView"`, `"AppLayout"`.

- [ ] **Step 1: Сетки обложек.** Единый класс сетки для Home/Search/Library:
`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-6`, обложки `aspect-[2/3]`,
подписи `line-clamp-2`. Вынести в `shared/ui/BookGrid.tsx` (`<BookGrid>{children}</BookGrid>`), заменить локальные сетки.

- [ ] **Step 2: Ширина контента на десктопе.** В `AppLayout` контейнер страницы `mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8`
(Sidebar слева не перекрывает контент — `lg:ml-[var(--sidebar-width)]` уже есть).

- [ ] **Step 3: Читалка.** В `ReaderScrollView`/`ReaderPagedView` колонка текста `mx-auto max-w-[68ch]` (60–75 символов),
поля `px-5 sm:px-8`. Клавиатура: `Esc` — закрыть открытую шторку, иначе назад; `←/→` — страницы (есть);
`/` на Home/Search — фокус в поле поиска (`shared/lib/hooks/useHotkey.ts`, игнорировать, если фокус в input).

- [ ] **Step 4: Тач-зоны и safe-area.** Все иконки-кнопки ≥ 44×44 (`min-w-[44px] min-h-[44px]`), нижняя навигация
`pb-[env(safe-area-inset-bottom)]` (есть), фиксированные плавающие кнопки поднять над BottomNav
(`bottom-[calc(env(safe-area-inset-bottom)+5rem)]`). Шапки страниц — непрозрачный `bg-app` без `backdrop-blur`
под статус-баром (как уже сделано у читалки), чтобы в PWA не было размытой полосы.

- [ ] **Step 5: Пустые состояния.** Library/Favorites/Quotes/Bookmarks/Search без данных — иконка, одна строка
объяснения и действие (например, «Найти книгу» → `/search`). Тексты в локали.

- [ ] **Step 6:** проверки + commit `feat(web): responsive grids, readable reader column, hotkeys, empty states`.

---

### Task 5: Доступность и финальная проверка

- [ ] **Step 1:** У всех иконок-кнопок есть `aria-label` (поиск: `graphify query "button aria-label lucide"` даст
компоненты; затем `grep -rn "<button" … | grep -v aria-label` по найденным файлам). Декоративные иконки — `aria-hidden`.
- [ ] **Step 2:** Контраст: `npx -w @libify/web playwright test` + в Playwright `@axe-core/playwright`
(`npm i -D -w @libify/web @axe-core/playwright`), e2e `a11y.spec.ts`: для `/`, `/search`, `/my-books`, `/auth`
в обеих темах `expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([])`.
Нарушения чинить токенами, не отключать правила.
- [ ] **Step 3:** Скриншоты для отчёта: Playwright `page.screenshot` Home и Reader-шторки, mobile+desktop, dark+light →
`apps/web/e2e/__screenshots__/` (не коммитить, приложить в отчёт пути).
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm test && npm run build && npm run size -w @libify/web && npm run e2e`.
- [ ] **Step 5:** commit `feat(web): a11y pass — labels, contrast checks`. Затем `/code-review` по коммитам Плана 4 и отчёт по-русски.

## Готово, когда

- Светлая/тёмная/системная тема по всему приложению, без мигания при загрузке; читалка со своими 4 темами.
- В `apps/web/src` (кроме тела читалки и иллюстраций обложек) нет `text-white`, `bg-black`, `#1C1C1E` вне токенов.
- axe: 0 нарушений WCAG A/AA на ключевых страницах в обеих темах; e2e и size-limit зелёные.
