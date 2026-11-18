import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X, Loader2 } from 'lucide-react';
import { BookCard } from '@/entities/book/ui/BookCard';
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

    const active = debouncedQuery.length >= MIN_SEARCH_LENGTH;
    // A new query shows the spinner, not the previous query's results.
    const loading = active && (search.isLoading || search.isPlaceholderData);
    const results = active ? (search.data ?? []) : [];

    return (
        <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-black pt-[env(safe-area-inset-top)] overflow-hidden">
            {/* Fixed Search Header */}
            <header className="flex-shrink-0 bg-black/95 backdrop-blur-xl border-b border-white/10 px-5 pt-2 pb-4 lg:px-8 z-30">
                <div className="desktop-container">
                    <h1 className="text-2xl font-bold text-white mb-3 lg:text-3xl">{t('search.title')}</h1>
                    <div className="relative lg:max-w-xl">
                        <SearchIcon
                            size={20}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                            aria-hidden="true"
                        />
                        <input
                            type="search"
                            inputMode="search"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('search.placeholder')}
                            aria-label={t('search.title')}
                            className="w-full h-12 bg-[#1C1C1E] rounded-xl pl-12 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-base"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                aria-label={t('common.cancel')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
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
                        <Loader2 className="animate-spin text-gray-400 mb-4" size={32} />
                        <p className="text-gray-400">{t('search.searching')}</p>
                    </div>
                ) : active && search.isError ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <p className="text-gray-400 mb-4">{t('errors.networkError')}</p>
                        <button
                            onClick={() => void search.refetch()}
                            className="px-4 py-2 bg-white/10 rounded-full text-white text-sm hover:bg-white/20 transition-colors"
                        >
                            {t('common.retry')}
                        </button>
                    </div>
                ) : results.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-8 desktop-container">
                        {results.map((book) => (
                            <BookCard key={book.id} book={book} size="small" showActions />
                        ))}
                    </div>
                ) : active ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <SearchIcon size={48} className="text-gray-600 mb-4" />
                        <p className="text-gray-400 text-center">
                            {t('search.noResults', { query: debouncedQuery })}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                        <SearchIcon size={48} className="text-gray-700 mb-4" />
                        <p className="text-gray-500 text-center">
                            {t('search.enterQuery')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
