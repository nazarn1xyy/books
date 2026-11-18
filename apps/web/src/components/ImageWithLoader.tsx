import { useState, memo, type ReactNode } from 'react';
import { BookCoverFallback } from './BookCoverFallback';

const _loadedImagesCache = new Set<string>();

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
    const isInvalidSrc = !src || src.trim() === '' || src.includes('placehold.co');
    const [loadedSrc, setLoadedSrc] = useState<string | null>(() => {
        if (src && _loadedImagesCache.has(src)) return src;
        return null;
    });
    const [errorSrc, setErrorSrc] = useState<string | null>(null);

    const hasError = errorSrc === src;
    const isLoaded = loadedSrc === src || (!!src && _loadedImagesCache.has(src));

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
            {!isLoaded && (
                <div
                    className="absolute inset-0 bg-[#2C2C2E] animate-pulse"
                    aria-hidden="true"
                />
            )}

            {/* Image */}
            <img
                key={src}
                src={src}
                alt={alt}
                decoding="async"
                {...props}
                className={`w-full h-full object-cover transition-opacity duration-200 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                } ${className}`}
                onLoad={(e) => {
                    if (src) _loadedImagesCache.add(src);
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
