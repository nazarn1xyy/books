import { useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Share2, Download, Check } from 'lucide-react';
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
    const actionButton =
        'p-1.5 rounded-full backdrop-blur-md transition-all duration-200 shadow-sm';

    return (
        <Link
            to={`/reader/${book.id}`}
            aria-label={[book.title, book.author, showProgress && percentage > 0 ? t('home.percentRead', { percent: percentage }) : ''].filter(Boolean).join(', ')}
            className={`${sizeClasses[size]} text-left group flex flex-col h-full relative snap-start rounded-lg active:scale-[0.97] transition-transform duration-200`}
        >
            <Toast
                message={cardToast}
                className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-app/80 text-fg text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap pointer-events-none shadow-lg"
            />
            <BookCover book={{ ...book, cover: coverSrc }} size={coverSize} priority={priority} progress={showProgress ? percentage : 0}>
                {showActions && (
                    <div className="absolute top-1.5 right-1.5 flex gap-1 z-10 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                        <button
                            onClick={handleDownloadClick}
                            disabled={isDownloading || isOffline}
                            className={`${actionButton} ${isOffline ? 'bg-green-600 text-white' : 'bg-black/55 text-white hover:bg-black/75'}`}
                            aria-label={isOffline ? t('aria.offlineReady') : t('aria.downloadOffline')}
                        >
                            {isOffline ? <Check size={14} /> : <Download size={14} className={isDownloading ? 'animate-pulse' : ''} />}
                        </button>
                        <button
                            onClick={handleFavoriteClick}
                            disabled={isLoading}
                            className={`${actionButton} ${isFavorite ? 'bg-red-500 text-white' : 'bg-black/55 text-white hover:bg-black/75'}`}
                            aria-label={isFavorite ? t('aria.removeFavorite') : t('aria.addFavorite')}
                        >
                            <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} className={isLoading ? 'animate-pulse' : ''} />
                        </button>
                        <button
                            onClick={handleShareClick}
                            className={`${actionButton} bg-black/55 text-white hover:bg-black/75`}
                            aria-label={t('aria.shareBook')}
                        >
                            <Share2 size={14} />
                        </button>
                    </div>
                )}
                {!showActions && isOffline && (
                    <span className="absolute top-1.5 left-2 px-1.5 py-0.5 bg-green-600 rounded-full z-10 text-[10px] text-white font-semibold">✓</span>
                )}
            </BookCover>
            <div className="flex-1 flex flex-col pt-2.5">
                <h3 className="text-[13px] font-semibold text-fg line-clamp-2 leading-snug">{book.title}</h3>
                <p className="text-xs text-subtle mt-0.5 line-clamp-1">{book.author}</p>
            </div>
        </Link>
    );
});
