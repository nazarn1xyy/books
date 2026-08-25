import { useState, memo } from 'react';

interface ImageWithLoaderProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    wrapperClassName?: string;
    aspectRatio?: string;
}

export const ImageWithLoader = memo(function ImageWithLoader({
    wrapperClassName = '',
    className = '',
    aspectRatio = 'aspect-[2/3]',
    alt = '',
    ...props
}: ImageWithLoaderProps) {
    const [isLoaded, setIsLoaded] = useState(false);

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
                alt={alt}
                decoding="async"
                {...props}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                } ${className}`}
                onLoad={(e) => {
                    setIsLoaded(true);
                    props.onLoad?.(e);
                }}
            />
        </div>
    );
});
