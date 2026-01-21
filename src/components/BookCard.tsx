import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Share2 } from 'lucide-react';
import type { Book } from '../types';
import { getReadingProgress } from '../utils/storage';
import { ProgressBar } from './ProgressBar';
import { ImageWithLoader } from './ImageWithLoader';
import { useBookCover } from '../hooks/useBookCover';
import { addFavorite, removeFavorite, isBookFavorite } from '../services/db';
import { useAuth } from '../contexts/AuthContext';

interface BookCardProps {
    book: Book;
    size?: 'small' | 'medium' | 'large';
    showProgress?: boolean;
    priority?: boolean;
    showActions?: boolean;
    initialFavorite?: boolean;
}

export function BookCard({
    book,
    size = 'medium',
    showProgress = false,
    priority = false,
    showActions = false,
    initialFavorite
}: BookCardProps) {
    const { user } = useAuth();
    const progress = getReadingProgress(book.id);
    const coverSrc = useBookCover(book.id, book.cover);
    const [isFavorite, setIsFavorite] = useState(initialFavorite ?? false);
    const [isLoading, setIsLoading] = useState(false);

    // Check favorite status on mount if user is logged in and showActions is true
    useEffect(() => {
        if (showActions && user && initialFavorite === undefined) {
            isBookFavorite(book.id).then(setIsFavorite).catch(console.error);
        }
    }, [book.id, user, showActions, initialFavorite]);

    const rawPercentage = progress && progress.totalPages > 0
        ? Math.round(((progress.currentPage + 1) / progress.totalPages) * 100)
        : 0;
    const percentage = isNaN(rawPercentage) ? 0 : rawPercentage;

    const sizeClasses = {
        small: 'w-28',
        medium: 'w-36',
        large: 'w-44',
    };

    const imageHeights = {
        small: 'h-40',
        medium: 'h-52',
        large: 'h-64',
    };

    const handleFavoriteClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user || isLoading) return;

        setIsLoading(true);
        try {
            if (isFavorite) {
                await removeFavorite(book.id);
                setIsFavorite(false);
            } else {
                await addFavorite({
                    id: book.id,
                    title: book.title,
                    author: book.author,
                    cover: coverSrc || ''
                });
                setIsFavorite(true);
            }
        } catch (err) {
            console.error('Failed to toggle favorite:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const shareData = {
            title: book.title,
            text: `Читаю "${book.title}" от ${book.author}`,
            url: `https://libify.store/reader/${book.id}`
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(shareData.url);
                alert('Ссылка скопирована!');
            }
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('Share failed:', err);
            }
        }
    };

    return (
        <Link
            to={`/reader/${book.id}`}
            aria-label={`Читать книгу ${book.title}, автор ${book.author}`}
            className={`${sizeClasses[size]} flex-shrink-0 text-left group transition-transform duration-200 active:scale-95 flex flex-col h-full`}
        >
            <div className="relative overflow-hidden rounded-xl bg-[#1C1C1E]">
                <ImageWithLoader
                    src={coverSrc || 'https://placehold.co/300x450?text=No+Cover'}
                    alt={book.title}
                    loading={priority ? "eager" : "lazy"}
                    decoding={priority ? "sync" : "async"}
                    fetchPriority={priority ? "high" : "low"}
                    className={`w-full ${imageHeights[size]} object-cover transition-opacity duration-300 group-hover:opacity-90`}
                    wrapperClassName="w-full bg-[#1C1C1E]"
                />

                {/* Action Buttons */}
                {showActions && user && (
                    <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                        <button
                            onClick={handleFavoriteClick}
                            disabled={isLoading}
                            className={`p-1.5 rounded-full backdrop-blur-md transition-all duration-200 ${isFavorite
                                    ? 'bg-red-500/90 text-white'
                                    : 'bg-black/50 text-white/80 hover:bg-black/70'
                                }`}
                            aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
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
                            aria-label="Поделиться книгой"
                        >
                            <Share2 size={16} />
                        </button>
                    </div>
                )}

                {showProgress && percentage > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <ProgressBar percentage={percentage} height={4} />
                        <p className="text-[10px] text-gray-400 mt-1">{percentage}% прочитано</p>
                    </div>
                )}
            </div>
            <div className="flex-1 flex flex-col pt-2">
                <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight min-h-[2.25rem] group-hover:text-gray-200 transition-colors">
                    {book.title}
                </h3>
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{book.author}</p>
            </div>
        </Link>
    );
}
