import { useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Share2, Download, Check } from 'lucide-react';
import type { Book } from '../model/types';
import { getReadingProgress } from '@/shared/storage/storage';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { ImageWithLoader } from './ImageWithLoader';
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
        medium: 'w-36 sm:w-40',
        large: 'w-44 sm:w-48',
    };

    const imageHeights = {
        small: 'aspect-[2/3] w-full',
        medium: 'h-52 sm:h-56 w-full',
        large: 'h-64 sm:h-68 w-full',
    };

    return (
        <Link
            to={`/reader/${book.id}`}
            aria-label={`${book.title}, ${book.author}`}
            className={`${sizeClasses[size]} ${size === 'small' ? 'w-full' : 'flex-shrink-0'} text-left group transition-transform duration-200 active:scale-95 flex flex-col h-full card-hover relative snap-start`}
        >
            <Toast
                message={cardToast}
                className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap pointer-events-none shadow-lg"
            />
            <div className="relative overflow-hidden rounded-2xl bg-[#1C1C1E] shadow-md">
                <ImageWithLoader
                    src={coverSrc}
                    alt={book.title}
                    fallbackTitle={book.title}
                    fallbackAuthor={book.author}
                    fallbackFormat={book.format}
                    size={size}
                    loading={priority ? "eager" : "lazy"}
                    decoding={priority ? "sync" : "async"}
                    fetchPriority={priority ? "high" : "low"}
                    className={`w-full ${imageHeights[size]} object-cover transition-opacity duration-300 group-hover:opacity-90 rounded-2xl`}
                    wrapperClassName="w-full bg-[#1C1C1E] rounded-2xl"
                />

                {/* Action Buttons */}
                {showActions && (
                    <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                        <button
                            onClick={handleDownloadClick}
                            disabled={isDownloading || isOffline}
                            className={`p-1.5 rounded-full backdrop-blur-md transition-all duration-200 ${isOffline
                                ? 'bg-green-500/90 text-white'
                                : 'bg-black/50 text-white/80 hover:bg-black/70'
                                }`}
                            aria-label={isOffline ? t('aria.offlineReady') : t('aria.downloadOffline')}
                        >
                            {isOffline ? (
                                <Check size={16} />
                            ) : (
                                <Download size={16} className={isDownloading ? 'animate-pulse' : ''} />
                            )}
                        </button>
                        <button
                            onClick={handleFavoriteClick}
                            disabled={isLoading}
                            className={`p-1.5 rounded-full backdrop-blur-md transition-all duration-200 ${isFavorite
                                ? 'bg-red-500/90 text-white'
                                : 'bg-black/50 text-white/80 hover:bg-black/70'
                                }`}
                            aria-label={isFavorite ? t('aria.removeFavorite') : t('aria.addFavorite')}
                        >
                            <Heart
                                size={16}
                                fill={isFavorite ? 'currentColor' : 'none'}
                                className={isLoading ? 'animate-pulse' : ''}
                            />
                        </button>
                        <button
                            onClick={handleShareClick}
                            className="p-1.5 rounded-full bg-black/50 text-white/80 hover:bg-black/70 backdrop-blur-md transition-all duration-200"
                            aria-label={t('aria.shareBook')}
                        >
                            <Share2 size={16} />
                        </button>
                    </div>
                )}

                {/* Offline Badge */}
                {!showActions && isOffline && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-green-500/90 backdrop-blur-md rounded-full z-10">
                        <span className="text-xs text-white font-medium">✓</span>
                    </div>
                )}

                {showProgress && percentage > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <ProgressBar percentage={percentage} height={4} />
                        <p className="text-[10px] text-gray-400 mt-1">{percentage}%</p>
                    </div>
                )}
            </div>
            <div className="flex-1 flex flex-col pt-2.5 px-0.5">
                <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug min-h-[2.5rem] group-hover:text-gray-200 transition-colors">
                    {book.title}
                </h3>
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{book.author}</p>
            </div>
        </Link>
    );
});
