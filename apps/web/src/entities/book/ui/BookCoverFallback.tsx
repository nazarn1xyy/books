import { memo } from 'react';

type CoverSize = 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large';

interface BookCoverFallbackProps {
    title: string;
    author?: string;
    /** Kept for callers; the typeset cover no longer shows the format. */
    format?: 'pdf' | 'fb2' | string;
    size?: CoverSize;
    className?: string;
}

// Muted cloth-binding tones: white type stays above 9:1 on every one of them.
const COVER_TONES = [
    'from-[#26324f] to-[#1a2238]', // ink blue
    'from-[#24463a] to-[#183029]', // forest
    'from-[#562a2e] to-[#3b1c1f]', // oxblood
    'from-[#4a3424] to-[#302217]', // umber
    'from-[#33373f] to-[#22252b]', // slate
    'from-[#1f4446] to-[#152e30]', // deep teal
    'from-[#47303c] to-[#2f2028]', // mulberry
];

/**
 * Deterministically generates an index for the gradient based on book title.
 */
function getGradientIndex(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % COVER_TONES.length;
}

export const BookCoverFallback = memo(function BookCoverFallback({
    title,
    author,
    size = 'md',
    className = '',
}: BookCoverFallbackProps) {
    const gradient = COVER_TONES[getGradientIndex(title || 'Book')];

    const normalizedSize: 'sm' | 'md' | 'lg' = 
        size === 'small' ? 'sm' : size === 'large' ? 'lg' : size === 'medium' ? 'md' : size;

    const sizeStyles = {
        sm: { titleSize: 'text-xs leading-tight', authorSize: 'text-[11px]', padding: 'p-2.5' },
        md: { titleSize: 'text-sm leading-snug', authorSize: 'text-xs', padding: 'p-3.5' },
        lg: { titleSize: 'text-lg leading-tight', authorSize: 'text-sm', padding: 'p-5' },
    }[normalizedSize];

    return (
        <div
            className={`w-full h-full bg-gradient-to-br ${gradient} ${sizeStyles.padding} flex flex-col justify-between select-none relative overflow-hidden text-white ${className}`}
            style={{ aspectRatio: '2/3' }}
        >
            {/* Book spine shadow (left edge depth) */}
            <div className="absolute left-0 top-0 bottom-0 w-3.5 bg-gradient-to-r from-black/40 via-white/5 to-transparent pointer-events-none" />

            {/* Subtle top sheen */}
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

            {/* Typeset cover: title and author are the whole design. */}
            <div className="z-10 my-auto">
                <p
                    className={`font-serif font-bold text-white tracking-tight line-clamp-4 text-balance ${sizeStyles.titleSize}`}
                    title={title}
                >
                    {title || 'Без назви'}
                </p>
                {author && (
                    <p className={`mt-2 text-white/85 line-clamp-2 ${sizeStyles.authorSize}`} title={author}>
                        {author}
                    </p>
                )}
            </div>
        </div>
    );
});
