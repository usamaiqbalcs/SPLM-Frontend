import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { authPublicApi } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/\\`~]/;

function passwordMeetsPolicy(p: string): string | null {
  if (p.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(p)) return 'Password must include a letter.';
  if (!/\d/.test(p)) return 'Password must include a number.';
  if (!SPECIAL_RE.test(p)) return 'Password must include a special character.';
  return null;
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = params.get('token')?.trim() ?? '';

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');

  const validate = useCallback(async () => {
    if (!tokenFromUrl || tokenFromUrl.length < 20) {
      setChecking(false);
      setTokenValid(false);
      return;
    }
    setChecking(true);
    setError('');
    try {
      const res = await authPublicApi.validateResetToken(tokenFromUrl);
      setTokenValid(res.valid);
    } catch {
      setTokenValid(false);
    } finally {
      setChecking(false);
    }
  }, [tokenFromUrl]);

  useEffect(() => {
    void validate();
  }, [validate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDoneMessage('');
    const policy = passwordMeetsPolicy(password);
    if (policy) {
      setError(policy);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await authPublicApi.resetPassword({
        token: tokenFromUrl,
        newPassword: password,
        confirmPassword: confirm,
      });
      setDoneMessage(res.message || 'Your password has been updated.');
      setTimeout(() => navigate('/login', { replace: true }), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
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
          <p className="text-sm text-muted-foreground">Set a new password</p>
        </div>

        <div className="portal-card p-6">
          {checking ? (
            <p className="text-sm text-muted-foreground text-center py-6">Checking your reset link…</p>
          ) : !tokenFromUrl || !tokenValid ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden />
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired. Request a new link from your administrator.
              </p>
              <Button type="button" variant="outline" onClick={() => navigate('/login', { replace: true })}>
                Back to sign in
              </Button>
            </div>
          ) : doneMessage ? (
            <div className="text-center py-4 space-y-3">
              <KeyRound className="h-10 w-10 mx-auto text-emerald-600" aria-hidden />
              <p className="text-sm text-foreground">{doneMessage}</p>
              <p className="text-xs text-muted-foreground">Redirecting to sign in…</p>
            </div>
          ) : (
            <form onSubmit={e => void onSubmit(e)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose a new password for your account. The link can only be used once.
              </p>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">New password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Confirm password</label>
                <div className="relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                At least 8 characters, including a letter, a number, and a special character.
              </p>
              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="ghost" onClick={() => navigate('/login', { replace: true })}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Update password'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
