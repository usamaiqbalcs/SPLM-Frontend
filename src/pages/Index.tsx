import { useAuth, AuthProvider } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';
import AppLayout from '@/components/AppLayout';

function AppContent() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <span className="portal-spinner" style={{ width: 24, height: 24 }} />
        <p className="text-sm text-muted-foreground mt-3">Loading…</p>
      </div>
    </div>
  );
  return user ? <AppLayout /> : <LoginPage />;
}

export default function Index() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
