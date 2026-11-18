import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../model/AuthContext';

/** Renders children for a signed-in user; sends guests to /auth. `fallback` shows while auth initializes. */
export function ProtectedRoute({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <>{fallback}</>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
