import { useMemo, memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Share2, Download, Check, MoreHorizontal } from 'lucide-react';
import { Sheet } from '@/shared/ui/Sheet';
import { displayTitle } from '@/shared/lib/displayTitle';
import type { Book } from '../model/types';
import { getReadingProgress } from '@/shared/storage/storage';
import { BookCover } from './BookCover';
import { useBookCardActions } from '../lib/useBookCardActions';
import { useBookCover } from '../lib/useBookCover';
import { useLanguage } from '@/shared/i18n/LanguageContext';
import { Toast } from '@/shared/ui/Toast';

interface BookCardProps {
    book: Book;
    size?: 'small' | 'medium' | 'large';
    showProgress?: boolean;
    priority?: boolean;
    showActions?: boolean;
    initialFavorite?: boolean;
}

export const BookCard = memo(function BookCard({
    book,
    size = 'medium',
    showProgress = false,
    priority = false,
    showActions = false,
    initialFavorite
}: BookCardProps) {
    const { t } = useLanguage();
    const [menuOpen, setMenuOpen] = useState(false);
    const title = displayTitle(book.title || '');
    
    // Memoize progress calculation to avoid sync JSON parsing on every render
    const progress = useMemo(() => getReadingProgress(book.id), [book.id]);
    const coverSrc = useBookCover(book.id, book.cover);
    const { isFavorite, isLoading, isOffline, isDownloading, toast: cardToast, handleFavoriteClick, handleShareClick, handleDownloadClick } =
        useBookCardActions({ book, coverSrc, showActions, initialFavorite });

    const percentage = useMemo(() => {
        if (!progress || progress.totalPages <= 0) return 0;
        const raw = progress.scrollPercentage ?? Math.round(((progress.currentPage + 1) / progress.totalPages) * 100);
        return isNaN(raw) ? 0 : raw;
    }, [progress]);

    const sizeClasses = {
        small: 'w-full',
        medium: 'w-32 sm:w-36 flex-shrink-0',
        large: 'w-40 sm:w-44 flex-shrink-0',
    };
    const coverSize = size === 'small' ? 'sm' : size === 'large' ? 'lg' : 'md';

    const sheetAction = 'flex w-full min-h-[48px] items-center gap-3 rounded-xl px-4 text-sm font-medium text-fg hover:bg-fg/5 disabled:opacity-50';

    return (
        <div className={`${sizeClasses[size]} relative group snap-start`}>
        <Link
            to={`/reader/${book.id}`}
            aria-label={[title, book.author, showProgress && percentage > 0 ? t('home.percentRead', { percent: percentage }) : ''].filter(Boolean).join(', ')}
            className="text-left flex flex-col h-full relative rounded-lg active:scale-[0.97] transition-transform duration-200"
        >
            <Toast
                message={cardToast}
                className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-app/80 text-fg text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap pointer-events-none shadow-lg"
            />
            <BookCover book={{ ...book, cover: coverSrc }} size={coverSize} priority={priority} progress={showProgress ? percentage : 0}>
                {isOffline && (
                    <span className="absolute bottom-2 left-2 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white z-10" title={t('aria.offlineReady')}>
                        <Check size={12} aria-hidden="true" />
                    </span>
                )}
            </BookCover>
            <div className="flex-1 flex flex-col pt-2.5">
                <h3 className="text-[13px] font-semibold text-fg line-clamp-2 leading-snug">{title}</h3>
                <p className="text-xs text-subtle mt-0.5 line-clamp-1">{book.author}</p>
            </div>
        </Link>
        {showActions && (
            <>
                <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    aria-label={t('myBooks.bookActions', { title })}
                    aria-haspopup="dialog"
                    className="absolute top-1.5 right-1.5 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition-opacity hover:bg-black/75 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100"
                >
                    <MoreHorizontal size={18} aria-hidden="true" />
                </button>
                <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t('myBooks.bookActions', { title })} className="p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                    <p className="px-4 pt-2 pb-3 text-sm font-semibold text-fg line-clamp-2">{title}</p>
                    <button type="button" className={sheetAction} onClick={handleFavoriteClick} disabled={isLoading}>
                        <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
                        {isFavorite ? t('aria.removeFavorite') : t('aria.addFavorite')}
                    </button>
                    <button type="button" className={sheetAction} onClick={handleDownloadClick} disabled={isDownloading || isOffline}>
                        {isOffline ? <Check size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
                        {isOffline ? t('aria.offlineReady') : t('aria.downloadOffline')}
                    </button>
                    <button type="button" className={sheetAction} onClick={handleShareClick}>
                        <Share2 size={18} aria-hidden="true" />
                        {t('aria.shareBook')}
                    </button>
                </Sheet>
            </>
        )}
        </div>
    );
});
