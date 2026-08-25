import { useState, useEffect } from 'react';
import { getCachedBook } from '../utils/cache';

function isRealCover(url?: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed.length > 0 && !trimmed.includes('placehold.co');
}

export function useBookCover(bookId: string, initialCover?: string) {
    const [cachedCover, setCachedCover] = useState<string>('');

    useEffect(() => {
        if (!isRealCover(initialCover)) {
            let mounted = true;
            getCachedBook(bookId).then(cached => {
                if (mounted && cached?.cover && isRealCover(cached.cover)) {
                    setCachedCover(cached.cover);
                }
            }).catch(() => {});

            return () => {
                mounted = false;
            };
        }
    }, [bookId, initialCover]);

    if (isRealCover(initialCover)) {
        return initialCover!;
    }

    return cachedCover || '';
}
