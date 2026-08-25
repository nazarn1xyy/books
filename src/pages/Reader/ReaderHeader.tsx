import { ChevronLeft, Sparkles, BookmarkPlus, Play, Languages, List, Settings } from 'lucide-react';
import type { Book } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface ReaderHeaderProps {
    book: Book;
    numPages: number;
    displayPageNumber: number;
    user: { id?: string; email?: string } | null;
    chaptersLength: number;
    showTtsControls: boolean;
    translationLang: string | null;
    onBack: () => void;
    onTtsPlay: () => void;
    onAddBookmark: () => void;
    onSummarize: () => void;
    onOpenTranslate: () => void;
    onOpenToc: () => void;
    onOpenSettings: () => void;
}

export function ReaderHeader({
    book,
    numPages,
    displayPageNumber,
    user,
    chaptersLength,
    showTtsControls,
    translationLang,
    onBack,
    onTtsPlay,
    onAddBookmark,
    onSummarize,
    onOpenTranslate,
    onOpenToc,
    onOpenSettings
}: ReaderHeaderProps) {
    const { t } = useLanguage();

    return (
        <header className="flex items-center justify-between px-4 min-h-[3.5rem] bg-[var(--reader-bg)]/90 backdrop-blur-xl border-b border-white/5 pt-[env(safe-area-inset-top)] pb-2 z-10 shadow-sm flex-shrink-0">
            <button
                onClick={onBack}
                aria-label={t('common.back')}
                className="p-2 -ml-2 min-w-[44px] min-h-[44px] text-[var(--reader-text)] active:opacity-50 active:scale-95 transition-all flex items-center justify-center rounded-full"
            >
                <ChevronLeft size={28} />
            </button>
            <div className="flex-1 text-center overflow-hidden flex items-center justify-center gap-2">
                <div className="truncate px-1">
                    <h1 className="text-sm font-semibold text-[var(--reader-text)] truncate">
                        {book.title}
                    </h1>
                    {book.format === 'pdf' && numPages > 0 && (
                        <p className="text-xs text-gray-400">
                            {t('reader.page')} {displayPageNumber} {t('reader.of')} {numPages}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center -mr-2 gap-0.5">
                {user && book.format !== 'pdf' && (
                    <>
                        <button
                            onClick={onTtsPlay}
                            className={`p-2 text-[var(--reader-text)] active:opacity-50 transition-opacity rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center ${
                                showTtsControls ? 'text-blue-400 bg-blue-400/10' : ''
                            }`}
                            aria-label={t('aria.readAloud')}
                        >
                            <Play size={20} fill={showTtsControls ? "currentColor" : "none"} />
                        </button>
                        <button
                            onClick={onAddBookmark}
                            aria-label={t('aria.addBookmark')}
                            className="p-2 text-[var(--reader-text)] active:opacity-50 transition-opacity rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center"
                        >
                            <BookmarkPlus size={20} className="text-blue-400" />
                        </button>
                    </>
                )}
                <button
                    onClick={onSummarize}
                    aria-label={t('aria.aiSummary')}
                    className="p-2 text-[var(--reader-text)] active:opacity-50 transition-opacity rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center"
                >
                    <Sparkles size={20} className="text-yellow-400" />
                </button>
                <button
                    onClick={onOpenTranslate}
                    aria-label={t('aria.translateBook')}
                    className={`p-2 text-[var(--reader-text)] active:opacity-50 transition-opacity rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center ${
                        translationLang ? 'text-green-400 bg-green-400/10' : ''
                    }`}
                >
                    <Languages size={20} className={translationLang ? 'text-green-400' : ''} />
                </button>
                {book.format !== 'pdf' && chaptersLength > 0 && (
                    <button
                        onClick={onOpenToc}
                        aria-label={t('aria.openToc')}
                        className="p-2 text-[var(--reader-text)] active:opacity-50 transition-opacity rounded-full min-w-[40px] min-h-[40px] flex items-center justify-center"
                    >
                        <List size={20} />
                    </button>
                )}
                <button
                    onClick={onOpenSettings}
                    aria-label={t('aria.openSettings')}
                    className="p-2 min-w-[44px] min-h-[44px] text-[var(--reader-text)] active:opacity-70 active:scale-95 transition-all flex items-center justify-center rounded-full"
                >
                    <Settings size={22} />
                </button>
            </div>
        </header>
    );
}
