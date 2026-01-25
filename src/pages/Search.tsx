import { useState, useEffect } from 'react';
import { Search as SearchIcon, X, Loader2 } from 'lucide-react';
import { fetchBooks } from '../services/flibustaApi';
import { BookCard } from '../components/BookCard';
import type { Book } from '../types';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useLanguage } from '../contexts/LanguageContext';

export function Search() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Book[]>([]);
    const [loading, setLoading] = useState(false);
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const { isKeyboardOpen, keyboardHeight } = useKeyboardHeight();
    const { t } = useLanguage();

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 800);
        return () => clearTimeout(timer);
    }, [query]);

    // Fetch books when debounced query changes
    useEffect(() => {
        const searchBooks = async () => {
            if (!debouncedQuery.trim()) {
                setResults([]);
                return;
            }

            // Check session cache
            const cacheKey = `search_cache_${debouncedQuery.trim()}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                setResults(JSON.parse(cached));
                return;
            }

            setLoading(true);
            try {
                const books = await fetchBooks(debouncedQuery);
                setResults(books);
                // Save to cache
                if (books.length > 0) {
                    sessionStorage.setItem(cacheKey, JSON.stringify(books));
                }
            } catch (error) {
                console.error('Search failed:', error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        searchBooks();
    }, [debouncedQuery]);

    // Determine if scrolling should be allowed
    const hasResults = results.length > 0;
    const shouldAllowScroll = hasResults && !isKeyboardOpen;

    return (
        <div
            className="bg-black pt-[env(safe-area-inset-top)] overflow-hidden"
            style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Fixed Search Header */}
            <header className="flex-shrink-0 bg-black px-5 pt-8 pb-4 desktop-container">
                <h1 className="text-3xl font-bold text-white mb-4 lg:text-4xl">{t('search.title')}</h1>
                <div className="relative lg:max-w-xl">
                    <SearchIcon
                        size={20}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
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
                        className="w-full h-12 bg-[#1C1C1E] rounded-xl pl-12 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
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
            </header>

            {/* Scrollable Results Area */}
            <div
                className="flex-1 px-5"
                style={{
                    overflowY: shouldAllowScroll ? 'auto' : 'hidden',
                    paddingBottom: isKeyboardOpen ? keyboardHeight : 96, // 96 = bottom nav height + padding
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="animate-spin text-gray-400 mb-4" size={32} />
                        <p className="text-gray-400">{t('search.searching')}</p>
                    </div>
                ) : results.length > 0 ? (
                    <div className="grid grid-cols-3 gap-4 pb-4 lg:grid-cols-4 xl:grid-cols-6 desktop-container">
                        {results.map((book) => (
                            <BookCard key={book.id} book={book} size="small" />
                        ))}
                    </div>
                ) : debouncedQuery ? (
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
