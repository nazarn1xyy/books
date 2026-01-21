import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings, X, Minus, Plus, Sun, Sparkles, Brain } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { fetchBookContent } from '../services/flibustaApi';
import { ProgressBar } from '../components/ProgressBar';
import { QuoteMenu } from '../components/QuoteMenu';
import { getSettings, saveSettings, saveReadingProgress, getReadingProgress, addToMyBooks, getBookMetadata } from '../utils/storage';
import { summarizeText } from '../services/ai';
import { addQuote } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import type { Book } from '../types';

// Setup PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

export function Reader() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

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

    // Context tracking for AI
    const [visibleRange, setVisibleRange] = useState({ startIndex: 0, endIndex: 0 });

    // UI State
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState(getSettings);

    // AI Summary State
    const [showSummary, setShowSummary] = useState(false);
    const [summaryContent, setSummaryContent] = useState('');

    // Quote Selection State
    const [quoteMenuVisible, setQuoteMenuVisible] = useState(false);
    const [quoteMenuPosition, setQuoteMenuPosition] = useState({ x: 0, y: 0 });
    const [selectedText, setSelectedText] = useState('');
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

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
                const { text, cover, pdfData, title, author, series, seriesNumber } = await fetchBookContent(id);

                console.log('Book fetch result:', {
                    textLength: text?.length || 0,
                    hasPdf: !!pdfData,
                    title,
                    author
                });

                setFullText(text);
                if (pdfData) setPdfData(pdfData);

                if (!text && !pdfData) {
                    throw new Error('No text content available - book data is empty');
                }

                if (text && text.trim().length === 0) {
                    throw new Error('Book text is empty - parsing may have failed');
                }

                // Try to get existing metadata to preserve title/author
                const existingBook = getBookMetadata(id);

                const bookData: Book = existingBook ? {
                    ...existingBook,
                    cover: cover || existingBook.cover,
                    series: series || existingBook.series,
                    seriesNumber: seriesNumber || existingBook.seriesNumber
                } : {
                    id,
                    title: title || '', // Use parsed title
                    author: author || '', // Use parsed author
                    cover: cover || 'https://placehold.co/300x450?text=No+Cover',
                    description: '',
                    genre: '',
                    contentUrl: '',
                    format: pdfData ? 'pdf' : 'fb2',
                    series,
                    seriesNumber
                };

                setBook(bookData);
                // Save to My Books automatically
                addToMyBooks(bookData);

            } catch (err) {
                console.error('Book loading error:', err);
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                const errorDetails = err instanceof Error && err.stack ? `\n${err.stack.substring(0, 200)}` : '';
                setError(`Failed to load book: ${errorMessage}${errorDetails}`);
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

        setVisibleRange(range);

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

    const updateTheme = (theme: 'light' | 'dark' | 'sepia' | 'oled') => {
        const newSettings = { ...settings, theme };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const handleSummarize = async () => {
        if (book?.format === 'pdf') {
            alert('AI справка пока не поддерживается для PDF.');
            return;
        }

        setShowSummary(true);
        if (summaryContent) return; // Don't regenerate if already there (could reset on close though)

        // Always regenerate for new context actually, but for now let's keep it simple.
        // Or regenerate every time they open it?
        // Let's regenerate.
        setSummaryContent('');
        setIsGeneratingSummary(true);

        try {
            // Take roughly 15 paragraphs starting from current view
            // to catch "what is happening now"
            // We might want to look BACK a bit too?
            // "Summarize what led to this content and what is happening" requires previous context.
            // Let's take 5 paragraphs BEFORE and 15 AFTER.

            const start = Math.max(0, visibleRange.startIndex - 5);
            const end = Math.min(paragraphs.length, visibleRange.startIndex + 20);
            const textChunk = paragraphs.slice(start, end).join('\n\n');

            if (!textChunk.trim()) {
                throw new Error('Недостаточно текста для анализа.');
            }

            const result = await summarizeText(textChunk);
            if (result.error) {
                setSummaryContent(`Ошибка: ${result.error}`);
            } else {
                setSummaryContent(result.summary);
            }
        } catch (e) {
            setSummaryContent('Не удалось создать пересказ. Проверьте интернет.');
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    // Handle text selection for quotes
    const handleTextSelection = useCallback(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() || '';

        if (text.length < 10) {
            setQuoteMenuVisible(false);
            return;
        }

        // Get selection position
        const range = selection?.getRangeAt(0);
        if (!range) return;

        const rect = range.getBoundingClientRect();
        const x = Math.max(10, Math.min(rect.left, window.innerWidth - 200));
        const y = rect.bottom + 10;

        setSelectedText(text);
        setQuoteMenuPosition({ x, y });
        setQuoteMenuVisible(true);
    }, []);

    // Save quote to database
    const handleSaveQuote = async () => {
        if (!user || !book || !selectedText.trim()) return;

        try {
            await addQuote({
                book_id: book.id,
                book_title: book.title,
                book_author: book.author,
                text: selectedText.trim()
            });

            // Clear selection and hide menu
            window.getSelection()?.removeAllRanges();
            setQuoteMenuVisible(false);
            setSelectedText('');

            // Show feedback
            alert('Цитата сохранена! ✨');
        } catch (err) {
            console.error('Failed to save quote:', err);
            alert('Не удалось сохранить цитату');
        }
    };

    // Close quote menu
    const handleCloseQuoteMenu = () => {
        setQuoteMenuVisible(false);
        setSelectedText('');
        window.getSelection()?.removeAllRanges();
    };

    // Listen for text selection
    useEffect(() => {
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('touchend', handleTextSelection);

        return () => {
            document.removeEventListener('mouseup', handleTextSelection);
            document.removeEventListener('touchend', handleTextSelection);
        };
    }, [handleTextSelection]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--reader-bg)] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[var(--reader-text)]"></div>
            </div>
        );
    }

    if (error || !book) {
        return (
            <div className="min-h-screen bg-[var(--reader-bg)] flex items-center justify-center flex-col gap-4">
                <p className="text-gray-500">{error || 'Книга не найдена'}</p>
                <button onClick={() => navigate(-1)} className="text-[var(--reader-text)] underline">Назад</button>
            </div>
        );
    }

    const currentTheme = settings.theme || 'dark';

    return (
        <div
            className={`fixed inset-0 flex flex-col theme-${currentTheme} transition-colors duration-300`}
            style={{
                backgroundColor: 'var(--reader-bg)',
                color: 'var(--reader-text)',
                filter: `brightness(${settings.brightness}%)`,
            }}
        >
            {/* Header */}
            <header className="flex items-center justify-between px-4 h-auto min-h-[3.5rem] bg-[var(--reader-bg)]/90 backdrop-blur-xl border-b border-white/5 pt-[env(safe-area-inset-top)] pb-2 z-10 transition-transform shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    aria-label="Назад"
                    className="p-2 -ml-2 min-w-[44px] min-h-[44px] text-[var(--reader-text)] active:opacity-50 active:scale-95 transition-all flex items-center justify-center"
                >
                    <ChevronLeft size={28} />
                </button>
                <div className="flex-1 text-center overflow-hidden flex items-center justify-center gap-2">
                    <div className="truncate px-1">
                        <h1 className="text-sm font-medium text-[var(--reader-text)] truncate">
                            {book.title}
                        </h1>
                        {book.format === 'pdf' && (
                            <p className="text-xs text-gray-400">
                                Стр. {displayPageNumber} из {numPages}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center -mr-2 gap-1">
                    <button
                        onClick={handleSummarize}
                        aria-label="AI Summary"
                        className="p-2 text-[var(--reader-text)] active:opacity-50 transition-opacity"
                    >
                        <Sparkles size={22} className="text-yellow-400" />
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        aria-label="Настройки"
                        className="p-2 min-w-[44px] min-h-[44px] text-[var(--reader-text)] active:opacity-70 active:scale-95 transition-all flex items-center justify-center"
                    >
                        <Settings size={24} />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 relative overflow-hidden" style={{ backgroundColor: 'var(--reader-bg)' }}>
                {book?.format === 'pdf' && pdfData ? (
                    <div className="h-full w-full" style={{ backgroundColor: 'var(--reader-bg)' }}>
                        <Document
                            file={pdfData}
                            onLoadSuccess={({ numPages }) => {
                                setNumPages(numPages);
                            }}
                            loading={<div className="flex h-full items-center justify-center text-[var(--reader-text)]">Загрузка PDF...</div>}
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
                                className="px-6 py-2 leading-relaxed font-serif max-w-3xl mx-auto"
                                style={{ fontSize: `${settings.fontSize}px`, color: 'var(--reader-text)' }}
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
            <footer className="px-4 pb-6 pt-4 bg-[var(--reader-bg)]/90 backdrop-blur-xl border-t border-white/5 pb-[env(safe-area-inset-bottom)] z-10">
                <div className="max-w-3xl mx-auto w-full">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1">
                            <ProgressBar percentage={scrollProgress} height={4} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{scrollProgress}%</span>
                    </div>
                </div>
            </footer>

            {/* AI Summary Modal */}
            {showSummary && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
                    onClick={() => setShowSummary(false)}
                >
                    <div
                        className="w-full max-w-lg bg-[var(--reader-ui-bg)] rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slide-up shadow-2xl h-[60vh] flex flex-col"
                        style={{ backgroundColor: 'var(--reader-ui-bg)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Brain className="text-purple-400" size={24} />
                                <h2 className="text-lg font-semibold text-[var(--reader-text)]">Краткий пересказ</h2>
                            </div>
                            <button
                                onClick={() => setShowSummary(false)}
                                className="p-2 -mr-2 text-gray-400 hover:text-[var(--reader-text)]"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {isGeneratingSummary ? (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                    <Sparkles className="animate-spin text-purple-400" size={32} />
                                    <p className="text-gray-400 text-sm animate-pulse">Анализ контекста и генерация пересказа...</p>
                                </div>
                            ) : (
                                <div className="prose prose-invert prose-sm max-w-none text-[var(--reader-text)] leading-relaxed">
                                    {summaryContent.split('\n').map((line, i) => (
                                        <p key={i} className="mb-2">{line}</p>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-center">
                            <p className="text-xs text-gray-500">Генерируется с помощью AI. Может содержать неточности.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
                    onClick={() => setShowSettings(false)}
                >
                    <div
                        className="w-full max-w-lg bg-[var(--reader-ui-bg)] rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slide-up shadow-2xl"
                        style={{ backgroundColor: 'var(--reader-ui-bg)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Settings Content... */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-[var(--reader-text)]">Настройки</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                aria-label="Close settings"
                                className="p-2 -mr-2 text-gray-400 hover:text-[var(--reader-text)] transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Theme Selection */}
                        <div className="mb-6">
                            <label className="text-sm text-gray-400 mb-3 block">Тема</label>
                            <div className="flex gap-3 justify-between">
                                {[
                                    { id: 'light', name: 'Светлая', bg: '#F2F2F2', border: '#ddd', text: '#000' },
                                    { id: 'sepia', name: 'Сепия', bg: '#F8F1E3', border: '#E3DCCF', text: '#5F4B32' },
                                    { id: 'dark', name: 'Темная', bg: '#2C2C2E', border: '#3A3A3C', text: '#FFF' },
                                    { id: 'oled', name: 'OLED', bg: '#000000', border: '#333', text: '#AAA' },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => updateTheme(t.id as any)}
                                        className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${currentTheme === t.id ? 'ring-2 ring-blue-500 scale-105' : ''
                                            }`}
                                        style={{ backgroundColor: t.bg, borderColor: t.border }}
                                    >
                                        <span className="text-xs font-medium" style={{ color: t.text }}>{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>


                        {/* Font Size - Only for local text books */}
                        {book?.format !== 'pdf' && (
                            <div className="mb-6">
                                <label className="text-sm text-gray-400 mb-3 block">Размер шрифта</label>
                                <div className="flex items-center justify-between bg-black/10 dark:bg-white/5 rounded-xl p-4">
                                    <button
                                        onClick={() => updateFontSize(-2)}
                                        aria-label="Decrease font size"
                                        className="p-2 text-[var(--reader-text)] bg-black/10 dark:bg-white/10 rounded-lg active:scale-95 transition-transform"
                                    >
                                        <Minus size={20} />
                                    </button>
                                    <span className="text-[var(--reader-text)] font-medium">{settings.fontSize}px</span>
                                    <button
                                        onClick={() => updateFontSize(2)}
                                        aria-label="Increase font size"
                                        className="p-2 text-[var(--reader-text)] bg-black/10 dark:bg-white/10 rounded-lg active:scale-95 transition-transform"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Brightness */}
                        <div>
                            <label className="text-sm text-gray-400 mb-3 block">Яркость</label>
                            <div className="flex items-center gap-4 bg-black/10 dark:bg-white/5 rounded-xl p-4">
                                <Sun size={20} className="text-gray-500" />
                                <input
                                    type="range"
                                    min="30"
                                    max="100"
                                    value={settings.brightness}
                                    onChange={(e) => updateBrightness(Number(e.target.value))}
                                    className="flex-1 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-[var(--reader-text)]"
                                />
                                <span className="text-[var(--reader-text)] font-medium w-10 text-right">{settings.brightness}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quote Menu */}
            {user && (
                <QuoteMenu
                    isVisible={quoteMenuVisible}
                    position={quoteMenuPosition}
                    selectedText={selectedText}
                    onSave={handleSaveQuote}
                    onClose={handleCloseQuoteMenu}
                />
            )}
        </div>
    );
}
