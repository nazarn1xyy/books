import { useState, useEffect } from 'react';
import { getCachedBook } from '../utils/cache';

export function useBookCover(bookId: string, initialCover?: string) {
    const [cover, setCover] = useState<string>(initialCover || '');

    useEffect(() => {
        // If we already have a specialized URL or placeholder, just use it.
        // But if it's empty or we want to ensure we have the cached version (for base64 offloading):
        // Strategy: If initialCover is provided and looks like a remote URL, keep it.
        // If it's a data-uri, it's fine (but we want to stop passing it in props to avoid bloating DOM/State if we can help it, 
        // though React state is fine, localstorage is the issue).

        // Main case: props has no cover (because we stripped it from localStorage), but IDB has it.
        if (!initialCover || initialCover === '') {
            let mounted = true;
            getCachedBook(bookId).then(cached => {
                if (mounted && cached?.cover) {
                    setCover(cached.cover);
                }
            });
            return () => { mounted = false; };
        } else {
            setCover(initialCover);
        }
    }, [bookId, initialCover]);

    return cover;
}
