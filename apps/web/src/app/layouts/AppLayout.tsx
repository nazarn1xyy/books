import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { Sidebar } from './Sidebar';
import { PageFallback } from './PageFallback';

/** Signed-in shell: page content plus Sidebar (lg) / BottomNav (mobile). */
export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <>
      <div className="min-h-screen bg-app animate-page-in lg:ml-[var(--sidebar-width)]" key={pathname}>
        <RouteErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </div>
      <Sidebar />
      <BottomNav />
    </>
  );
}

/** Full-screen page without the navigation shell (reader, auth). */
export function BareLayout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-app animate-page-in" key={pathname}>
      <RouteErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </RouteErrorBoundary>
    </div>
  );
}
