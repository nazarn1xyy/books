import { useMemo, useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { BookCard } from '../components/BookCard';
import { getAppState } from '../utils/storage';
import { fetchBooks } from '../services/flibustaApi';
import type { Book } from '../types';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

export function Home() {
    const state = getAppState();
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const { canInstall, promptInstall } = useInstallPrompt();
    const [showInstallBanner, setShowInstallBanner] = useState(true);

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
        <div className="min-h-screen bg-black pb-24 lg:pb-8 pt-[env(safe-area-inset-top)]">
            <div className="px-5 pt-8 desktop-container">
                {/* Header */}
                {/* Header */}
                <header className="mb-6 mt-2">
                    <h1 className="text-3xl font-bold text-white">Библиотека</h1>
                </header>

                {/* Install PWA Banner */}
                {canInstall && showInstallBanner && (
                    <div className="mb-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                        <Download className="text-blue-400 flex-shrink-0 mt-0.5" size={24} />
                        <div className="flex-1">
                            <h3 className="text-white font-semibold mb-1">Установить приложение</h3>
                            <p className="text-gray-300 text-sm mb-3">Добавьте Libify на главный экран для быстрого доступа</p>
                            <button
                                onClick={async () => {
                                    const success = await promptInstall();
                                    if (success) setShowInstallBanner(false);
                                }}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-lg text-sm font-medium transition-all"
                            >
                                Установить
                            </button>
                        </div>
                        <button
                            onClick={() => setShowInstallBanner(false)}
                            className="text-gray-400 hover:text-white transition-colors p-1 active:scale-95"
                            aria-label="Закрыть"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}

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
                                <h2 className="text-lg font-semibold text-white mb-4 lg:text-xl">Продолжить чтение</h2>
                                <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:overflow-visible">
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
                                <h2 className="text-lg font-semibold text-white mb-4 lg:text-xl">Рекомендуем</h2>
                                <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:overflow-visible">
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
                            <h2 className="text-lg font-semibold text-white mb-4 lg:text-xl">Недавно добавленные</h2>
                            <div className="grid grid-cols-3 gap-4 lg:grid-cols-4 xl:grid-cols-6">
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
