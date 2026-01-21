import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Trash2, ChevronLeft, Download, Heart, MessageSquareQuote, Library } from 'lucide-react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import type { Book, Quote, Favorite } from '../types';
import { books } from '../data/books';
import { getMyBookIds, getReadingProgress, getBookMetadata, addToMyBooks, removeFromMyBooks, addToPendingDeletions } from '../utils/storage';
import { ProgressBar } from '../components/ProgressBar';
import { ImageWithLoader } from '../components/ImageWithLoader';
import { parseBookData } from '../services/flibustaApi';
import { cacheBook } from '../utils/cache';
import { useAuth } from '../contexts/AuthContext';
import { removeBookFromCloud } from '../utils/sync';
import { useBookCover } from '../hooks/useBookCover';
import { exportAllBooks } from '../utils/export';
import { getFavorites, getQuotes, removeFavorite, deleteQuote } from '../services/db';

type TabType = 'books' | 'favorites' | 'quotes';

export function MyBooks() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [myBookIds, setMyBookIds] = useState(getMyBookIds());
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, bookTitle: '' });

    // Tabs
    const [activeTab, setActiveTab] = useState<TabType>('books');
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Refresh books when storage changes (e.g. from Realtime sync)
    useEffect(() => {
        const handleStorageUpdate = () => {
            setMyBookIds(getMyBookIds());
        };

        window.addEventListener('storage-update', handleStorageUpdate);
        return () => window.removeEventListener('storage-update', handleStorageUpdate);
    }, []);

    // Fetch favorites and quotes when user is logged in
    useEffect(() => {
        if (!user) {
            setFavorites([]);
            setQuotes([]);
            return;
        }

        const fetchData = async () => {
            setLoadingData(true);
            try {
                const [favs, qs] = await Promise.all([
                    getFavorites(),
                    getQuotes()
                ]);
                setFavorites(favs);
                setQuotes(qs);
            } catch (err) {
                console.error('Failed to fetch favorites/quotes:', err);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
    }, [user]);

    // Handle delete quote
    const handleDeleteQuote = async (id: string) => {
        if (!window.confirm('Удалить эту цитату?')) return;
        try {
            await deleteQuote(id);
            setQuotes(prev => prev.filter(q => q.id !== id));
        } catch (err) {
            console.error('Failed to delete quote:', err);
        }
    };

    // Handle remove favorite
    const handleRemoveFavorite = async (bookId: string) => {
        if (!window.confirm('Удалить из избранного?')) return;
        try {
            await removeFavorite(bookId);
            setFavorites(prev => prev.filter(f => f.book_id !== bookId));
        } catch (err) {
            console.error('Failed to remove favorite:', err);
        }
    };

    const items = useMemo(() => {
        const singles: { book: Book; progress: any }[] = [];
        const seriesMap = new Map<string, { book: Book; progress: any }[]>();

        myBookIds.forEach((id) => {
            const book = books.find((b) => b.id === id) || getBookMetadata(id);
            const progress = getReadingProgress(id);
            if (!book) return;
            const item = { book, progress };

            if (book.series) {
                if (!seriesMap.has(book.series)) {
                    seriesMap.set(book.series, []);
                }
                seriesMap.get(book.series)!.push(item);
            } else {
                singles.push(item);
            }
        });

        // Combine
        const result: (({ type: 'book'; data: { book: Book; progress: any } } | { type: 'series'; name: string; books: { book: Book; progress: any }[] }))[] = [];

        singles.forEach(s => result.push({ type: 'book', data: s }));

        seriesMap.forEach((seriesBooks, name) => {
            // Sort books inside series by number
            seriesBooks.sort((a, b) => (a.book.seriesNumber || 0) - (b.book.seriesNumber || 0));
            result.push({ type: 'series', name, books: seriesBooks });
        });

        // Sort entire list by lastRead (max of series)
        return result.sort((a, b) => {
            const getTimestamp = (item: typeof result[0]) => {
                if (item.type === 'book') return item.data.progress?.lastRead || 0;
                // For series, find the most recently read book
                return Math.max(...item.books.map(b => b.progress?.lastRead || 0));
            };
            return getTimestamp(b) - getTimestamp(a);
        });

    }, [myBookIds]);

    const handleRemove = async (bookId: string) => {
        if (window.confirm('Удалить эту книгу из списка?')) {
            // Optimistically remove locally
            removeFromMyBooks(bookId);
            setMyBookIds(getMyBookIds());
            addToPendingDeletions(bookId);
            if (user) {
                removeBookFromCloud(user.id, bookId).then(() => { });
            }
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const buffer = await file.arrayBuffer();
            const isPdf = file.name.toLowerCase().endsWith('.pdf');
            const newBookId = `local-${Date.now()}`;

            let title = file.name.replace(/\.(fb2(\.zip)?|pdf)$/i, '');
            let author = 'Unknown Author';
            let cover = '';
            let description = '';
            let format: 'fb2' | 'pdf' = 'fb2';
            let text = '';
            let series = undefined;
            let seriesNumber = undefined;

            if (isPdf) {
                format = 'pdf';
                cover = 'https://placehold.co/300x450?text=PDF';
                await cacheBook(newBookId, '', cover, buffer);
            } else {
                const parsed = await parseBookData(buffer);
                text = parsed.text;
                // Use parsed title if valid, otherwise fallback to filename (cleaned up)
                if (parsed.title && parsed.title !== 'Без названия' && parsed.title.trim() !== '') {
                    title = parsed.title;
                } else {
                    // Clean up filename title: replace underscores with spaces
                    title = title.replace(/_/g, ' ');
                }

                author = parsed.author || author;
                cover = parsed.cover || 'https://placehold.co/300x450?text=Wait...';
                description = parsed.description || description;
                series = parsed.series;
                seriesNumber = parsed.seriesNumber;

                await cacheBook(newBookId, text, cover);
            }

            const newBook: Book = {
                id: newBookId,
                title,
                author,
                cover,
                description,
                genre: 'Local',
                contentUrl: 'local',
                format,
                series,
                seriesNumber
            };

            addToMyBooks(newBook);
            setMyBookIds(getMyBookIds());

        } catch (error) {
            console.error('Failed to upload book:', error);
            alert('Не удалось открыть файл. Поддерживаются FB2, FB2.ZIP и PDF.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Helper to open/close series
    const toggleSeries = (name: string) => {
        if (expandedSeries === name) setExpandedSeries(null);
        else setExpandedSeries(name);
    };

    const handleExportAll = async () => {
        if (myBookIds.length === 0) {
            alert('Нет книг для экспорта!');
            return;
        }

        setIsExporting(true);
        try {
            await exportAllBooks(myBookIds, (progress) => {
                setExportProgress(progress);
            });
        } catch (error) {
            console.error('Export failed:', error);
            alert(error instanceof Error ? error.message : 'Не удалось экспортировать книги');
        } finally {
            setIsExporting(false);
            setExportProgress({ current: 0, total: 0, bookTitle: '' });
        }
    };

    return (
        <div className="min-h-screen bg-black pb-24 pt-[env(safe-area-inset-top)] relative overflow-hidden">
            <div className="px-5 pt-8">
                {/* Header */}
                <header className="mb-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">
                            {activeTab === 'books' ? 'Мои книги' : activeTab === 'favorites' ? 'Избранное' : 'Цитаты'}
                        </h1>
                        {activeTab === 'books' && myBookIds.length > 0 && (
                            <p className="text-gray-500 mt-1">{myBookIds.length} книг</p>
                        )}
                        {activeTab === 'favorites' && (
                            <p className="text-gray-500 mt-1">{favorites.length} книг</p>
                        )}
                        {activeTab === 'quotes' && (
                            <p className="text-gray-500 mt-1">{quotes.length} цитат</p>
                        )}
                    </div>
                    {activeTab === 'books' && myBookIds.length > 0 && (
                        <button
                            onClick={handleExportAll}
                            disabled={isExporting}
                            className="p-3 min-w-[44px] min-h-[44px] bg-white/10 hover:bg-white/20 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
                            title="Экспортировать все книги"
                            aria-label="Экспортировать все книги"
                        >
                            <Download size={20} className="text-white" />
                        </button>
                    )}
                </header>

                {/* Tab Bar */}
                {user && (
                    <div className="flex gap-2 mb-6 overflow-x-auto py-1 -mx-1 px-1">
                        <button
                            onClick={() => setActiveTab('books')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === 'books'
                                ? 'bg-white text-black'
                                : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            <Library size={18} />
                            <span className="font-medium">Книги</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('favorites')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === 'favorites'
                                ? 'bg-red-500 text-white'
                                : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            <Heart size={18} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} />
                            <span className="font-medium">Избранное</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('quotes')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === 'quotes'
                                ? 'bg-purple-500 text-white'
                                : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            <MessageSquareQuote size={18} />
                            <span className="font-medium">Цитаты</span>
                        </button>
                    </div>
                )}

                {/* Export Progress Modal */}
                {isExporting && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-[#1C1C1E] rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <Download className="text-blue-400 animate-bounce" size={28} />
                                <h2 className="text-xl font-semibold text-white">Экспорт библиотеки</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-400 text-sm mb-2">Упаковка книг...</p>
                                    <ProgressBar percentage={Math.round((exportProgress.current / exportProgress.total) * 100)} height={6} />
                                </div>
                                <p className="text-gray-500 text-xs truncate">
                                    {exportProgress.current} / {exportProgress.total}: {exportProgress.bookTitle}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Book List - only show when books tab is active */}
                {activeTab === 'books' && items.length > 0 && (
                    <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {items.map((item) => {
                                if (item.type === 'book') {
                                    return (
                                        <BookListItem
                                            key={item.data.book.id}
                                            book={item.data.book}
                                            onRemove={() => handleRemove(item.data.book.id)}
                                        />
                                    );
                                } else {
                                    // Series Folder
                                    const isExpanded = expandedSeries === item.name;
                                    return (
                                        <div key={`series-${item.name}`} className="space-y-4">
                                            <div
                                                onClick={() => toggleSeries(item.name)}
                                                className="bg-[#1C1C1E]/50 border border-white/5 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer"
                                            >
                                                <div className="w-16 h-24 bg-[#2C2C2E] rounded-lg flex items-center justify-center text-white/20">
                                                    <div className="flex flex-col items-center">
                                                        {/* Stack effect */}
                                                        <div className="w-10 h-10 border-2 border-white/20 rounded mb-1 bg-[#3A3A3C]"></div>
                                                        <div className="w-12 h-1 bg-white/20 rounded-full"></div>
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-white text-lg">{item.name}</h3>
                                                    <p className="text-sm text-gray-500">{item.books.length} книг</p>
                                                </div>
                                                <div className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                    <ChevronLeft size={20} className="rotate-180" />
                                                </div>
                                            </div>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="pl-4 space-y-4 border-l-2 border-white/10 ml-8"
                                                >
                                                    {item.books.map(b => (
                                                        <BookListItem
                                                            key={b.book.id}
                                                            book={b.book}
                                                            onRemove={() => handleRemove(b.book.id)}
                                                        />
                                                    ))}
                                                </motion.div>
                                            )}
                                        </div>
                                    );
                                }
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {activeTab === 'books' && items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <BookOpen size={48} className="text-gray-600 mb-4" />
                        <p className="text-gray-500 text-center">
                            Здесь пока пусто<br />
                            Начните читать книгу или добавьте свою
                        </p>
                    </div>
                )}

                {/* Favorites List */}
                {activeTab === 'favorites' && (
                    <>
                        {loadingData ? (
                            <div className="flex justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
                            </div>
                        ) : favorites.length > 0 ? (
                            <div className="space-y-4">
                                {favorites.map((fav) => (
                                    <div
                                        key={fav.id}
                                        className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 flex items-center gap-4"
                                    >
                                        <div
                                            className="w-16 h-20 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer"
                                            onClick={() => navigate(`/reader/${fav.book_id}`)}
                                        >
                                            <img
                                                src={fav.book_cover || 'https://placehold.co/300x450?text=No+Cover'}
                                                alt={fav.book_title || ''}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/reader/${fav.book_id}`)}>
                                            <h3 className="text-white font-semibold truncate">{fav.book_title || 'Без названия'}</h3>
                                            <p className="text-gray-500 text-sm truncate">{fav.book_author || 'Неизвестный автор'}</p>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveFavorite(fav.book_id)}
                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                            aria-label="Удалить из избранного"
                                        >
                                            <Heart size={20} fill="currentColor" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Heart size={48} className="text-gray-600 mb-4" />
                                <p className="text-gray-500 text-center">
                                    Здесь пока пусто<br />
                                    Добавляйте книги в избранное
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* Quotes List */}
                {activeTab === 'quotes' && (
                    <>
                        {loadingData ? (
                            <div className="flex justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
                            </div>
                        ) : quotes.length > 0 ? (
                            <div className="space-y-4">
                                {quotes.map((quote) => (
                                    <div
                                        key={quote.id}
                                        className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4"
                                    >
                                        <p className="text-white text-sm leading-relaxed mb-3 italic">
                                            "{quote.text}"
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div
                                                className="text-gray-500 text-xs cursor-pointer hover:text-gray-300"
                                                onClick={() => navigate(`/reader/${quote.book_id}`)}
                                            >
                                                <span className="font-medium">{quote.book_title || 'Книга'}</span>
                                                {quote.book_author && ` — ${quote.book_author}`}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteQuote(quote.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                aria-label="Удалить цитату"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16">
                                <MessageSquareQuote size={48} className="text-gray-600 mb-4" />
                                <p className="text-gray-500 text-center">
                                    Здесь пока пусто<br />
                                    Выделяйте текст в книгах и сохраняйте цитаты
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Upload Button */}
            <div className="fixed bottom-32 right-5 z-20 pb-[env(safe-area-inset-bottom)]">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".fb2,.zip,.fb2.zip,.pdf"
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-14 h-14 min-w-[56px] min-h-[56px] bg-white text-black rounded-full flex items-center justify-center shadow-lg shadow-white/10 active:scale-90 transition-transform disabled:opacity-50"
                    aria-label="Добавить книгу"
                >
                    {isUploading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-black border-t-transparent" />
                    ) : (
                        <Plus size={28} />
                    )}
                </button>
            </div>
        </div>
    );
}

function BookListItem({ book, onRemove }: { book: Book; onRemove: () => void }) {
    const navigate = useNavigate();
    const progress = getReadingProgress(book.id);

    const percentage = progress?.scrollPercentage ?? (
        progress && progress.totalPages > 0
            ? Math.round(((progress.currentPage + 1) / progress.totalPages) * 100)
            : 0
    );

    const [isDragging, setIsDragging] = useState(false);
    const [swiped, setSwiped] = useState(false);
    const coverSrc = useBookCover(book.id, book.cover);

    const handleDragEnd = (_e: any, info: PanInfo) => {
        setIsDragging(false);
        // More conservative threshold: -150px AND minimum velocity
        if (info.offset.x < -150 && Math.abs(info.velocity.x) > 200) {
            setSwiped(true);
            // Haptic feedback on successful swipe
            if ('vibrate' in navigator) {
                navigator.vibrate(10);
            }
            // Trigger remove logic
            onRemove();
        } else {
            setSwiped(false);
        }
    };

    return (
        <div className="relative group">
            {/* Delete Background Layer */}
            <div className="absolute inset-y-0 right-0 w-full bg-red-600 rounded-2xl flex items-center justify-end px-6 z-0">
                <Trash2 className="text-white" size={24} />
            </div>

            {/* Swipeable Card */}
            <motion.div
                layout
                drag="x"
                dragConstraints={{ left: -200, right: 0 }}
                dragElastic={0.15}
                dragDirectionLock
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                    if (!isDragging && !swiped) {
                        navigate(`/reader/${book.id}`);
                    }
                }}
                className="relative bg-[#1C1C1E] rounded-2xl z-10 touch-pan-y select-none"
                style={{ width: '100%', overscrollBehavior: 'contain' }}
                exit={{ height: 0, opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                whileDrag={{ cursor: "grabbing" }}
            >
                <div className="flex gap-4 p-4 pointer-events-none select-none">
                    <ImageWithLoader
                        src={coverSrc}
                        alt={book.title}
                        loading="lazy"
                        className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
                        wrapperClassName="w-16 h-24 rounded-lg flex-shrink-0 bg-[#2C2C2E]"
                    />
                    <div className="flex-1 flex flex-col justify-between text-left py-1">
                        <div>
                            <h3 className="font-semibold text-white line-clamp-2">{book.title || 'Без названия'}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{book.author || 'Неизвестный автор'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <ProgressBar percentage={percentage} height={4} />
                            </div>
                            <span className="text-xs text-gray-400 font-medium">{percentage}%</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
