import { useState, memo } from 'react';

interface ImageWithLoaderProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    wrapperClassName?: string;
}

export const ImageWithLoader = memo(function ImageWithLoader({ wrapperClassName = '', className = '', ...props }: ImageWithLoaderProps) {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div className={`relative overflow-hidden ${wrapperClassName}`}>
            {/* Skeleton / Placeholder */}
            <div
                className={`absolute inset-0 bg-[#2C2C2E] transition-opacity duration-500 ${isLoaded ? 'opacity-0' : 'opacity-100 animate-pulse'
                    }`}
            />

            {/* Image */}
            <img
                {...props}
                className={`${className} transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                onLoad={(e) => {
                    setIsLoaded(true);
                    props.onLoad?.(e);
                }}
            />
        </div>
    );
});
