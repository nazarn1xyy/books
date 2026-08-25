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

        const isAtTop = () => {
            return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (isAtTop() && e.touches.length === 1) {
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

            // If user scrolled down into the page, disable pull-to-refresh
            if (!isAtTop()) {
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

            // If user is swiping horizontally or scrolling down the page, ignore
            if (diffY <= 0 || Math.abs(diffX) > Math.abs(diffY)) {
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

        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, []);

    return { containerRef, isRefreshing, pullProgress };
}
