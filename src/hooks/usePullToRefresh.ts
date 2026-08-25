import { useEffect, useRef, useState } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<void>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);
    const pullProgressRef = useRef(0);
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    useEffect(() => {
        let startY = 0;
        let startX = 0;
        let isTopPull = false;

        const getScrollTop = () => {
            if (containerRef.current) {
                return containerRef.current.scrollTop;
            }
            return window.scrollY || document.documentElement.scrollTop || 0;
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (getScrollTop() <= 0 && e.touches.length === 1) {
                startY = e.touches[0].clientY;
                startX = e.touches[0].clientX;
                isTopPull = true;
            } else {
                isTopPull = false;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isTopPull || e.touches.length !== 1) {
                if (pullProgressRef.current > 0) {
                    pullProgressRef.current = 0;
                    setPullProgress(0);
                }
                return;
            }

            // If user scrolled down into the page, disable pull-to-refresh and never prevent default
            if (getScrollTop() > 0) {
                isTopPull = false;
                if (pullProgressRef.current > 0) {
                    pullProgressRef.current = 0;
                    setPullProgress(0);
                }
                return;
            }

            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const diffY = currentY - startY;
            const diffX = currentX - startX;

            // If user is swiping horizontally or scrolling down (finger moving up), cancel pull-to-refresh
            if (diffY <= 0 || Math.abs(diffX) > Math.abs(diffY)) {
                isTopPull = false;
                if (pullProgressRef.current > 0) {
                    pullProgressRef.current = 0;
                    setPullProgress(0);
                }
                return;
            }

            // Only activate pull indicator when pulling down from the very top
            if (diffY > 10) {
                const progress = Math.min(diffY * 0.4, 90);
                pullProgressRef.current = progress;
                setPullProgress(progress);
                if (e.cancelable) {
                    e.preventDefault();
                }
            }
        };

        const handleTouchEnd = async () => {
            isTopPull = false;

            if (pullProgressRef.current > 60) {
                setIsRefreshing(true);
                setPullProgress(60);
                pullProgressRef.current = 60;

                try {
                    const start = Date.now();
                    await onRefreshRef.current();
                    const elapsed = Date.now() - start;
                    if (elapsed < 800) {
                        await new Promise(r => setTimeout(r, 800 - elapsed));
                    }
                } finally {
                    setIsRefreshing(false);
                    setPullProgress(0);
                    pullProgressRef.current = 0;
                }
            } else {
                setPullProgress(0);
                pullProgressRef.current = 0;
            }
        };

        const target = containerRef.current || window;
        target.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true });
        target.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
        target.addEventListener('touchend', handleTouchEnd as EventListener, { passive: true });
        target.addEventListener('touchcancel', handleTouchEnd as EventListener, { passive: true });

        return () => {
            target.removeEventListener('touchstart', handleTouchStart as EventListener);
            target.removeEventListener('touchmove', handleTouchMove as EventListener);
            target.removeEventListener('touchend', handleTouchEnd as EventListener);
            target.removeEventListener('touchcancel', handleTouchEnd as EventListener);
        };
    }, []);

    return { containerRef, isRefreshing, pullProgress };
}
