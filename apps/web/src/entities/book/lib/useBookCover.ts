import { useState, useEffect } from 'react';
import { getCachedBook } from '@/shared/catalog/bookCache';

const _coverMemoryCache = new Map<string, string>();

function isRealCover(url?: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed.length > 0 && !trimmed.includes('placehold.co');
}

export function useBookCover(bookId: string, initialCover?: string) {
    const hasInitial = isRealCover(initialCover);
    if (hasInitial) {
        _coverMemoryCache.set(bookId, initialCover!);
    }

    const [cachedCover, setCachedCover] = useState<string>(() => {
        if (hasInitial) return initialCover!;
        return _coverMemoryCache.get(bookId) || '';
    });

    useEffect(() => {
        if (!hasInitial && !_coverMemoryCache.has(bookId)) {
            let mounted = true;
            getCachedBook(bookId).then(cached => {
                if (mounted && cached?.cover && isRealCover(cached.cover)) {
                    _coverMemoryCache.set(bookId, cached.cover);
                    setCachedCover(cached.cover);
                }
            }).catch(() => {});

            return () => {
                mounted = false;
            };
        }
    }, [bookId, hasInitial]);

    if (hasInitial) {
        return initialCover!;
    }

    return _coverMemoryCache.get(bookId) || cachedCover || '';
}
