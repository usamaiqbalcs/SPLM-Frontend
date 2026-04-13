import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { KeyRound, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password, name);
        setSuccess('Account created! Check your email to confirm.');
        const from = (location.state as any)?.from?.pathname ?? '/dashboard';
        navigate(from, { replace: true });
      } else {
        await signIn(email, password);
        const from = (location.state as any)?.from?.pathname ?? '/dashboard';
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
              Z
            </div>
            <div>
              <span className="text-lg font-bold text-foreground">ZenaTech</span>
              <span className="text-lg font-normal text-sky ml-1">SPLM</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Software Product Lifecycle Management</p>
        </div>

        <div className="portal-card p-6">
          {/* Auth mode tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
            <button
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            >
              <KeyRound size={13} />
              Sign In
            </button>
            <button
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
            >
              <Sparkles size={13} />
              Create Account
            </button>
          </div>

          {success && (
            <div className="flex items-center gap-2 text-xs text-success bg-success-bg border border-success/20 rounded-lg px-3 py-2 mb-4">
              ✓ {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Full Name</label>
                  <input
                    className="portal-input"
                    type="text"
                    placeholder="Shaun Passley"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Email Address</label>
                <input
                  className="portal-input"
                  type="email"
                  placeholder="you@zenatech.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus={mode === 'login'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Password</label>
                <input
                  className="portal-input"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="portal-btn-primary w-full justify-center py-2.5"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="portal-spinner" style={{ width: 14, height: 14 }} />
                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                  </>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {mode === 'login' ? <KeyRound size={14} /> : <Sparkles size={14} />}
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security info */}
        <div className="mt-4 space-y-1 px-1 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
            <ShieldCheck size={12} className="shrink-0" />
            <span className="min-w-0">TLS 1.3 · JWT bearer tokens · AES-256 encryption</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            NASDAQ: ZENA · FSE: 49Q · BMV: ZENA
          </div>
        </div>
      </div>
    </div>
  );
}
