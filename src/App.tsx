import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav } from './components/BottomNav';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Auth } from './pages/Auth';

// Lazy load pages
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Search = lazy(() => import('./pages/Search').then(module => ({ default: module.Search })));
const MyBooks = lazy(() => import('./pages/MyBooks').then(module => ({ default: module.MyBooks })));
const Reader = lazy(() => import('./pages/Reader').then(module => ({ default: module.Reader })));
const Admin = lazy(() => import('./pages/Admin/Admin').then(module => ({ default: module.Admin })));

// ... existing code ...

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
          </Routes >

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
  const { user } = useAuth();
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
    className="min-h-screen bg-black"
  >
    {children}
  </motion.div>
);

function AppContent() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      <ScrollHandler />
      <AnimatePresence mode="wait">
        <Suspense fallback={<LoadingFallback />}>
          <Routes location={location} key={location.pathname}>
            <Route path="/auth" element={
              <PageWrapper>
                {user ? <Navigate to="/" replace /> : <Auth />}
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
          </Routes>
        </Suspense>
      </AnimatePresence>

      {/* Show nav only if authenticated and not on Auth page */}
      {user && (
        <Routes>
          <Route path="/reader/:id" element={null} />
          <Route path="/auth" element={null} />
          <Route path="*" element={<BottomNav />} />
        </Routes>
      )}
    </div>
  );
}

import { ErrorBoundary } from './components/ErrorBoundary';

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
