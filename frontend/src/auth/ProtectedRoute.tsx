import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="bg-bg-raised text-text-muted p-4">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin) {
    const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (!adminEmails.includes(user.email)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
