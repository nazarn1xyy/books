import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Trash2, ChevronLeft, Download, Heart, MessageSquareQuote, Library, Bookmark, Copy, Check } from 'lucide-react';
import type { Book, Quote, Favorite, Bookmark as BookmarkType } from '@/entities/book/model/types';
import { getMyBookIds, getAppState, getReadingProgress, addToMyBooks, removeFromMyBooks } from '@/shared/storage/storage';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { ImageWithLoader } from '@/entities/book/ui/ImageWithLoader';
import { parseBookData } from '@/shared/catalog/flibustaApi';
import { cacheBook } from '@/shared/catalog/bookCache';
import { useAuth } from '@/features/auth';
import { SyncStatusBadge } from '@/shared/ui/SyncStatusBadge';
import { useReplicaVersion } from '@/shared/sync/useReplicaVersion';
import { useBookCover } from '@/entities/book/lib/useBookCover';
import { useSwipeToRemove } from '../model/useSwipeToRemove';
import { exportAllBooks } from '@/shared/lib/export';
import { getFavorites, getQuotes, removeFavorite, deleteQuote, getBookmarks, deleteBookmark } from '@/shared/storage/collections';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { LANGUAGES } from '@/shared/i18n/languages';

type TabType = 'books' | 'favorites' | 'quotes' | 'bookmarks';

