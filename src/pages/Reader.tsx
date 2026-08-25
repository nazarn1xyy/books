import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { fetchBookContent } from '../services/flibustaApi';
import { QuoteMenu } from '../components/QuoteMenu';
import { getSettings, saveSettings, saveReadingProgress, getReadingProgress, addToMyBooks, getBookMetadata } from '../utils/storage';
import { summarizeText } from '../services/ai';
import { addQuote, addBookmark } from '../services/db';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { TranslationLanguage } from '../services/translationService';
import type { Book } from '../types';

import { ReaderHeader } from './Reader/ReaderHeader';
import { ReaderFooter } from './Reader/ReaderFooter';
import { ReaderSettingsModal } from './Reader/ReaderSettingsModal';
import { ReaderSummaryModal } from './Reader/ReaderSummaryModal';
import { ReaderTranslateModal } from './Reader/ReaderTranslateModal';
import { ReaderTocDrawer } from './Reader/ReaderTocDrawer';
import { ReaderTtsControls } from './Reader/ReaderTtsControls';

// Lazy-load PDF Viewer to prevent 500KB+ pdfjs bundle from loading for FB2 books
const ReaderPdfViewer = lazy(() => import('./Reader/ReaderPdfViewer'));

export function Reader() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const { t } = useLanguage();

    // State
    const [book, setBook] = useState<Book | null>(null);
    const [fullText, setFullText] = useState<string>('');
    const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [displayPageNumber, setDisplayPageNumber] = useState<number>(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    // Context tracking for AI
    const [visibleRange, setVisibleRange] = useState({ startIndex: 0, endIndex: 0 });

    // UI State
    const [showSettings, setShowSettings] = useState(false);
    const [showToc, setShowToc] = useState(false);
    const [settings, setSettings] = useState(getSettings);
    const [chapters, setChapters] = useState<{ title: string; paragraphIndex: number }[]>([]);

    // Page Flip Mode State
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const PARAGRAPHS_PER_PAGE = 10;

    // AI Summary State
    const [showSummary, setShowSummary] = useState(false);
    const [summaryContent, setSummaryContent] = useState('');
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

    // Quote Selection State
    const [quoteMenuVisible, setQuoteMenuVisible] = useState(false);
    const [quoteMenuPosition, setQuoteMenuPosition] = useState({ x: 0, y: 0 });
    const [selectedText, setSelectedText] = useState('');

    // Text-to-Speech
    const { speak, pause, resume, cancel, isSpeaking, isPaused } = useTextToSpeech();
    const [ttsActiveParagraph, setTtsActiveParagraph] = useState<number | null>(null);
    const [ttsRate, setTtsRate] = useState(1);
    const [showTtsControls, setShowTtsControls] = useState(false);

    // Translation State
    const [showTranslateModal, setShowTranslateModal] = useState(false);
    const [translatedParagraphs, setTranslatedParagraphs] = useState<string[]>([]);
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationLang, setTranslationLang] = useState<TranslationLanguage | null>(null);
    const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });

    // Toast
    const [toast, setToast] = useState<string | null>(null);
    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    }, []);

    // Refs
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const pendingProgressRef = useRef<Parameters<typeof saveReadingProgress>[0] | null>(null);

    // Flush pending progress save on unmount
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            if (pendingProgressRef.current) saveReadingProgress(pendingProgressRef.current);
        };
    }, []);

    // Initial load
    useEffect(() => {
        const loadBook = async () => {
            if (!id) return;
            setLoading(true);
            abortControllerRef.current = new AbortController();

            try {
                const { text, cover, pdfData, title, author, series, seriesNumber, chapters: bookChapters } = await fetchBookContent(id);
                if (bookChapters?.length) setChapters(bookChapters);

                setFullText(text);
                if (pdfData) {
                    setPdfData(pdfData);
                }

                if (!text && !pdfData) {
                    throw new Error('No text content available');
                }

                const existingBook = getBookMetadata(id);
                const bookData: Book = existingBook ? {
                    ...existingBook,
                    cover: cover || existingBook.cover,
                    series: series || existingBook.series,
                    seriesNumber: seriesNumber || existingBook.seriesNumber
                } : {
                    id,
                    title: title || '',
                    author: author || '',
                    cover: cover || 'https://placehold.co/300x450?text=No+Cover',
                    description: '',
                    genre: '',
                    contentUrl: '',
                    format: pdfData ? 'pdf' : 'fb2',
                    series,
                    seriesNumber
                };

                setBook(bookData);
                addToMyBooks(bookData);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                setError(`${t('errors.bookNotFound')} (${errorMessage})`);
            } finally {
                setLoading(false);
            }
        };
        loadBook();
        return () => { abortControllerRef.current?.abort(); };
    }, [id, t]);

    const paragraphs = useMemo(() => fullText.split('\n\n'), [fullText]);

    // Restore scroll position
    useEffect(() => {
        if (!id || !virtuosoRef.current) return;

        const isPdf = book?.format === 'pdf';
        const total = isPdf ? numPages : paragraphs.length;

        if (total === 0) return;

        const bookmarkParagraph = searchParams.get('p');
        let startIndex = 0;

        if (bookmarkParagraph !== null) {
            startIndex = Math.max(0, Math.min(parseInt(bookmarkParagraph, 10), total - 1));
        } else {
            const progress = getReadingProgress(id);
            if (progress) {
                if (progress.currentPage !== undefined && progress.currentPage < total) {
                    startIndex = progress.currentPage;
                } else if (progress.scrollPercentage) {
                    startIndex = Math.floor((progress.scrollPercentage / 100) * total);
                }
            }
        }

        const safeIndex = Math.max(0, Math.min(startIndex, total - 1));

        setTimeout(() => {
            virtuosoRef.current?.scrollToIndex({ index: safeIndex, align: 'start' });
        }, 100);
    }, [id, paragraphs.length, numPages, book?.format, searchParams]);

    const handleRangeChanged = useCallback((range: { startIndex: number, endIndex: number }) => {
        if (!id) return;

        setVisibleRange(range);

        const isPdf = book?.format === 'pdf';
        const total = isPdf ? numPages : paragraphs.length;
        if (total === 0) return;

        const currentIndex = range.startIndex;

        if (isPdf) {
            setDisplayPageNumber(currentIndex + 1);
        }

        const percentage = Math.round((currentIndex / total) * 100);
        setScrollProgress(percentage);

        // Debounce saving
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        const progressData = {
            bookId: id,
            currentPage: currentIndex,
            totalPages: total,
            lastRead: Date.now(),
            scrollPercentage: percentage
        };
        pendingProgressRef.current = progressData;
        scrollTimeoutRef.current = setTimeout(() => {
            saveReadingProgress(progressData);
            pendingProgressRef.current = null;
        }, 1000);
    }, [id, book?.format, numPages, paragraphs.length]);

    const renderScrollItem = useCallback((index: number, para: string) => (
        <div
            className={`px-6 py-2 leading-relaxed font-serif max-w-3xl mx-auto transition-colors duration-200 ${
                index === ttsActiveParagraph ? 'bg-yellow-500/20 dark:bg-yellow-500/10 -mx-2 px-8 rounded-lg' : ''
            }`}
            style={{ fontSize: `${settings.fontSize}px`, color: 'var(--reader-text)' }}
        >
            <p>{translatedParagraphs.length > 0 && translatedParagraphs[index]
                ? translatedParagraphs[index]
                : para}</p>
        </div>
    ), [ttsActiveParagraph, settings.fontSize, translatedParagraphs]);

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

    const updateFontFamily = (fontFamily: 'sans' | 'serif' | 'mono' | 'rounded') => {
        const newSettings = { ...settings, fontFamily };
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const updateReaderMode = (mode: 'scroll' | 'page') => {
        const newSettings = { ...settings, readerMode: mode };
        setSettings(newSettings);
        saveSettings(newSettings);

        if (mode === 'page') {
            setCurrentPageIndex(Math.floor(visibleRange.startIndex / PARAGRAPHS_PER_PAGE));
        }
    };

    // Page flip navigation
    const totalFlipPages = Math.ceil(paragraphs.length / PARAGRAPHS_PER_PAGE);

    const goToNextPage = useCallback(() => {
        if (currentPageIndex < totalFlipPages - 1) {
            const newIndex = currentPageIndex + 1;
            setCurrentPageIndex(newIndex);
            saveReadingProgress({
                bookId: id!,
                currentPage: newIndex * PARAGRAPHS_PER_PAGE,
                totalPages: paragraphs.length,
                lastRead: Date.now(),
                scrollPercentage: Math.round((newIndex / totalFlipPages) * 100)
            });
        }
    }, [currentPageIndex, totalFlipPages, id, paragraphs.length]);

    const goToPrevPage = useCallback(() => {
        if (currentPageIndex > 0) {
            setCurrentPageIndex(currentPageIndex - 1);
        }
    }, [currentPageIndex]);

    // Keyboard navigation for desktop (Page Flip Mode)
    useEffect(() => {
        if (settings.readerMode !== 'page' || showSettings || showSummary) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.key) {
                case 'ArrowRight':
                case ' ':
                    e.preventDefault();
                    goToNextPage();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    goToPrevPage();
                    break;
                case 'Escape':
                    navigate(-1);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [settings.readerMode, goToNextPage, goToPrevPage, showSettings, showSummary, navigate]);

    const currentPageParagraphs = useMemo(() => {
        const start = currentPageIndex * PARAGRAPHS_PER_PAGE;
        return paragraphs.slice(start, start + PARAGRAPHS_PER_PAGE);
    }, [paragraphs, currentPageIndex]);

    // TTS Logic
    const speakParagraph = useCallback((index: number) => {
        if (index >= paragraphs.length) {
            setTtsActiveParagraph(null);
            return;
        }

        const text = paragraphs[index];
        if (!text.trim()) {
            setTtsActiveParagraph(index + 1);
            return;
        }

        speak(text, { rate: ttsRate }, () => {
            setTtsActiveParagraph(prev => (prev === index ? prev + 1 : prev));
        });
    }, [paragraphs, speak, ttsRate]);

    useEffect(() => {
        if (ttsActiveParagraph !== null && !isPaused && !isSpeaking) {
            speakParagraph(ttsActiveParagraph);

            virtuosoRef.current?.scrollIntoView({
                index: ttsActiveParagraph,
                behavior: 'smooth',
                align: 'center'
            });
        }
    }, [ttsActiveParagraph, speakParagraph, isPaused, isSpeaking]);

    const handleTtsPlay = () => {
        if (isPaused) {
            resume();
        } else if (isSpeaking) {
            pause();
        } else {
            const startIndex = visibleRange.startIndex;
            setTtsActiveParagraph(startIndex);
            setShowTtsControls(true);
        }
    };

    const handleTtsNext = () => {
        cancel();
        setTtsActiveParagraph(prev => (prev !== null && prev < paragraphs.length - 1 ? prev + 1 : prev));
    };

    const handleTtsPrev = () => {
        cancel();
        setTtsActiveParagraph(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
    };

    const handleSummarize = async () => {
        if (book?.format === 'pdf') {
            showToast(t('reader.pdfNotSupportedAi'));
            return;
        }

        setShowSummary(true);
        if (summaryContent) return;

        setSummaryContent('');
        setIsGeneratingSummary(true);

        try {
            const start = Math.max(0, visibleRange.startIndex - 5);
            const end = Math.min(paragraphs.length, visibleRange.startIndex + 20);
            const textChunk = paragraphs.slice(start, end).join('\n\n');

            if (!textChunk.trim()) {
                throw new Error('Not enough text');
            }

            const result = await summarizeText(textChunk);
            if (result.error) {
                setSummaryContent(`${t('common.error')}: ${result.error}`);
            } else {
                setSummaryContent(result.summary);
            }
        } catch {
            setSummaryContent(t('errors.networkError'));
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    // Text selection for quotes
    const handleTextSelection = useCallback(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() || '';

        if (text.length < 10) {
            setQuoteMenuVisible(false);
            return;
        }

        const range = selection?.getRangeAt(0);
        if (!range) return;

        const rect = range.getBoundingClientRect();
        const x = Math.max(10, Math.min(rect.left, window.innerWidth - 200));
        const y = rect.bottom + 10;

        setSelectedText(text);
        setQuoteMenuPosition({ x, y });
        setQuoteMenuVisible(true);
    }, []);

    const handleSaveQuote = async () => {
        if (!user || !book || !selectedText.trim()) return;

        try {
            await addQuote({
                book_id: book.id,
                book_title: book.title,
                book_author: book.author,
                text: selectedText.trim()
            }, user.id);

            window.getSelection()?.removeAllRanges();
            setQuoteMenuVisible(false);
            setSelectedText('');
            showToast(t('reader.quoteSaved'));
        } catch {
            showToast(t('reader.quoteFailed'));
        }
    };

    const handleCloseQuoteMenu = () => {
        setQuoteMenuVisible(false);
        setSelectedText('');
        window.getSelection()?.removeAllRanges();
    };

    useEffect(() => {
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('touchend', handleTextSelection);

        return () => {
            document.removeEventListener('mouseup', handleTextSelection);
            document.removeEventListener('touchend', handleTextSelection);
        };
    }, [handleTextSelection]);

    const handleAddBookmark = async () => {
        if (!user || !book || book.format === 'pdf') return;

        const paragraphIndex = visibleRange.startIndex;
        const previewText = paragraphs[paragraphIndex]?.slice(0, 100) || '';

        try {
            await addBookmark({
                book_id: book.id,
                book_title: book.title,
                paragraph_index: paragraphIndex,
                preview_text: previewText
            }, user.id);
            showToast(t('reader.bookmarkAdded'));
        } catch {
            showToast(t('reader.bookmarkFailed'));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--reader-bg)] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[var(--reader-text)]"></div>
            </div>
        );
    }

    if (error || !book) {
        return (
            <div className="min-h-screen bg-[var(--reader-bg)] flex items-center justify-center flex-col gap-4 p-6 text-center">
                <p className="text-gray-500">{error || t('errors.bookNotFound')}</p>
                <button onClick={() => navigate(-1)} className="text-[var(--reader-text)] underline font-medium">
                    {t('common.back')}
                </button>
            </div>
        );
    }

    const currentTheme = settings.theme || 'dark';

    const FONT_FAMILIES = {
        sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        serif: "Georgia, 'Times New Roman', serif",
        mono: "'Courier New', Courier, monospace",
        rounded: "'Nunito', 'SF Pro Rounded', ui-rounded, sans-serif",
    };
    const currentFont = settings.fontFamily || 'sans';

    return (
        <div
            className={`fixed inset-0 flex flex-col theme-${currentTheme} transition-colors duration-300`}
            style={{
                backgroundColor: 'var(--reader-bg)',
                color: 'var(--reader-text)',
                fontFamily: FONT_FAMILIES[currentFont]
            }}
        >
            {/* Hardware-accelerated GPU overlay for brightness adjustment (No CPU filter recalculations on scroll) */}
            {settings.brightness < 100 && (
                <div
                    className="pointer-events-none fixed inset-0 z-40 bg-black transition-opacity duration-150"
                    style={{ opacity: (100 - settings.brightness) / 100 }}
                    aria-hidden="true"
                />
            )}

            {/* Reader Header */}
            <ReaderHeader
                book={book}
                numPages={numPages}
                displayPageNumber={displayPageNumber}
                user={user}
                chaptersLength={chapters.length}
                showTtsControls={showTtsControls}
                translationLang={translationLang}
                onBack={() => navigate(-1)}
                onTtsPlay={handleTtsPlay}
                onAddBookmark={handleAddBookmark}
                onSummarize={handleSummarize}
                onOpenTranslate={() => setShowTranslateModal(true)}
                onOpenToc={() => setShowToc(true)}
                onOpenSettings={() => setShowSettings(true)}
            />

            {/* Reader Content Area */}
            <main className="flex-1 relative overflow-hidden" style={{ backgroundColor: 'var(--reader-bg)' }}>
                {book?.format === 'pdf' && pdfData ? (
                    <Suspense
                        fallback={
                            <div className="flex h-full items-center justify-center text-[var(--reader-text)]">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[var(--reader-text)]"></div>
                            </div>
                        }
                    >
                        <ReaderPdfViewer
                            pdfData={pdfData}
                            numPages={numPages}
                            setNumPages={setNumPages}
                            virtuosoRef={virtuosoRef}
                            onRangeChanged={handleRangeChanged}
                        />
                    </Suspense>
                ) : fullText && paragraphs.length > 0 ? (
                    settings.readerMode === 'page' ? (
                        /* Page Flip Mode */
                        <div className="h-full flex flex-col relative">
                            <div
                                className="flex-1 overflow-y-auto px-6 py-4 touch-pan-y"
                                style={{ backgroundColor: 'var(--reader-bg)' }}
                            >
                                <div className="max-w-3xl mx-auto">
                                    {currentPageParagraphs.map((para, idx) => {
                                        const actualIndex = currentPageIndex * PARAGRAPHS_PER_PAGE + idx;
                                        const isActive = actualIndex === ttsActiveParagraph;
                                        return (
                                            <p
                                                key={actualIndex}
                                                className={`py-2 leading-relaxed font-serif transition-colors duration-200 ${
                                                    isActive ? 'bg-yellow-500/20 dark:bg-yellow-500/10 -mx-2 px-2 rounded-lg text-lg' : ''
                                                }`}
                                                style={{ fontSize: `${settings.fontSize}px`, color: 'var(--reader-text)' }}
                                            >
                                                {translatedParagraphs.length > 0 && translatedParagraphs[actualIndex]
                                                    ? translatedParagraphs[actualIndex]
                                                    : para}
                                            </p>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Page Navigation */}
                            <div className="flex items-center justify-between px-6 py-4 bg-[var(--reader-bg)]/90 border-t border-white/5 flex-shrink-0">
                                <button
                                    onClick={goToPrevPage}
                                    disabled={currentPageIndex === 0}
                                    className="p-3 text-[var(--reader-text)] disabled:opacity-30 active:scale-95 transition-all rounded-full"
                                    aria-label={t('aria.previousPage')}
                                >
                                    <ChevronLeft size={28} />
                                </button>
                                <span className="text-[var(--reader-text)] text-sm font-medium">
                                    {currentPageIndex + 1} / {totalFlipPages}
                                </span>
                                <button
                                    onClick={goToNextPage}
                                    disabled={currentPageIndex >= totalFlipPages - 1}
                                    className="p-3 text-[var(--reader-text)] disabled:opacity-30 active:scale-95 transition-all rounded-full"
                                    aria-label={t('aria.nextPage')}
                                >
                                    <ChevronRight size={28} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Scroll Mode (Virtuoso) */
                        <Virtuoso
                            ref={virtuosoRef}
                            style={{ height: '100%' }}
                            data={paragraphs}
                            rangeChanged={handleRangeChanged}
                            itemContent={renderScrollItem}
                            components={{
                                Footer: () => <div className="h-48" />,
                            }}
                        />
                    )
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 p-8 text-center">
                        {loading ? t('common.loading') : t('errors.bookNotFound')}
                    </div>
                )}
            </main>

            {/* Footer Progress Bar */}
            <ReaderFooter scrollProgress={scrollProgress} />

            {/* AI Summary Bottom Sheet */}
            <ReaderSummaryModal
                isOpen={showSummary}
                onClose={() => setShowSummary(false)}
                summaryContent={summaryContent}
                isGenerating={isGeneratingSummary}
            />

            {/* Translation Bottom Sheet */}
            <ReaderTranslateModal
                isOpen={showTranslateModal}
                onClose={() => setShowTranslateModal(false)}
                isTranslating={isTranslating}
                translationLang={translationLang}
                translationProgress={translationProgress}
                onSelectLanguage={async (code) => {
                    setIsTranslating(true);
                    setTranslationLang(code);
                    try {
                        const TRANSLATE_BUFFER = 100;
                        const winStart = Math.max(0, visibleRange.startIndex - TRANSLATE_BUFFER);
                        const winEnd = Math.min(paragraphs.length, visibleRange.endIndex + TRANSLATE_BUFFER);
                        const { translateParagraphs } = await import('../services/translationService');
                        const translated = await translateParagraphs(
                            paragraphs.slice(winStart, winEnd),
                            code,
                            (current, total) => setTranslationProgress({ current, total })
                        );
                        const full = new Array(paragraphs.length).fill('');
                        translated.forEach((trans, i) => { full[winStart + i] = trans; });
                        setTranslatedParagraphs(full);
                    } catch {
                        setTranslationLang(null);
                        showToast(t('errors.translationFailed'));
                    } finally {
                        setIsTranslating(false);
                        setShowTranslateModal(false);
                    }
                }}
                onDisableTranslation={() => {
                    setTranslationLang(null);
                    setTranslatedParagraphs([]);
                    setShowTranslateModal(false);
                }}
            />

            {/* Settings Bottom Sheet */}
            <ReaderSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                settings={settings}
                isPdf={book?.format === 'pdf'}
                onUpdateTheme={updateTheme}
                onUpdateFontSize={updateFontSize}
                onUpdateFontFamily={updateFontFamily}
                onUpdateReaderMode={updateReaderMode}
                onUpdateBrightness={updateBrightness}
            />

            {/* Table of Contents Drawer */}
            <ReaderTocDrawer
                isOpen={showToc}
                onClose={() => setShowToc(false)}
                chapters={chapters}
                currentParagraphIndex={visibleRange.startIndex}
                onSelectChapter={(paragraphIndex) => {
                    virtuosoRef.current?.scrollToIndex({ index: paragraphIndex, align: 'start' });
                }}
            />

            {/* TTS Floating Controls */}
            <ReaderTtsControls
                isVisible={showTtsControls}
                onClose={() => setShowTtsControls(false)}
                isSpeaking={isSpeaking}
                isPaused={isPaused}
                ttsRate={ttsRate}
                onChangeRate={() => setTtsRate(r => (r >= 2 ? 0.75 : r + 0.25))}
                onTogglePlay={handleTtsPlay}
                onPrev={handleTtsPrev}
                onNext={handleTtsNext}
            />

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

            {/* Toast Feedback */}
            {toast && (
                <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-[#2C2C2E] text-white text-sm font-medium rounded-xl shadow-xl border border-white/10 pointer-events-none whitespace-nowrap animate-pulse">
                    {toast}
                </div>
            )}
        </div>
    );
}

export default Reader;
