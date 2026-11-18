import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../model/AuthContext';

/** Renders children for a guest; a signed-in user is sent home. */
export function GuestRoute({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <>{fallback}</>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
