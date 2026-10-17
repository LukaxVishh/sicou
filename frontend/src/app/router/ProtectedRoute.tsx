import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../features/auth/providers';
import { SystemLoadingState } from '../../shared/components';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <SystemLoadingState label="Carregando sessão..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Outlet />;
}
