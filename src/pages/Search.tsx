import { useState, useEffect } from 'react';
import { Search as SearchIcon, X, Loader2 } from 'lucide-react';
import { fetchBooks } from '../services/flibustaApi';
import { BookCard } from '../components/BookCard';
import type { Book } from '../types';

export function Search() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Book[]>([]);
    const [loading, setLoading] = useState(false);
    const [debouncedQuery, setDebouncedQuery] = useState('');

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
                console.log('Restoring search from cache:', debouncedQuery);
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

    return (
        <div className="min-h-screen bg-black pb-24 pt-[env(safe-area-inset-top)]">
            <div className="px-5 pt-8">
                {/* Search Header */}
                <header className="mb-6">
                    <h1 className="text-3xl font-bold text-white mb-4">Поиск</h1>

                    {/* Search Input */}
                    <div className="relative">
                        <SearchIcon
                            size={20}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Книги, авторы, жанры..."
                            aria-label="Поиск книг"
                            className="w-full h-12 bg-[#1C1C1E] rounded-xl pl-12 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                aria-label="Очистить поиск"
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors active:scale-90"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </header>

                {/* Results */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="animate-spin text-gray-400 mb-4" size={32} />
                        <p className="text-gray-400">Ищем на Флибусте...</p>
                    </div>
                ) : results.length > 0 ? (
                    <div className="grid grid-cols-3 gap-4">
                        {results.map((book) => (
                            <BookCard key={book.id} book={book} size="small" />
                        ))}
                    </div>
                ) : debouncedQuery ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <SearchIcon size={48} className="text-gray-600 mb-4" />
                        <p className="text-gray-400 text-center">
                            По запросу «{debouncedQuery}»<br />ничего не найдено
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                        <SearchIcon size={48} className="text-gray-700 mb-4" />
                        <p className="text-gray-500 text-center">
                            Введите название книги<br />или автора
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
