interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-[#2C2C2E] rounded-xl ${className}`}
        />
    );
}

export function BookCardSkeleton() {
    return (
        <div className="w-36 flex-shrink-0">
            <Skeleton className="w-full h-52 rounded-xl" />
            <Skeleton className="h-4 w-full mt-2" />
            <Skeleton className="h-3 w-2/3 mt-1" />
        </div>
    );
}

export function BookListSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
            {Array.from({ length: count }).map((_, i) => (
                <BookCardSkeleton key={i} />
            ))}
        </div>
    );
}
