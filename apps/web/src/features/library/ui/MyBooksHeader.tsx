import { Bookmark, Download, Heart, Library, MessageSquareQuote, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { LANGUAGES } from '@/shared/i18n/languages';
import { SyncStatusBadge } from '@/shared/ui/SyncStatusBadge';
import type { LibrarySort } from '../model/useLibraryGrouping';

export type MyBooksTab = 'books' | 'favorites' | 'quotes' | 'bookmarks';

interface MyBooksHeaderProps {
  activeTab: MyBooksTab;
  onTabChange(tab: MyBooksTab): void;
  counts: { books: number; favorites: number; quotes: number };
  /** Library entries after grouping: the sort bar shows only when there is something to sort. */
  entryCount: number;
  sortBy: LibrarySort;
  onSortChange(sort: LibrarySort): void;
  isExporting: boolean;
  onExport(): void;
}

const TABS: { key: MyBooksTab; icon: LucideIcon; activeClass: string; label: string }[] = [
  { key: 'books', icon: Library, activeClass: 'bg-white text-black', label: 'myBooks.books' },
  { key: 'favorites', icon: Heart, activeClass: 'bg-red-500 text-white', label: 'myBooks.favorites' },
  { key: 'quotes', icon: MessageSquareQuote, activeClass: 'bg-purple-500 text-white', label: 'myBooks.quotes' },
  { key: 'bookmarks', icon: Bookmark, activeClass: 'bg-blue-500 text-white', label: 'myBooks.bookmarks' },
];

const TITLES: Record<MyBooksTab, string> = {
  books: 'myBooks.title',
  favorites: 'myBooks.favorites',
  quotes: 'myBooks.quotes',
  bookmarks: 'myBooks.bookmarks',
};

/** Pinned header: title and counts, language switch, export, sort bar and section tabs. */
export function MyBooksHeader({ activeTab, onTabChange, counts, entryCount, sortBy, onSortChange, isExporting, onExport }: MyBooksHeaderProps) {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="flex-shrink-0 bg-black/95 backdrop-blur-xl border-b border-white/10 pt-2 pb-3 z-30">
      <div className="px-5 desktop-container">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-white lg:text-3xl truncate">{t(TITLES[activeTab])}</h1>
            <SyncStatusBadge className="lg:hidden mt-0.5" />
            {activeTab === 'books' && counts.books > 0 && (
              <p className="text-gray-500 text-xs mt-0.5">{t('myBooks.booksCount', { count: counts.books })}</p>
            )}
            {activeTab === 'favorites' && (
              <p className="text-gray-500 text-xs mt-0.5">{t('myBooks.booksCount', { count: counts.favorites })}</p>
            )}
            {activeTab === 'quotes' && (
              <p className="text-gray-500 text-xs mt-0.5">
                {counts.quotes} {t('myBooks.quotes').toLowerCase()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/5" role="group" aria-label={t('language.title')}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 ${
                    language === lang.code ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'
                  }`}
                  title={lang.name}
                  aria-label={lang.name}
                >
                  <span className="text-xs leading-none">{lang.flag}</span>
                  <span className="uppercase text-[11px] font-bold">{lang.code}</span>
                </button>
              ))}
            </div>

            {activeTab === 'books' && counts.books > 0 && (
              <button
                onClick={onExport}
                disabled={isExporting}
                className="p-2.5 min-w-[40px] min-h-[40px] bg-white/10 hover:bg-white/20 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center border border-white/5"
                title={t('myBooks.exportAll')}
                aria-label={t('myBooks.exportAll')}
              >
                <Download size={18} className="text-white" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        {activeTab === 'books' && entryCount > 1 && (
          <div
            className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide py-0.5 -mx-5 px-5 after:content-[''] after:w-1 after:flex-shrink-0"
            role="group"
            aria-label={t('sort.byDate')}
          >
            {(
              [
                { key: 'date', label: t('sort.byDate') },
                { key: 'title', label: t('sort.byTitle') },
                { key: 'author', label: t('sort.byAuthor') },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                onClick={() => onSortChange(s.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${sortBy === s.key ? 'bg-white text-black font-semibold' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-5 px-5 after:content-[''] after:w-1 after:flex-shrink-0" role="tablist" aria-label="Sections">
          {TABS.map(({ key, icon: Icon, activeClass, label }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${key}`}
                onClick={() => onTabChange(key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm transition-all whitespace-nowrap ${
                  active ? `${activeClass} font-semibold shadow-sm` : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Icon size={16} fill={key === 'favorites' && active ? 'currentColor' : 'none'} aria-hidden="true" />
                <span>{t(label)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
