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
                className="w-full bg-[#3A3A3C] rounded-full overflow-hidden"
                style={{ height: `${height}px` }}
            >
                <div
                    className="h-full bg-white rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                />
            </div>
            {showLabel && (
                <p className="text-xs text-gray-400 mt-1 text-center">{percentage}%</p>
            )}
        </div>
    );
});
