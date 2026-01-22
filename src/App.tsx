import { Suspense, lazy, type ReactNode, type ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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

const PageWrapper = ({ children }: { children: ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.98 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="min-h-screen bg-black lg:ml-[var(--sidebar-width)]"
  >
    {children}
  </motion.div>
);

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      <ScrollHandler />
      <AnimatePresence mode="sync">
        <Suspense fallback={<LoadingFallback />}>
          <ErrorBoundary key={location.pathname}>
            <Routes location={location} key={location.pathname}>
              <Route path="/auth" element={
                <PageWrapper>
                  {loading ? <LoadingFallback /> : user ? <Navigate to="/" replace /> : <Auth />}
                </PageWrapper>
              } />

              <Route path="/" element={
                <PageWrapper>
                  <ProtectedRoute><Home /></ProtectedRoute>
                </PageWrapper>
              } />
              <Route path="/search" element={
                <PageWrapper>
                  <ProtectedRoute><Search /></ProtectedRoute>
                </PageWrapper>
              } />
              <Route path="/my-books" element={
                <PageWrapper>
                  <ProtectedRoute><MyBooks /></ProtectedRoute>
                </PageWrapper>
              } />
              <Route path="/reader/:id" element={
                <PageWrapper>
                  <ProtectedRoute><Reader /></ProtectedRoute>
                </PageWrapper>
              } />
              <Route path="/admin" element={
                <PageWrapper>
                  <Admin />
                </PageWrapper>
              } />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </AnimatePresence>

      {/* Show nav only if authenticated and not on Auth page */}
      {user && (
        <>
          {/* Desktop Sidebar */}
          <Routes>
            <Route path="/reader/:id" element={null} />
            <Route path="/auth" element={null} />
            <Route path="*" element={<Sidebar />} />
          </Routes>
          {/* Mobile Bottom Nav */}
          <Routes>
            <Route path="/reader/:id" element={null} />
            <Route path="/auth" element={null} />
            <Route path="*" element={<BottomNav />} />
          </Routes>
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
