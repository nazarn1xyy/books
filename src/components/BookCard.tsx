import { useNavigate } from 'react-router-dom';
import type { Book } from '../types';
import { getReadingProgress } from '../utils/storage';
import { ProgressBar } from './ProgressBar';
import { ImageWithLoader } from './ImageWithLoader';

interface BookCardProps {
    book: Book;
    size?: 'small' | 'medium' | 'large';
    showProgress?: boolean;
}

export function BookCard({ book, size = 'medium', showProgress = false }: BookCardProps) {
    const navigate = useNavigate();
    const progress = getReadingProgress(book.id);
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

    return (
        <button
            onClick={() => navigate(`/reader/${book.id}`)}
            aria-label={`Read ${book.title} by ${book.author}`}
            className={`${sizeClasses[size]} flex-shrink-0 text-left group transition-transform duration-200 active:scale-95 flex flex-col h-full`}
        >
            <div className="relative overflow-hidden rounded-xl bg-[#1C1C1E]">
                <ImageWithLoader
                    src={book.cover || 'https://placehold.co/300x450?text=No+Cover'}
                    alt={book.title}
                    loading="lazy"
                    className={`w-full ${imageHeights[size]} object-cover transition-opacity duration-300 group-hover:opacity-90`}
                    wrapperClassName="w-full bg-[#1C1C1E]"
                />
                {showProgress && percentage > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <ProgressBar percentage={percentage} height={4} />
                        <p className="text-[10px] text-gray-400 mt-1">{percentage}% прочитано</p>
                    </div>
                )}
            </div>
            <div className="flex-1 flex flex-col">
                <h3 className="mt-2 text-sm font-semibold text-white line-clamp-2 min-h-[2.5rem] group-hover:text-gray-200 transition-colors">
                    {book.title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{book.author}</p>
            </div>
        </button>
    );
}
