import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function useScrollRestoration() {
    const { pathname } = useLocation();
    const navType = useNavigationType();
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Unique key for each path
        const key = `scroll-pos-${pathname}`;

        // Check if any input is focused (keyboard is likely open)
        const isInputFocused = () => {
            const active = document.activeElement;
            return active instanceof HTMLInputElement ||
                active instanceof HTMLTextAreaElement ||
                active?.getAttribute('contenteditable') === 'true';
        };

        // Handler to save scroll position with debounce
        const saveScroll = () => {
            // Don't save when input is focused (keyboard causes scroll jumps)
            if (isInputFocused()) return;

            // Debounce: clear previous timeout and set new one
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            scrollTimeoutRef.current = setTimeout(() => {
                sessionStorage.setItem(key, window.scrollY.toString());
            }, 200); // 200ms debounce
        };

        window.addEventListener('scroll', saveScroll, { passive: true });

        // Initial restoration logic
        const restoreScroll = () => {
            const savedPos = sessionStorage.getItem(key);
            if (savedPos !== null) {
                if (navType === 'POP') {
                    // Browser back/forward
                    window.scrollTo(0, parseInt(savedPos, 10));
                } else {
                    // Check if it's a reload
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

        // Handle strict scrolling behavior
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }

        restoreScroll();

        return () => {
            window.removeEventListener('scroll', saveScroll);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [pathname, navType]);
}
