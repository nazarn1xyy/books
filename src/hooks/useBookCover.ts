import { useState, useEffect } from 'react';
import { getCachedBook } from '../utils/cache';

export function useBookCover(bookId: string, initialCover?: string) {
    const [cachedCover, setCachedCover] = useState<string>('');

    useEffect(() => {
        if (!initialCover) {
            let mounted = true;
            getCachedBook(bookId).then(cached => {
                if (mounted && cached?.cover) {
                    setCachedCover(cached.cover);
                }
            }).catch(() => {});
            return () => { mounted = false; };
        }
    }, [bookId, initialCover]);

    return initialCover || cachedCover || '';
}
