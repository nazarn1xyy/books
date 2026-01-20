import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings, X, Minus, Plus, Sun } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { fetchBookContent } from '../services/flibustaApi';
import { ProgressBar } from '../components/ProgressBar';
import { getSettings, saveSettings, saveReadingProgress, getReadingProgress, addToMyBooks, getBookMetadata } from '../utils/storage';
import type { Book } from '../types';

export function Reader() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // State
    const [book, setBook] = useState<Book | null>(null);
    const [fullText, setFullText] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    // UI State
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState(getSettings);

    // Refs
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initial load
    useEffect(() => {
        const loadBook = async () => {
            if (!id) return;
            setLoading(true);

            try {
                // Fetch book content from Flibusta (FB2 parsed)
                const { text, cover } = await fetchBookContent(id);
                setFullText(text);

                if (!text) {
                    throw new Error('No text content available');
                }

                // Try to get existing metadata to preserve title/author
                const existingBook = getBookMetadata(id);

                const bookData: Book = existingBook ? {
                    ...existingBook,
                    cover: cover || existingBook.cover
                } : {
                    id,
                    title: 'Загрузка...', // Placeholder, ideally we'd parse this from FB2
                    author: '',
                    cover: cover || 'https://placehold.co/300x450?text=No+Cover',
                    description: '',
                    genre: '',
                    contentUrl: ''
                };

                setBook(bookData);
                // Save to My Books automatically
                addToMyBooks(bookData);

            } catch (err) {
                console.error(err);
                setError('Failed to load book content');
            } finally {
                setLoading(false);
            }
        };
        loadBook();
    }, [id]);

    const paragraphs = useMemo(() => fullText.split('\n\n'), [fullText]);

    // Restore scroll position
    useEffect(() => {
        if (!id || paragraphs.length === 0 || !virtuosoRef.current) return;

        const progress = getReadingProgress(id);
        if (progress && progress.scrollPercentage) {
            const index = Math.floor((progress.scrollPercentage / 100) * paragraphs.length);
            const safeIndex = Math.max(0, Math.min(index, paragraphs.length - 1));

            // Initial scroll
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({ index: safeIndex, align: 'start' });
            }, 100);
        }
    }, [id, paragraphs]);

    const handleRangeChanged = (range: { startIndex: number, endIndex: number }) => {
        if (!id) return;

        const percentage = Math.round((range.startIndex / paragraphs.length) * 100);
        setScrollProgress(percentage);

        // Debounce saving
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
            saveReadingProgress({
                bookId: id,
                currentPage: range.startIndex,
                totalPages: paragraphs.length,
                lastRead: Date.now(),
                scrollPercentage: percentage
            });
        }, 1000);
    };

    const updateFontSize = (delta: number) => {
        const newSettings = {
            ...settings,
            fontSize: Math.max(14, Math.min(28, settings.fontSize + delta)),
        };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const updateBrightness = (value: number) => {
        const newSettings = { ...settings, brightness: value };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
            </div>
        );
    }

    if (error || !book) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center flex-col gap-4">
                <p className="text-gray-500">{error || 'Книга не найдена'}</p>
                <button onClick={() => navigate(-1)} className="text-white underline">Назад</button>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 bg-black flex flex-col"
            style={{
                filter: `brightness(${settings.brightness}%)`,
            }}
        >
            {/* Header */}
            <header className="flex items-center justify-between px-4 h-14 bg-black/90 backdrop-blur-xl border-b border-white/5 pt-[env(safe-area-inset-top)] z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-white active:opacity-50 transition-opacity"
                >
                    <ChevronLeft size={28} />
                </button>
                <div className="flex-1 text-center">
                    <h1 className="text-sm font-medium text-white truncate px-4">
                        {book.title}
                    </h1>
                </div>
                <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 -mr-2 text-white active:opacity-50 transition-opacity"
                >
                    <Settings size={24} />
                </button>
            </header>

            {/* Content */}
            <main
                className="flex-1 relative bg-black"
            >
                {fullText && paragraphs.length > 0 ? (
                    <Virtuoso
                        ref={virtuosoRef}
                        style={{ height: '100%' }}
                        data={paragraphs}
                        rangeChanged={handleRangeChanged}
                        itemContent={(_index, para) => (
                            <div
                                className="px-6 py-2 text-white leading-relaxed font-serif max-w-3xl mx-auto"
                                style={{ fontSize: `${settings.fontSize}px` }}
                            >
                                <p>{para}</p>
                            </div>
                        )}
                        components={{
                            Footer: () => <div className="h-20" />,
                        }}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 p-8 text-center">
                        {loading ? 'Загрузка...' : 'Не удалось отобразить текст книги. Попробуйте обновить страницу или выбрать другую книгу.'}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="px-4 pb-6 pt-4 bg-black/90 backdrop-blur-xl border-t border-white/5 pb-[env(safe-area-inset-bottom)] z-10">
                <div className="max-w-3xl mx-auto w-full">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1">
                            <ProgressBar percentage={scrollProgress} height={4} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{scrollProgress}%</span>
                    </div>
                </div>
            </footer>

            {/* Settings Modal */}
            {showSettings && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center"
                    onClick={() => setShowSettings(false)}
                >
                    <div
                        className="w-full max-w-lg bg-[#1C1C1E] rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-white">Настройки</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="p-2 -mr-2 text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Font Size */}
                        <div className="mb-6">
                            <label className="text-sm text-gray-400 mb-3 block">Размер шрифта</label>
                            <div className="flex items-center justify-between bg-[#2C2C2E] rounded-xl p-4">
                                <button
                                    onClick={() => updateFontSize(-2)}
                                    className="p-2 text-white bg-[#3A3A3C] rounded-lg active:scale-95 transition-transform"
                                >
                                    <Minus size={20} />
                                </button>
                                <span className="text-white font-medium">{settings.fontSize}px</span>
                                <button
                                    onClick={() => updateFontSize(2)}
                                    className="p-2 text-white bg-[#3A3A3C] rounded-lg active:scale-95 transition-transform"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Brightness */}
                        <div>
                            <label className="text-sm text-gray-400 mb-3 block">Яркость</label>
                            <div className="flex items-center gap-4 bg-[#2C2C2E] rounded-xl p-4">
                                <Sun size={20} className="text-gray-500" />
                                <input
                                    type="range"
                                    min="30"
                                    max="100"
                                    value={settings.brightness}
                                    onChange={(e) => updateBrightness(Number(e.target.value))}
                                    className="flex-1 h-1 bg-[#3A3A3C] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                />
                                <span className="text-white font-medium w-10 text-right">{settings.brightness}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
