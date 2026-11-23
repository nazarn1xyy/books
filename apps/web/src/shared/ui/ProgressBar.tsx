import { memo } from 'react';

interface ProgressBarProps {
    percentage: number;
    height?: number;
    showLabel?: boolean;
}

export const ProgressBar = memo(function ProgressBar({ percentage, height = 4, showLabel = false }: ProgressBarProps) {
    return (
        <div className="w-full">
            <div
                className="w-full bg-surface-2 rounded-full overflow-hidden"
                style={{ height: `${height}px` }}
            >
                <div
                    className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                />
            </div>
            {showLabel && (
                <p className="text-xs text-muted mt-1 text-center">{percentage}%</p>
            )}
        </div>
    );
});
