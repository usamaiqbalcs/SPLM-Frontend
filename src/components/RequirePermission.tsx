import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Blocks rendering children (and thus lazy panel imports) unless the current
 * profile role grants `permission` per `splm-rbac` matrix. Use on routes that
 * must match sidebar RBAC so deep links cannot bypass the UI.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { can, loading, user } = useAuth();
  const location = useLocation();

  if (loading || !user) return null;

  if (!can(permission)) {
    return <Navigate to="/dashboard" replace state={{ deniedPath: location.pathname }} />;
  }

  return <>{children}</>;
}
