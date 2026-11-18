import type { ReactNode } from 'react';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

/**
 * Isolates a page: an error shows the fallback in place of the page only, navigation keeps working.
 * Give it `key={pathname}` so moving to another page clears the error.
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