export function MyBooksPage() {
    const { user } = useAuth();
    const replicaVersion = useReplicaVersion();
    const { t, language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const [myBookIds, setMyBookIds] = useState(getMyBookIds());
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, bookTitle: '' });

    const [pendingDelete, setPendingDelete] = useState<{ label: string; onConfirm: () => void } | null>(null);
    const confirmDelete = (label: string, onConfirm: () => void) => setPendingDelete({ label, onConfirm });
    const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);
    const copyQuote = (id: string, text: string) => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopiedQuoteId(id);
        setTimeout(() => setCopiedQuoteId(null), 2000);
    };

    // Sort
    const [sortBy, setSortBy] = useState<'date' | 'title' | 'author'>('date');

    // Tabs
    const [activeTab, setActiveTab] = useState<TabType>('books');
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Refresh books when storage changes
    useEffect(() => {
        const handleStorageUpdate = () => {
            setMyBookIds(getMyBookIds());
        };

        window.addEventListener('storage-update', handleStorageUpdate);
        return () => window.removeEventListener('storage-update', handleStorageUpdate);
    }, []);

    // Fetch favorites, quotes, and bookmarks when user is logged in
    useEffect(() => {
        // The page is only reachable signed in; on sign-out it unmounts.
        if (!user) return;

        const fetchData = async () => {
            setLoadingData(true);
            try {
                const [favs, qs, bms] = await Promise.all([
                    getFavorites(),
                    getQuotes(),
                    getBookmarks()
                ]);
                setFavorites(favs);
                setQuotes(qs);
                setBookmarks(bms);
            } catch {
                // Ignore fetch errors
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
    }, [user, replicaVersion]);

    const handleDeleteQuote = (id: string) => confirmDelete(t('aria.deleteQuote') + '?', async () => {
        try {
            await deleteQuote(id);
            setQuotes(prev => prev.filter(q => q.id !== id));
        } catch {
            // Ignore
        }
    });

    const handleRemoveFavorite = (bookId: string) => confirmDelete(t('aria.removeFavorite') + '?', async () => {
        try {
            await removeFavorite(bookId);
            setFavorites(prev => prev.filter(f => f.book_id !== bookId));
        } catch {
            // Ignore
        }
    });

    const handleDeleteBookmark = (id: string) => confirmDelete(t('aria.deleteBookmark') + '?', async () => {
        try {
            await deleteBookmark(id);
            setBookmarks(prev => prev.filter(b => b.id !== id));
        } catch {
            // Ignore
        }
    });

    const items = useMemo(() => {
        const singles: { book: Book; progress: ReturnType<typeof getReadingProgress> }[] = [];
        const seriesMap = new Map<string, { book: Book; progress: ReturnType<typeof getReadingProgress> }[]>();

        const state = getAppState();
        myBookIds.forEach((id) => {
            const book = state.bookMetadata[id];
            const progress = state.readingProgress[id] || null;
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
        const result: (({ type: 'book'; data: { book: Book; progress: ReturnType<typeof getReadingProgress> } } | { type: 'series'; name: string; books: { book: Book; progress: ReturnType<typeof getReadingProgress> }[] }))[] = [];

        singles.forEach(s => result.push({ type: 'book', data: s }));

        seriesMap.forEach((seriesBooks, name) => {
            seriesBooks.sort((a, b) => (a.book.seriesNumber || 0) - (b.book.seriesNumber || 0));
            result.push({ type: 'series', name, books: seriesBooks });
        });

        return result.sort((a, b) => {
            const label = (item: typeof result[0]) =>
                item.type === 'book' ? item.data.book : item.books[0]?.book;

            if (sortBy === 'title') {
                return (label(a)?.title || '').localeCompare(label(b)?.title || '', undefined, { sensitivity: 'base' });
            }
            if (sortBy === 'author') {
                return (label(a)?.author || '').localeCompare(label(b)?.author || '', undefined, { sensitivity: 'base' });
            }
            const ts = (item: typeof result[0]) =>
                item.type === 'book' ? item.data.progress?.lastRead || 0
                    : Math.max(...item.books.map(b => b.progress?.lastRead || 0));
            return ts(b) - ts(a);
        });
    }, [myBookIds, sortBy]);

    const handleRemove = (bookId: string) => {
        confirmDelete(t('common.delete') + '?', () => {
            removeFromMyBooks(bookId);
            setMyBookIds(getMyBookIds());
        });
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
                cover = '';
                await cacheBook(newBookId, '', cover, buffer);
            } else {
                const parsed = await parseBookData(buffer);
                text = parsed.text;
                if (parsed.title && parsed.title !== 'Без назви' && parsed.title !== 'Без названия' && parsed.title.trim() !== '') {
                    title = parsed.title;
                } else {
                    title = title.replace(/_/g, ' ');
                }

                author = parsed.author || author;
                cover = parsed.cover || '';
                description = parsed.description || description;
                series = parsed.series;
                seriesNumber = parsed.seriesNumber;

                await cacheBook(newBookId, text, cover, undefined, {
                    title: parsed.title,
                    author: parsed.author,
                    series: parsed.series,
                    seriesNumber: parsed.seriesNumber,
                    chapters: parsed.chapters,
                });
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
        } catch {
            setUploadError(t('errors.networkError'));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const toggleSeries = (name: string) => {
        if (expandedSeries === name) setExpandedSeries(null);
        else setExpandedSeries(name);
    };

    const handleExportAll = async () => {
        if (myBookIds.length === 0) {
            setUploadError(t('myBooks.noBooks'));
            return;
        }

        setIsExporting(true);
        try {
            await exportAllBooks(myBookIds, (progress) => {
                setExportProgress(progress);
            });
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : t('common.error'));
        } finally {
            setIsExporting(false);
            setExportProgress({ current: 0, total: 0, bookTitle: '' });
        }
    };

    return (
        <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-black pt-[env(safe-area-inset-top)] overflow-hidden relative">
            {/* Pinned Fixed Header */}
            <div className="flex-shrink-0 bg-black/95 backdrop-blur-xl border-b border-white/10 pt-2 pb-3 z-30">
                <div className="px-5 desktop-container">
                    {/* Header */}
                    <header className="mb-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-2xl font-bold text-white lg:text-3xl truncate">
                                {activeTab === 'books' ? t('myBooks.title') : activeTab === 'favorites' ? t('myBooks.favorites') : activeTab === 'quotes' ? t('myBooks.quotes') : t('myBooks.bookmarks')}
                            </h1>
                            <SyncStatusBadge className="lg:hidden mt-0.5" />
                            {activeTab === 'books' && myBookIds.length > 0 && (
                                <p className="text-gray-500 text-xs mt-0.5">{t('myBooks.booksCount', { count: myBookIds.length })}</p>
                            )}
                            {activeTab === 'favorites' && (
                                <p className="text-gray-500 text-xs mt-0.5">{t('myBooks.booksCount', { count: favorites.length })}</p>
                            )}
                            {activeTab === 'quotes' && (
                                <p className="text-gray-500 text-xs mt-0.5">{quotes.length} {t('myBooks.quotes').toLowerCase()}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Language Switcher */}
                            <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/5" role="group" aria-label={t('language.title')}>
                                {LANGUAGES.map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => setLanguage(lang.code)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 ${language === lang.code
                                            ? 'bg-white text-black shadow-sm'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                        title={lang.name}
                                        aria-label={lang.name}
                                    >
                                        <span className="text-xs leading-none">{lang.flag}</span>
                                        <span className="uppercase text-[11px] font-bold">{lang.code}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Export All Button */}
                            {activeTab === 'books' && myBookIds.length > 0 && (
                                <button
                                    onClick={handleExportAll}
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

                    {/* Sort Bar */}
                    {activeTab === 'books' && items.length > 1 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide py-0.5 -mx-5 px-5 after:content-[''] after:w-1 after:flex-shrink-0" role="group" aria-label={t('sort.byDate')}>
                            {([
                                { key: 'date', label: t('sort.byDate') },
                                { key: 'title', label: t('sort.byTitle') },
                                { key: 'author', label: t('sort.byAuthor') },
                            ] as const).map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => setSortBy(s.key)}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${sortBy === s.key ? 'bg-white text-black font-semibold' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Tab Bar with ARIA */}
                    {user && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-5 px-5 after:content-[''] after:w-1 after:flex-shrink-0" role="tablist" aria-label="Sections">
                            <button
                                role="tab"
                                aria-selected={activeTab === 'books'}
                                aria-controls="panel-books"
                                onClick={() => setActiveTab('books')}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm transition-all whitespace-nowrap ${activeTab === 'books'
                                    ? 'bg-white text-black font-semibold shadow-sm'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                            >
                                <Library size={16} aria-hidden="true" />
                                <span>{t('myBooks.books')}</span>
                            </button>
                            <button
                                role="tab"
                                aria-selected={activeTab === 'favorites'}
                                aria-controls="panel-favorites"
                                onClick={() => setActiveTab('favorites')}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm transition-all whitespace-nowrap ${activeTab === 'favorites'
                                    ? 'bg-red-500 text-white font-semibold shadow-sm'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                            >
                                <Heart size={16} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} aria-hidden="true" />
                                <span>{t('myBooks.favorites')}</span>
                            </button>
                            <button
                                role="tab"
                                aria-selected={activeTab === 'quotes'}
                                aria-controls="panel-quotes"
                                onClick={() => setActiveTab('quotes')}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm transition-all whitespace-nowrap ${activeTab === 'quotes'
                                    ? 'bg-purple-500 text-white font-semibold shadow-sm'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                            >
                                <MessageSquareQuote size={16} aria-hidden="true" />
                                <span>{t('myBooks.quotes')}</span>
                            </button>
                            <button
                                role="tab"
                                aria-selected={activeTab === 'bookmarks'}
                                aria-controls="panel-bookmarks"
                                onClick={() => setActiveTab('bookmarks')}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm transition-all whitespace-nowrap ${activeTab === 'bookmarks'
                                    ? 'bg-blue-500 text-white font-semibold shadow-sm'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                            >
                                <Bookmark size={16} aria-hidden="true" />
                                <span>{t('myBooks.bookmarks')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div
                className="flex-1 px-5 pt-4 pb-28 overflow-y-auto overflow-x-hidden touch-pan-y desktop-container"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >

                {/* Export Progress Modal */}
                {isExporting && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#1C1C1E] rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/10">
                            <div className="flex items-center gap-3 mb-4">
                                <Download className="text-blue-400 animate-bounce" size={24} />
                                <h2 className="text-lg font-semibold text-white">{t('myBooks.exportTitle')}</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-400 text-xs mb-2">{t('myBooks.exportPacking')}</p>
                                    <ProgressBar percentage={Math.round((exportProgress.current / exportProgress.total) * 100)} height={6} />
                                </div>
                                <p className="text-gray-500 text-xs truncate">
                                    {exportProgress.current} / {exportProgress.total}: {exportProgress.bookTitle}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Book List Tab */}
                {activeTab === 'books' && (
                    <div id="panel-books" role="tabpanel">
                        {items.length > 0 ? (
                            <div className="space-y-4">
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
                                            const isExpanded = expandedSeries === item.name;
                                            return (
                                                <div key={`series-${item.name}`} className="space-y-4">
                                                    <div
                                                        onClick={() => toggleSeries(item.name)}
                                                        className="bg-[#1C1C1E]/50 border border-white/5 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer"
                                                    >
                                                        <div className="w-16 h-24 bg-[#2C2C2E] rounded-lg flex items-center justify-center text-white/20">
                                                            <div className="flex flex-col items-center">
                                                                <div className="w-10 h-10 border-2 border-white/20 rounded mb-1 bg-[#3A3A3C]"></div>
                                                                <div className="w-12 h-1 bg-white/20 rounded-full"></div>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className="font-semibold text-white text-lg">{item.name}</h3>
                                                            <p className="text-sm text-gray-500">{item.books.length} {t('myBooks.books').toLowerCase()}</p>
                                                        </div>
                                                        <div className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                            <ChevronLeft size={20} className="rotate-180" />
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="pl-4 space-y-4 border-l-2 border-white/10 ml-8 animate-page-in">
                                                            {item.books.map(b => (
                                                                <BookListItem
                                                                    key={b.book.id}
                                                                    book={b.book}
                                                                    onRemove={() => handleRemove(b.book.id)}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                    })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16">
                                <BookOpen size={48} className="text-gray-600 mb-4" />
                                <p className="text-gray-500 text-center">{t('myBooks.noBooks')}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Favorites List */}
                {activeTab === 'favorites' && (
                    <div id="panel-favorites" role="tabpanel">
                        {loadingData ? (
                            <div className="flex justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
                            </div>
                        ) : favorites.length > 0 ? (
                            <div className="space-y-4">
                                {favorites.map((fav) => (
                                    <div
                                        key={fav.id}
                                        className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] transition-all"
                                        onClick={() => navigate(`/reader/${fav.book_id}`)}
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <ImageWithLoader
                                                src={fav.book_cover}
                                                alt={fav.book_title}
                                                fallbackTitle={fav.book_title}
                                                fallbackAuthor={fav.book_author}
                                                size="sm"
                                                className="w-12 h-16 rounded-lg object-cover flex-shrink-0"
                                                wrapperClassName="w-12 h-16 rounded-lg flex-shrink-0 bg-[#2C2C2E]"
                                            />
                                            <div className="min-w-0">
                                                <h3 className="text-white font-semibold text-sm truncate">{fav.book_title}</h3>
                                                <p className="text-gray-400 text-xs truncate mt-0.5">{fav.book_author}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFavorite(fav.book_id);
                                            }}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                            aria-label={t('aria.removeFavorite')}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Heart size={48} className="text-gray-600 mb-4" />
                                <p className="text-gray-500 text-center">{t('myBooks.noBooks')}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Quotes List */}
                {activeTab === 'quotes' && (
                    <div id="panel-quotes" role="tabpanel">
                        {loadingData ? (
                            <div className="flex justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
                            </div>
                        ) : quotes.length > 0 ? (
                            <div className="space-y-4">
                                {quotes.map((quote) => (
                                    <div
                                        key={quote.id}
                                        className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-5"
                                    >
                                        <p className="text-white text-sm font-serif italic leading-relaxed mb-4">
                                            "{quote.text}"
                                        </p>
                                        <div className="flex items-center justify-between border-t border-white/10 pt-3">
                                            <div>
                                                <p className="text-white font-medium text-xs truncate">{quote.book_title}</p>
                                                <p className="text-gray-500 text-[11px] truncate">{quote.book_author}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => copyQuote(quote.id, quote.text)}
                                                    className="p-2 text-gray-400 hover:text-white transition-colors"
                                                    aria-label="Copy quote"
                                                >
                                                    {copiedQuoteId === quote.id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteQuote(quote.id)}
                                                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                                    aria-label={t('aria.deleteQuote')}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16">
                                <MessageSquareQuote size={48} className="text-gray-600 mb-4" />
                                <p className="text-gray-500 text-center">{t('myBooks.noQuotes')}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Bookmarks List */}
                {activeTab === 'bookmarks' && (
                    <div id="panel-bookmarks" role="tabpanel">
                        {loadingData ? (
                            <div className="flex justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
                            </div>
                        ) : bookmarks.length > 0 ? (
                            <div className="space-y-4">
                                {bookmarks.map((bm) => (
                                    <div
                                        key={bm.id}
                                        className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4"
                                    >
                                        <div
                                            className="cursor-pointer"
                                            onClick={() => navigate(`/reader/${bm.book_id}?p=${bm.paragraph_index}`)}
                                        >
                                            <h3 className="text-white font-medium text-sm mb-1">
                                                {bm.book_title || t('myBooks.books')}
                                            </h3>
                                            <p className="text-gray-400 text-xs line-clamp-2 italic">
                                                "{bm.preview_text || '...'}"
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="text-gray-500 text-xs">
                                                {t('myBooks.paragraph', { index: bm.paragraph_index + 1 })}
                                            </span>
                                            <button
                                                onClick={() => handleDeleteBookmark(bm.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                aria-label={t('aria.deleteBookmark')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Bookmark size={48} className="text-gray-600 mb-4" />
                                <p className="text-gray-500 text-center">{t('myBooks.noBookmarks')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Confirm Delete Dialog */}
            {pendingDelete && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center pb-[env(safe-area-inset-bottom)] p-4">
                    <div className="bg-[#1C1C1E] rounded-3xl w-full max-w-md p-6 border border-white/10 shadow-2xl">
                        <p className="text-white font-semibold text-center mb-5">{pendingDelete.label}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPendingDelete(null)}
                                className="flex-1 h-12 bg-white/10 text-white rounded-xl font-medium active:scale-95 transition-all"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => { pendingDelete.onConfirm(); setPendingDelete(null); }}
                                className="flex-1 h-12 bg-red-500 text-white rounded-xl font-medium active:scale-95 transition-all"
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Error Toast */}
            {uploadError && (
                <div
                    onClick={() => setUploadError(null)}
                    className="fixed bottom-32 left-4 right-4 z-30 bg-red-500/90 text-white text-sm font-medium rounded-xl px-4 py-3 shadow-xl cursor-pointer text-center"
                >
                    {uploadError}
                </div>
            )}

            {/* Upload Floating Button */}
            <div className="fixed bottom-24 right-5 z-20 pb-[env(safe-area-inset-bottom)]">
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
                    className="w-14 h-14 min-w-[56px] min-h-[56px] bg-white text-black rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform disabled:opacity-50"
                    aria-label={t('myBooks.addBook')}
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

    const coverSrc = useBookCover(book.id, book.cover);
    const { t } = useLanguage();
    const swipe = useSwipeToRemove(onRemove);

    return (
        <div className="relative group">
            {/* Delete Background Layer */}
            <div className="absolute inset-y-0 right-0 w-full bg-red-600 rounded-2xl flex items-center justify-end px-6 z-0" aria-hidden="true">
                <Trash2 className="text-white" size={24} />
            </div>

            {/* Swipeable card: drag left past the threshold to remove */}
            <div
                role="link"
                tabIndex={0}
                onPointerDown={swipe.onPointerDown}
                onPointerMove={swipe.onPointerMove}
                onPointerUp={swipe.onPointerUp}
                onPointerCancel={swipe.onPointerUp}
                onClick={() => {
                    if (!swipe.consumeClick()) navigate(`/reader/${book.id}`);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/reader/${book.id}`);
                }}
                style={{ transform: `translateX(${swipe.offset}px)` }}
                className={`relative bg-[#1C1C1E] rounded-2xl z-10 touch-pan-y select-none cursor-pointer w-full ${swipe.dragging ? 'cursor-grabbing' : 'transition-transform duration-200 ease-out'}`}
            >
                <div className="flex gap-4 p-4 pointer-events-none select-none">
                    <ImageWithLoader
                        src={coverSrc}
                        alt={book.title}
                        fallbackTitle={book.title}
                        fallbackAuthor={book.author}
                        fallbackFormat={book.format}
                        size="sm"
                        loading="lazy"
                        className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
                        wrapperClassName="w-16 h-24 rounded-lg flex-shrink-0 bg-[#2C2C2E]"
                    />
                    <div className="flex-1 flex flex-col justify-between text-left py-1">
                        <div>
                            <h3 className="font-semibold text-white line-clamp-2">{book.title || 'Без назви'}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{book.author || 'Невідомий автор'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <ProgressBar percentage={percentage} height={4} />
                            </div>
                            <span className="text-xs text-gray-400 font-medium">{percentage}%</span>
                        </div>
                    </div>
                </div>
            </div>
            {/* Keyboard access to removal: visible only when focused */}
            <button
                type="button"
                onClick={onRemove}
                className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:top-3 focus:z-20 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-red-600 focus:text-white focus:text-sm"
            >
                {t('common.delete')}
            </button>
        </div>
    );
}
