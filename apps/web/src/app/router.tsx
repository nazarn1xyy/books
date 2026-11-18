import { Route, Routes } from 'react-router-dom';
import { AuthPage, GuestRoute, ProtectedRoute } from '@/features/auth';
import { useScrollRestoration } from '@/shared/lib/hooks/useScrollRestoration';
import { lazyWithReload } from '@/shared/lib/lazyWithReload';
import { AppLayout, BareLayout } from './layouts/AppLayout';
import { PageFallback } from './layouts/PageFallback';

const HomePage = lazyWithReload(() => import('@/features/home').then((m) => ({ default: m.HomePage })));
const SearchPage = lazyWithReload(() => import('@/features/search').then((m) => ({ default: m.SearchPage })));
const MyBooksPage = lazyWithReload(() => import('@/features/library').then((m) => ({ default: m.MyBooksPage })));
const ReaderPage = lazyWithReload(() => import('@/features/reader').then((m) => ({ default: m.ReaderPage })));
const AdminPage = lazyWithReload(() => import('@/features/admin').then((m) => ({ default: m.AdminPage })));

export function AppRoutes() {
  useScrollRestoration();
  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
      <Routes>
        <Route element={<BareLayout />}>
          <Route
            path="/auth"
            element={
              <GuestRoute fallback={<PageFallback />}>
                <AuthPage />
              </GuestRoute>
            }
          />
          <Route
            path="/reader/:id"
            element={
              <ProtectedRoute fallback={<PageFallback />}>
                <ReaderPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route
          element={
            <ProtectedRoute fallback={<PageFallback />}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/my-books" element={<MyBooksPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </div>
  );
}
