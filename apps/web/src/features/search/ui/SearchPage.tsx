import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X, Loader2 } from 'lucide-react';
import { BookCard } from '@/entities/book/ui/BookCard';
import { useHotkey } from '@/shared/lib/hooks/useHotkey';
import { EmptyState } from '@/shared/ui/EmptyState';
import { BookGrid } from '@/shared/ui/BookGrid';
import { useDebouncedValue } from '@/shared/lib/hooks/useDebouncedValue';
import { useKeyboardHeight } from '@/shared/lib/hooks/useKeyboardHeight';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { MIN_SEARCH_LENGTH, useCatalogSearch } from '../model/useCatalogSearch';

/** Typing pause before searching; Flibusta is slow, so do not fire on every keystroke. */
const SEARCH_DEBOUNCE_MS = 600;

export function SearchPage() {
    const [searchParams] = useSearchParams();
    const [query, setQuery] = useState(() => searchParams.get('q') || '');
    const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS).trim();
    const search = useCatalogSearch(debouncedQuery);
    const { isKeyboardOpen, keyboardHeight } = useKeyboardHeight();
    const { t } = useLanguage();
    const inputRef = useRef<HTMLInputElement>(null);
    useHotkey('/', (e) => {
        e.preventDefault();
        inputRef.current?.focus();
    });

    const active = debouncedQuery.length >= MIN_SEARCH_LENGTH;
    // A new query shows the spinner, not the previous query's results.
    const loading = active && (search.isLoading || search.isPlaceholderData);
    const results = active ? (search.data ?? []) : [];

    return (
        <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-app pt-[env(safe-area-inset-top)] overflow-hidden">
            {/* Fixed Search Header */}
            <header className="flex-shrink-0 bg-app border-b border-line px-5 pt-2 pb-4 lg:px-8 z-30">
                <div className="desktop-container">
                    <h1 className="text-2xl font-bold text-fg mb-3 lg:text-3xl">{t('search.title')}</h1>
                    <div className="relative lg:max-w-xl">
                        <SearchIcon
                            size={20}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                            aria-hidden="true"
                        />
                        <input
                            ref={inputRef}
                            type="search"
                            inputMode="search"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('search.placeholder')}
                            aria-label={t('search.title')}
                            className="w-full h-12 bg-surface rounded-xl pl-12 pr-12 text-fg placeholder-subtle focus:outline-none focus:ring-2 focus:ring-fg/20 transition-all text-base"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                aria-label={t('common.cancel')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-fg transition-colors active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Scrollable Results Area */}
            <div
                className="flex-1 px-5 pt-4 overflow-y-auto overflow-x-hidden touch-pan-y"
                style={{
                    paddingBottom: isKeyboardOpen ? Math.max(keyboardHeight, 80) : 96,
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="animate-spin text-muted mb-4" size={32} />
                        <p className="text-muted">{t('search.searching')}</p>
                    </div>
                ) : active && search.isError ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <p className="text-muted mb-4">{t('errors.networkError')}</p>
                        <button
                            onClick={() => void search.refetch()}
                            className="px-4 py-2 bg-fg/10 rounded-full text-fg text-sm hover:bg-fg/20 transition-colors"
                        >
                            {t('common.retry')}
                        </button>
                    </div>
                ) : results.length > 0 ? (
                    <BookGrid className="pb-8 desktop-container">
                        {results.map((book) => (
                            <BookCard key={book.id} book={book} size="small" showActions />
                        ))}
                    </BookGrid>
                ) : active ? (
                    <EmptyState icon={SearchIcon} text={t('search.noResults', { query: debouncedQuery })} />
                ) : (
                    <EmptyState icon={SearchIcon} text={t('search.enterQuery')} />
                )}
            </div>
        </div>
    );
}
