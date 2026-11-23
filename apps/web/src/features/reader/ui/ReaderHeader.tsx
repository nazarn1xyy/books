import { ChevronLeft, BookmarkPlus, List, Settings } from 'lucide-react';
import type { Book } from '@/entities/book/model/types';
import { displayTitle } from '@/shared/lib/displayTitle';
import { useLanguage } from '@/shared/i18n/LanguageContext';

interface ReaderHeaderProps {
    book: Book;
    numPages: number;
    displayPageNumber: number;
    user: { id?: string; email?: string } | null;
    chaptersLength: number;
    onBack: () => void;
    onAddBookmark: () => void;
    onOpenToc: () => void;
    onOpenSettings: () => void;
}

export function ReaderHeader({
    book,
    numPages,
    displayPageNumber,
    user,
    chaptersLength,
    onBack,
    onAddBookmark,
    onOpenToc,
    onOpenSettings
}: ReaderHeaderProps) {
    const { t } = useLanguage();

    // One button style for the whole bar: 44px targets, reader-theme colours, a soft pill when active.
    const iconButton = (active = false) =>
        `min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--reader-text)] transition-[background-color,opacity,transform] active:scale-95 hover:bg-[color-mix(in_srgb,var(--reader-text)_8%,transparent)] ${
            active ? 'bg-[color-mix(in_srgb,var(--reader-text)_12%,transparent)]' : 'opacity-80 hover:opacity-100'
        }`;

    return (
        <header className="flex items-center gap-1 px-2 sm:px-4 min-h-[3.5rem] bg-[var(--reader-bg)] border-b border-[color-mix(in_srgb,var(--reader-text)_10%,transparent)] pt-statusbar pb-1 z-10 flex-shrink-0">
            <button onClick={onBack} aria-label={t('common.back')} className={iconButton()}>
                <ChevronLeft size={26} aria-hidden="true" />
            </button>
            <div className="flex-1 min-w-0 px-1">
                <h1 className="text-[15px] font-semibold text-[var(--reader-text)] truncate">
                    {displayTitle(book.title)}
                </h1>
                {book.format === 'pdf' && numPages > 0 && (
                    <p className="text-xs text-[var(--reader-text)] opacity-60 tabular-nums">
                        {t('reader.page')} {displayPageNumber} {t('reader.of')} {numPages}
                    </p>
                )}
            </div>
            <div className="flex items-center flex-shrink-0">
                {user && book.format !== 'pdf' && (
                    <button onClick={onAddBookmark} aria-label={t('aria.addBookmark')} className={iconButton()}>
                        <BookmarkPlus size={20} aria-hidden="true" />
                    </button>
                )}
                {book.format !== 'pdf' && chaptersLength > 0 && (
                    <button onClick={onOpenToc} aria-label={t('aria.openToc')} className={iconButton()}>
                        <List size={20} aria-hidden="true" />
                    </button>
                )}
                <button onClick={onOpenSettings} aria-label={t('aria.openSettings')} className={iconButton()}>
                    <Settings size={20} aria-hidden="true" />
                </button>
            </div>
        </header>
    );
}
