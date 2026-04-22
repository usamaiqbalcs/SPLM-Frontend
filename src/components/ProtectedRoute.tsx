/**
 * ProtectedRoute.tsx — Auth gate for nested routes
 *
 * Place this as the parent element of any <Route> tree that requires
 * an authenticated user.  Unauthenticated visitors are redirected to
 * /login.  After sign-in, the app always opens the dashboard.
 *
 * Usage in App.tsx:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/" element={<AppLayout />}>
 *       ...child routes...
 *     </Route>
 *   </Route>
 */

import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute() {
  const { user, loading, profile, signOut } = useAuth();

  useEffect(() => {
    if (!loading && user && profile && !profile.active) {
      void signOut();
    }
  }, [loading, user, profile, signOut]);

  // AuthProvider restores the JWT from localStorage synchronously on mount,
  // so `loading` is true only for the brief window while /auth/me is called
  // to validate the stored token.  Rendering null avoids a flash to /login.
  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile && !profile.active) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated — render child routes
  return <Outlet />;
}
