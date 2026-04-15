export const semverBump = (v: string, type: string): string => {
  const [maj, min, pat] = (v || '1.0.0').replace(/^v/, '').split('.').map(Number);
  if (type === 'major') return `${maj + 1}.0.0`;
  if (type === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
};

/** Normalize API date / ISO strings for `<input type="date" />` (yyyy-MM-dd). */
export function toHtmlDateInputValue(d: string | null | undefined): string {
  if (d == null || d === '') return '';
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const x = new Date(s);
    if (Number.isNaN(x.getTime())) return '';
    return x.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export const fmtDate = (d: string | null): string => {
  if (!d) return '—';
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
};

export const fmtDateTime = (d: string | null): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
};

export const scoreColor = (s: number) => s >= 75 ? 'text-success' : s >= 50 ? 'text-warning' : 'text-danger';

export const ENV_CONFIG = {
  development: { label: 'Development', icon: '🧪', description: 'Internal testing' },
  staging: { label: 'Staging', icon: '🔬', description: 'Pre-production QA' },
  production: { label: 'Production', icon: '🚀', description: 'Live customer traffic' },
} as const;
