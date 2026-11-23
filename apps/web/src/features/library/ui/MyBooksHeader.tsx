import { useState } from 'react';
import { ArrowUpDown, Bookmark, Download, Heart, LayoutGrid, Library, List, MessageSquareQuote, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { ThemeSwitcher } from '@/shared/theme/ThemeSwitcher';
import { Sheet } from '@/shared/ui/Sheet';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { LANGUAGES } from '@/shared/i18n/languages';
import { SyncStatusBadge } from '@/shared/ui/SyncStatusBadge';
import type { LibrarySort } from '../model/useLibraryGrouping';
import type { LibraryView } from '../model/useLibraryView';

export type MyBooksTab = 'books' | 'favorites' | 'quotes' | 'bookmarks';

interface MyBooksHeaderProps {
  activeTab: MyBooksTab;
  onTabChange(tab: MyBooksTab): void;
  counts: { books: number; favorites: number; quotes: number };
  /** Library entries after grouping: sorting is offered only when there is something to sort. */
  entryCount: number;
  sortBy: LibrarySort;
  onSortChange(sort: LibrarySort): void;
  view: LibraryView;
  onViewChange(view: LibraryView): void;
  isExporting: boolean;
  onExport(): void;
}

const TABS: { key: MyBooksTab; icon: LucideIcon; label: string }[] = [
  { key: 'books', icon: Library, label: 'myBooks.books' },
  { key: 'favorites', icon: Heart, label: 'myBooks.favorites' },
  { key: 'quotes', icon: MessageSquareQuote, label: 'myBooks.quotes' },
  { key: 'bookmarks', icon: Bookmark, label: 'myBooks.bookmarks' },
];

const TITLES: Record<MyBooksTab, string> = {
  books: 'myBooks.title',
  favorites: 'myBooks.favorites',
  quotes: 'myBooks.quotes',
  bookmarks: 'myBooks.bookmarks',
};

const SORTS: { key: LibrarySort; label: string }[] = [
  { key: 'date', label: 'sort.byDate' },
  { key: 'title', label: 'sort.byTitle' },
  { key: 'author', label: 'sort.byAuthor' },
];

/**
 * Pinned header. One row for the page (title, count, a single "more" menu), one constant-height row
 * for sections and library view controls, so switching tabs never moves the content.
 */
export function MyBooksHeader({ activeTab, onTabChange, counts, entryCount, sortBy, onSortChange, view, onViewChange, isExporting, onExport }: MyBooksHeaderProps) {
  const { t, language, setLanguage } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const showLibraryControls = activeTab === 'books' && counts.books > 0;

  const countLabel =
    activeTab === 'books' && counts.books > 0
      ? t('myBooks.booksCount', { count: counts.books })
      : activeTab === 'favorites'
        ? t('myBooks.booksCount', { count: counts.favorites })
        : activeTab === 'quotes'
          ? `${counts.quotes} ${t('myBooks.quotes').toLowerCase()}`
          : null;

  return (
    <>
      <div className="flex-shrink-0 bg-app border-b border-line pt-2 z-30">
        <div className="px-5 desktop-container">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="page-title">{t(TITLES[activeTab])}</h1>
              <div className="mt-0.5 flex min-h-[1.25rem] items-center gap-3 text-xs text-subtle">
                {countLabel && <span>{countLabel}</span>}
                <SyncStatusBadge className="lg:hidden" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t('common.more')}
              aria-haspopup="dialog"
              className="-mr-2 min-w-[44px] min-h-[44px] grid place-items-center rounded-full text-fg hover:bg-fg/10 active:scale-95 transition"
            >
              <MoreHorizontal size={22} aria-hidden="true" />
            </button>
          </header>

          <div className="mt-3 flex min-h-[52px] items-center gap-3 pb-2">
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-hide -mx-5 px-5" role="tablist" aria-label={t('myBooks.title')}>
              {TABS.map(({ key, icon: Icon, label }) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`panel-${key}`}
                    onClick={() => onTabChange(key)}
                    className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-colors ${
                      active ? 'bg-accent text-on-accent font-semibold' : 'text-muted hover:bg-fg/10 hover:text-fg'
                    }`}
                  >
                    <Icon size={16} fill={key === 'favorites' && active ? 'currentColor' : 'none'} aria-hidden="true" />
                    <span>{t(label)}</span>
                  </button>
                );
              })}
            </div>

            {showLibraryControls && (
              <div className="hidden lg:flex flex-shrink-0 items-center gap-1">
                {entryCount > 1 && (
                  <label className="relative flex min-h-[44px] items-center rounded-full text-muted hover:bg-fg/10 hover:text-fg">
                    <ArrowUpDown size={16} className="pointer-events-none absolute left-3" aria-hidden="true" />
                    <span className="sr-only">{t('sort.label')}</span>
                    <select
                      value={sortBy}
                      onChange={(e) => onSortChange(e.target.value as LibrarySort)}
                      className="min-h-[44px] cursor-pointer appearance-none rounded-full bg-transparent pl-9 pr-3 text-sm text-fg outline-none"
                    >
                      {SORTS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {t(s.label)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="flex rounded-full bg-fg/10 p-0.5" role="group" aria-label={t('myBooks.view')}>
                  {(
                    [
                      { key: 'grid', icon: LayoutGrid, label: t('myBooks.viewGrid') },
                      { key: 'list', icon: List, label: t('myBooks.viewList') },
                    ] as const
                  ).map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onViewChange(key)}
                      aria-pressed={view === key}
                      aria-label={label}
                      title={label}
                      className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${view === key ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Outside the z-30 header: a flex item with z-index traps the sheet under the bottom nav. */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t('common.more')} className="p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-fg">{t('theme.label')}</h2>
            <ThemeSwitcher />
          </section>

          {/* On phones the tab row has no room for library controls: they live here. */}
          {showLibraryControls && (
            <section className="lg:hidden space-y-3">
              <h2 className="text-sm font-semibold text-fg">{t('sort.label')}</h2>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-fg/5 p-1" role="radiogroup" aria-label={t('sort.label')}>
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    role="radio"
                    aria-checked={sortBy === s.key}
                    onClick={() => onSortChange(s.key)}
                    className={`min-h-[44px] rounded-lg text-xs transition-colors ${sortBy === s.key ? 'bg-surface text-fg font-semibold shadow-sm' : 'text-subtle hover:text-fg'}`}
                  >
                    {t(s.label)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-fg/5 p-1" role="radiogroup" aria-label={t('myBooks.view')}>
                {(
                  [
                    { key: 'grid', icon: LayoutGrid, label: t('myBooks.viewGrid') },
                    { key: 'list', icon: List, label: t('myBooks.viewList') },
                  ] as const
                ).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={view === key}
                    onClick={() => onViewChange(key)}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg text-sm transition-colors ${view === key ? 'bg-surface text-fg font-semibold shadow-sm' : 'text-subtle hover:text-fg'}`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Desktop has the language switch in the sidebar. */}
          <section className="lg:hidden">
            <h2 className="mb-3 text-sm font-semibold text-fg">{t('language.title')}</h2>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-fg/5 p-1" role="radiogroup" aria-label={t('language.title')}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  role="radio"
                  aria-checked={language === lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg text-sm transition-colors ${
                    language === lang.code ? 'bg-surface text-fg font-semibold shadow-sm' : 'text-subtle hover:text-fg'
                  }`}
                >
                  <span aria-hidden="true">{lang.flag}</span>
                  {lang.name}
                </button>
              ))}
            </div>
          </section>

          {counts.books > 0 && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onExport();
              }}
              disabled={isExporting}
              className="flex w-full min-h-[48px] items-center gap-3 rounded-xl border border-line px-4 text-sm font-medium text-fg hover:bg-fg/5 disabled:opacity-50"
            >
              <Download size={18} aria-hidden="true" />
              {t('myBooks.exportAll')}
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
}
