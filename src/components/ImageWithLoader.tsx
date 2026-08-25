import { useState, memo, type ReactNode } from 'react';
import { BookCoverFallback } from './BookCoverFallback';

interface ImageWithLoaderProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    wrapperClassName?: string;
    aspectRatio?: string;
    fallback?: ReactNode;
    fallbackTitle?: string;
    fallbackAuthor?: string;
    fallbackFormat?: string;
    size?: 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large';
}

export const ImageWithLoader = memo(function ImageWithLoader({
    src,
    alt = '',
    wrapperClassName = '',
    className = '',
    aspectRatio = 'aspect-[2/3]',
    fallback,
    fallbackTitle,
    fallbackAuthor,
    fallbackFormat,
    size = 'md',
    onLoad,
    onError,
    ...props
}: ImageWithLoaderProps) {
    const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
    const [errorSrc, setErrorSrc] = useState<string | null>(null);

    const isInvalidSrc = !src || src.trim() === '' || src.includes('placehold.co');
    const hasError = errorSrc === src;
    const isLoaded = loadedSrc === src;

    // If source is missing, invalid, or errored out, render Apple Books fallback
    if (isInvalidSrc || hasError) {
        if (fallback) {
            return <div className={`relative overflow-hidden ${aspectRatio} ${wrapperClassName}`}>{fallback}</div>;
        }

        return (
            <div className={`relative overflow-hidden ${aspectRatio} ${wrapperClassName}`}>
                <BookCoverFallback
                    title={fallbackTitle || alt || 'Book'}
                    author={fallbackAuthor}
                    format={fallbackFormat}
                    size={size}
                />
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${aspectRatio} ${wrapperClassName}`}>
            {/* Skeleton / Placeholder to prevent Cumulative Layout Shift */}
            <div
                className={`absolute inset-0 bg-[#2C2C2E] transition-opacity duration-300 ${
                    isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-pulse'
                }`}
                aria-hidden="true"
            />

            {/* Image */}
            <img
                key={src}
                src={src}
                alt={alt}
                decoding="async"
                {...props}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                } ${className}`}
                onLoad={(e) => {
                    setLoadedSrc(src);
                    onLoad?.(e);
                }}
                onError={(e) => {
                    setErrorSrc(src);
                    onError?.(e);
                }}
            />
        </div>
    );
});
