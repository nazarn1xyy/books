import { useMemo, useState, useEffect } from 'react';
import { BookCard } from '../components/BookCard';
import { getAppState } from '../utils/storage';
import { fetchBooks } from '../services/flibustaApi';
import type { Book } from '../types';

export function Home() {
    const state = getAppState();
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadBooks = async () => {
            try {
                // Flibusta doesn't list books without query, so search for something common
                // e.g. "Классика" or a popular author
                const fetchedBooks = await fetchBooks('Толстой');
                setBooks(fetchedBooks);
            } catch (error) {
                console.error('Failed to load books', error);
            } finally {
                setLoading(false);
            }
        };
        loadBooks();
    }, []);

    const booksInProgress = useMemo(() => {
        if (loading) return [];
        return Object.keys(state.readingProgress)
            .map((bookId) => {
                // Try to find in fetched books, or maybe we need to fetch specific IDs if not in list
                // For now, only if in list
                const book = books.find((b) => b.id === bookId);
                const progress = state.readingProgress[bookId];
                if (book && progress && progress.currentPage < progress.totalPages - 1) {
                    return { book, progress };
                }
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => (b?.progress.lastRead || 0) - (a?.progress.lastRead || 0))
            .slice(0, 5);
    }, [state.readingProgress, books, loading]);

    const recommendedBooks = useMemo(() => {
        return books
            .filter(book => !book.cover.includes('placehold.co'))
            .slice(0, 4);
    }, [books]);

    const recentBooks = useMemo(() => {
        return [...books].slice(4, 10);
    }, [books]);

    return (
        <div className="min-h-screen bg-black pb-24 pt-[env(safe-area-inset-top)]">
            <div className="px-5 pt-8">
                {/* Header */}
                {/* Header */}
                <header className="mb-6 mt-2">
                    <h1 className="text-3xl font-bold text-white">Библиотека</h1>
                </header>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
                    </div>
                ) : books.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-gray-400 mb-4">Не удалось загрузить рекомендации.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-white/10 rounded-full text-white text-sm hover:bg-white/20 transition-colors"
                        >
                            Попробовать снова
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Continue Reading */}
                        {booksInProgress.length > 0 && (
                            <section className="mb-8">
                                <h2 className="text-lg font-semibold text-white mb-4">Продолжить чтение</h2>
                                <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-5 px-5">
                                    {booksInProgress.map((item, index) => (
                                        <BookCard
                                            key={item!.book.id}
                                            book={item!.book}
                                            size="medium"
                                            showProgress
                                            priority={index < 2}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Recommended */}
                        {recommendedBooks.length > 0 && (
                            <section className="mb-8">
                                <h2 className="text-lg font-semibold text-white mb-4">Рекомендуем</h2>
                                <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-5 px-5">
                                    {recommendedBooks.map((book, index) => (
                                        <BookCard
                                            key={book.id}
                                            book={book}
                                            size="large"
                                            priority={index < 2}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Recently Added */}
                        <section className="mb-8">
                            <h2 className="text-lg font-semibold text-white mb-4">Недавно добавленные</h2>
                            <div className="grid grid-cols-3 gap-4">
                                {recentBooks.map((book) => (
                                    <BookCard key={book.id} book={book} size="small" />
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
