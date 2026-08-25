import { memo } from 'react';
import { BookOpen, FileText } from 'lucide-react';

type CoverSize = 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large';

interface BookCoverFallbackProps {
    title: string;
    author?: string;
    format?: 'pdf' | 'fb2' | string;
    size?: CoverSize;
    className?: string;
}

// Curated palette of rich, deep Apple Books-style gradients
const COVER_GRADIENTS = [
    'from-[#1e1b4b] via-[#312e81] to-[#0f172a]', // Indigo Midnight
    'from-[#064e3b] via-[#065f46] to-[#022c22]', // Emerald Pine
    'from-[#4c0519] via-[#881337] to-[#2e020d]', // Royal Burgundy
    'from-[#451a03] via-[#78350f] to-[#1c0a00]', // Warm Amber/Espresso
    'from-[#0f172a] via-[#1e293b] to-[#020617]', // Midnight Slate
    'from-[#3b0764] via-[#581c87] to-[#1e053a]', // Deep Violet
    'from-[#134e4a] via-[#0f766e] to-[#042f2e]', // Ocean Teal
    'from-[#701a75] via-[#86198f] to-[#4a044e]', // Plum Velvet
    'from-[#1e293b] via-[#334155] to-[#0f172a]', // Charcoal Steel
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
    return Math.abs(hash) % COVER_GRADIENTS.length;
}

export const BookCoverFallback = memo(function BookCoverFallback({
    title,
    author,
    format = 'fb2',
    size = 'md',
    className = '',
}: BookCoverFallbackProps) {
    const gradient = COVER_GRADIENTS[getGradientIndex(title || 'Book')];
    const isPdf = format?.toLowerCase() === 'pdf';

    const normalizedSize: 'sm' | 'md' | 'lg' = 
        size === 'small' ? 'sm' : size === 'large' ? 'lg' : size === 'medium' ? 'md' : size;

    const sizeStyles = {
        sm: {
            titleSize: 'text-[11px] leading-tight',
            authorSize: 'text-[9px]',
            iconSize: 14,
            padding: 'p-2.5',
            badgeSize: 'text-[8px] px-1.5 py-0.5',
        },
        md: {
            titleSize: 'text-xs leading-snug',
            authorSize: 'text-[10px]',
            iconSize: 18,
            padding: 'p-3',
            badgeSize: 'text-[9px] px-2 py-0.5',
        },
        lg: {
            titleSize: 'text-sm font-bold leading-tight',
            authorSize: 'text-xs',
            iconSize: 24,
            padding: 'p-4',
            badgeSize: 'text-[10px] px-2.5 py-1',
        },
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

            {/* Top header: Format badge & Icon */}
            <div className="flex items-center justify-between z-10 w-full">
                <span className={`bg-black/30 backdrop-blur-sm rounded font-semibold uppercase tracking-wider text-white/80 border border-white/10 ${sizeStyles.badgeSize}`}>
                    {isPdf ? 'PDF' : 'FB2'}
                </span>
                <div className="text-white/40">
                    {isPdf ? <FileText size={sizeStyles.iconSize} /> : <BookOpen size={sizeStyles.iconSize} />}
                </div>
            </div>

            {/* Middle: Title & Author */}
            <div className="z-10 my-auto py-1">
                <h4
                    className={`font-serif font-bold text-white tracking-tight line-clamp-3 ${sizeStyles.titleSize}`}
                    title={title}
                >
                    {title || 'Без названия'}
                </h4>
                {author && (
                    <p
                        className={`text-white/70 font-sans mt-1 line-clamp-1 ${sizeStyles.authorSize}`}
                        title={author}
                    >
                        {author}
                    </p>
                )}
            </div>

            {/* Bottom accent line */}
            <div className="z-10 w-full flex items-center justify-between pt-1 border-t border-white/10 text-white/40">
                <span className="text-[9px] uppercase tracking-widest font-semibold opacity-60">Libify</span>
                <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
            </div>
        </div>
    );
});
