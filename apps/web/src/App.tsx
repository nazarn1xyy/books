import { Suspense, lazy, type ReactNode, type ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Auth } from './pages/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy import with retry logic for failed chunk loads
function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  delay = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    for (let i = 0; i < retries; i++) {
      try {
        return await importFn();
      } catch (error) {
        console.warn(`Chunk load failed, attempt ${i + 1}/${retries}`, error);
        if (i === retries - 1) {
          throw error;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
    // This shouldn't be reached, but TypeScript needs it
    throw new Error('Failed to load chunk after retries');
  });
}

// Lazy load pages with retry
const Home = lazyWithRetry(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Search = lazyWithRetry(() => import('./pages/Search').then(module => ({ default: module.Search })));
const MyBooks = lazyWithRetry(() => import('./pages/MyBooks').then(module => ({ default: module.MyBooks })));
const Reader = lazyWithRetry(() => import('./pages/Reader').then(module => ({ default: module.Reader })));
const Admin = lazyWithRetry(() => import('./pages/Admin/Admin').then(module => ({ default: module.Admin })));

// Component to handle scroll restoration inside Router context
function ScrollHandler() {
  useScrollRestoration();
  return null;
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  // Wait for auth to initialize before deciding
  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

const PageWrapper = ({ children, hasSidebar = false }: { children: ReactNode; hasSidebar?: boolean }) => (
  <div className={`min-h-screen bg-black animate-page-in ${hasSidebar ? 'lg:ml-[var(--sidebar-width)]' : ''}`}>
    {children}
  </div>
);

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();

  const isNavHidden = location.pathname.startsWith('/reader/') || location.pathname === '/auth';

  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
      <ScrollHandler />
        <Suspense fallback={<LoadingFallback />}>
          <ErrorBoundary key={location.pathname}>
            <Routes location={location}>
              <Route path="/auth" element={
                <PageWrapper hasSidebar={false}>
                  {loading ? <LoadingFallback /> : user ? <Navigate to="/" replace /> : <Auth />}
                </PageWrapper>
              } />

              <Route path="/" element={
                <PageWrapper hasSidebar={!!user}>
                  <ProtectedRoute><Home /></ProtectedRoute>
                </PageWrapper>
              } />
              <Route path="/search" element={
                <PageWrapper hasSidebar={!!user}>
                  <ProtectedRoute><Search /></ProtectedRoute>
                </PageWrapper>
              } />
              <Route path="/my-books" element={
                <PageWrapper hasSidebar={!!user}>
                  <ProtectedRoute><MyBooks /></ProtectedRoute>
                </PageWrapper>
              } />
              <Route path="/reader/:id" element={
                <PageWrapper hasSidebar={false}>
                  <ProtectedRoute><Reader /></ProtectedRoute>
                </PageWrapper>
              } />
              <Route path="/admin" element={
                <PageWrapper hasSidebar={!!user}>
                  <ProtectedRoute><Admin /></ProtectedRoute>
                </PageWrapper>
              } />
            </Routes>
          </ErrorBoundary>
        </Suspense>

      {/* Show navigation only if authenticated and not in reader or auth mode */}
      {user && !isNavHidden && (
        <>
          <Sidebar />
          <BottomNav />
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
