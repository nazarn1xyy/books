import { ProgressBar } from '@/shared/ui/ProgressBar';

interface ReaderFooterProps {
    scrollProgress: number;
}

export function ReaderFooter({ scrollProgress }: ReaderFooterProps) {
    return (
        <footer className="px-4 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-[var(--reader-bg)]/90 backdrop-blur-xl border-t border-white/5 z-10 flex-shrink-0">
            <div className="max-w-3xl mx-auto w-full">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <ProgressBar percentage={scrollProgress} height={4} />
                    </div>
                    <span className="text-xs reader-muted tabular-nums w-10 text-right font-medium">{scrollProgress}%</span>
                </div>
            </div>
        </footer>
    );
}
