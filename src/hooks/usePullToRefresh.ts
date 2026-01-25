import { useEffect, useRef, useState } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<void>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let startY = 0;
        let isDragging = false;

        const handleTouchStart = (e: TouchEvent) => {
            if (container.scrollTop === 0) {
                startY = e.touches[0].clientY;
                isDragging = true;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;

            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 0 && container.scrollTop === 0) {
                // Resistance effect
                const progress = Math.min(diff * 0.5, 120);
                setPullProgress(progress);

                // Prevent default scroll if pulling down at top
                if (diff > 0 && e.cancelable) {
                    e.preventDefault();
                }
            } else {
                setPullProgress(0);
            }
        };

        const handleTouchEnd = async () => {
            if (!isDragging) return;
            isDragging = false;

            if (pullProgress > 80) { // Threshold to trigger refresh
                setIsRefreshing(true);
                setPullProgress(80); // Snap to loading position

                try {
                    // Min 1s loading for better UX
                    const start = Date.now();
                    await onRefresh();
                    const elapsed = Date.now() - start;
                    if (elapsed < 1000) {
                        await new Promise(r => setTimeout(r, 1000 - elapsed));
                    }
                } finally {
                    setIsRefreshing(false);
                    setPullProgress(0);
                }
            } else {
                setPullProgress(0);
            }
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [onRefresh, pullProgress]);

    return { containerRef, isRefreshing, pullProgress };
}
