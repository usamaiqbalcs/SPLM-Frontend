/**
 * ProtectedRoute.tsx — Auth gate for nested routes
 *
 * Place this as the parent element of any <Route> tree that requires
 * an authenticated user.  Unauthenticated visitors are redirected to
 * /login.  The `state.from` payload lets LoginPage redirect back to the
 * originally requested URL after successful authentication.
 *
 * Usage in App.tsx:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/" element={<AppLayout />}>
 *       ...child routes...
 *     </Route>
 *   </Route>
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // AuthProvider restores the JWT from localStorage synchronously on mount,
  // so `loading` is true only for the brief window while /auth/me is called
  // to validate the stored token.  Rendering null avoids a flash to /login.
  if (loading) return null;

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // Authenticated — render child routes
  return <Outlet />;
}
