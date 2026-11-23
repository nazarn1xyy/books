import type { ReactNode } from 'react';

/** Shared responsive grid for book covers (Home, Search). */
export function BookGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-6 ${className}`}>
      {children}
    </div>
  );
}
