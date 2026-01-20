import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function useScrollRestoration() {
    const { pathname } = useLocation();
    const navType = useNavigationType();

    useEffect(() => {
        // Unique key for each path
        const key = `scroll-pos-${pathname}`;

        // Handler to save scroll position
        const saveScroll = () => {
            sessionStorage.setItem(key, window.scrollY.toString());
        };

        // Save on scroll (debounced could be better, but simple is fine for now)
        window.addEventListener('scroll', saveScroll);

        // Initial restoration logic
        const restoreScroll = () => {
            const savedPos = sessionStorage.getItem(key);
            if (savedPos !== null) {
                // If reload or pop (back/forward), restore
                // Standard navigation (PUSH) should usually start at top
                // But user specifically asked for "reload" persistence.
                // We generally scroll to top on PUSH, restore on everything else?
                // Actually, if we just want reload persistence, we check for that.
                // But back/forward should also restore.

                if (navType === 'POP') {
                    // Browser handles this strictly speaking, but we can ensure it
                    window.scrollTo(0, parseInt(savedPos, 10));
                } else {
                    // For reload, navType is theoretically POP in some browsers or just mount
                    // Let's rely on performance API for reload detection if reliable
                    // Or simpler: always restore if key exists AND (we just reloaded OR we went back)
                    // But if we clicked a link to here, we want top.

                    // Simple logic for this specific requirements:
                    // If we are mounting and have a saved pos, check if it's a reload.
                    const isReload = (window.performance?.getEntriesByType("navigation")[0] as PerformanceNavigationTiming)?.type === 'reload';
                    if (isReload) {
                        window.scrollTo(0, parseInt(savedPos, 10));
                    } else if (navType === 'PUSH' || navType === 'REPLACE') {
                        // New navigation -> To Top
                        window.scrollTo(0, 0);
                    }
                }
            } else {
                // No saved pos -> Top
                window.scrollTo(0, 0);
            }
        };

        // Need to handle strict scrolling behavior
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }

        restoreScroll();

        return () => {
            window.removeEventListener('scroll', saveScroll);
            // Ensure we save on unmount too just in case
            saveScroll();
        };
    }, [pathname, navType]);
}
