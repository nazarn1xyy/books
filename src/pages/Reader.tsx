import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings, X, Minus, Plus, Sun } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { fetchBookContent } from '../services/flibustaApi';
import { ProgressBar } from '../components/ProgressBar';
import { getSettings, saveSettings, saveReadingProgress, getReadingProgress, addToMyBooks, getBookMetadata } from '../utils/storage';
import type { Book } from '../types';

// Setup PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

export function Reader() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // State
    const [book, setBook] = useState<Book | null>(null);
    const [fullText, setFullText] = useState<string>('');
    const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    // pageNumber is now primarily used for display (1-based) derived from scroll
    const [displayPageNumber, setDisplayPageNumber] = useState<number>(1);
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
                // Fetch book content from Flibusta (FB2 parsed) or cache (PDF)
                const { text, cover, pdfData } = await fetchBookContent(id);
                setFullText(text);
                if (pdfData) setPdfData(pdfData);

                if (!text && !pdfData) {
                    throw new Error('No text content available');
                }

                // Try to get existing metadata to preserve title/author
                const existingBook = getBookMetadata(id);

                const bookData: Book = existingBook ? {
                    ...existingBook,
                    cover: cover || existingBook.cover
                } : {
                    id,
                    title: '', // Placeholder, ideally we'd parse this from FB2
                    author: '',
                    cover: cover || 'https://placehold.co/300x450?text=No+Cover',
                    description: '',
                    genre: '',
                    contentUrl: '',
                    format: pdfData ? 'pdf' : 'fb2'
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
        if (!id || !virtuosoRef.current) return;

        const isPdf = book?.format === 'pdf';
        const total = isPdf ? numPages : paragraphs.length;

        // Only run if we have content ready to scroll
        if (total === 0) return;

        const progress = getReadingProgress(id);
        if (progress) {
            let startIndex = 0;
            // Use saved currentPage (index) if available, otherwise calc from percentage
            if (progress.currentPage !== undefined && progress.currentPage < total) {
                startIndex = progress.currentPage;
            } else if (progress.scrollPercentage) {
                startIndex = Math.floor((progress.scrollPercentage / 100) * total);
            }

            const safeIndex = Math.max(0, Math.min(startIndex, total - 1));

            // Initial scroll with slight delay to ensure list is rendered
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({ index: safeIndex, align: 'start' });
            }, 100);
        }
    }, [id, paragraphs.length, numPages, book?.format]);

    const handleRangeChanged = (range: { startIndex: number, endIndex: number }) => {
        if (!id) return;

        const isPdf = book?.format === 'pdf';
        const total = isPdf ? numPages : paragraphs.length;
        if (total === 0) return;

        const currentIndex = range.startIndex;

        // Update display page number (1-based)
        if (isPdf) {
            setDisplayPageNumber(currentIndex + 1);
        }

        const percentage = Math.round((currentIndex / total) * 100);
        setScrollProgress(percentage);

        // Debounce saving
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
            saveReadingProgress({
                bookId: id,
                currentPage: currentIndex, // 0-based index
                totalPages: total,
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
            <header className="flex items-center justify-between px-4 h-auto min-h-[3.5rem] bg-black/90 backdrop-blur-xl border-b border-white/5 pt-[env(safe-area-inset-top)] pb-2 z-10 transition-transform">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-white active:opacity-50 transition-opacity"
                >
                    <ChevronLeft size={28} />
                </button>
                <div className="flex-1 text-center overflow-hidden">
                    <h1 className="text-sm font-medium text-white truncate px-4">
                        {book.title}
                    </h1>
                    {book.format === 'pdf' && (
                        <p className="text-xs text-gray-400">
                            Стр. {displayPageNumber} из {numPages}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 -mr-2 text-white active:opacity-50 transition-opacity"
                >
                    <Settings size={24} />
                </button>
            </header>

            {/* Content */}
            <main className="flex-1 relative bg-black overflow-hidden">
                {book?.format === 'pdf' && pdfData ? (
                    <div className="h-full w-full bg-[#1C1C1E]">
                        <Document
                            file={pdfData}
                            onLoadSuccess={({ numPages }) => {
                                setNumPages(numPages);
                            }}
                            loading={<div className="flex h-full items-center justify-center text-white">Загрузка PDF...</div>}
                            className="h-full"
                        >
                            {numPages > 0 && (
                                <Virtuoso
                                    ref={virtuosoRef}
                                    style={{ height: '100%' }}
                                    totalCount={numPages}
                                    rangeChanged={handleRangeChanged}
                                    itemContent={(index) => (
                                        <div className="flex justify-center py-2 px-2">
                                            <Page
                                                key={`page_${index + 1}`}
                                                pageNumber={index + 1}
                                                width={window.innerWidth > 768 ? 768 : window.innerWidth - 16} // Small padding on mobile
                                                renderTextLayer={false}
                                                renderAnnotationLayer={false}
                                                className="shadow-xl bg-white"
                                                loading={
                                                    <div
                                                        className="bg-white/10 animate-pulse rounded"
                                                        style={{
                                                            width: window.innerWidth > 768 ? 768 : window.innerWidth - 16,
                                                            height: (window.innerWidth > 768 ? 768 : window.innerWidth - 16) * 1.414
                                                        }}
                                                    />
                                                }
                                            />
                                        </div>
                                    )}
                                    components={{
                                        Footer: () => <div className="h-24" />, // Extra space at bottom
                                    }}
                                />
                            )}
                        </Document>
                    </div>
                ) : fullText && paragraphs.length > 0 ? (
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
                            Footer: () => <div className="h-24" />,
                        }}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 p-8 text-center">
                        {loading ? 'Загрузка книги...' : 'Не удалось отобразить текст книги. Попробуйте обновить страницу или выбрать другую книгу.'}
                    </div>
                )}
            </main>

            {/* Footer - Progress Bar Only */}
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

                        {/* Font Size - Only for local text books */}
                        {book?.format !== 'pdf' && (
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
                        )}

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
