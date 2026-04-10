import { useEffect, useState, useMemo } from 'react';
import { listReleases, saveRelease, deleteRelease, listProducts } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fmtDate } from '@/lib/splm-utils';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PackageCheck, CalendarDays, CheckSquare, Clock, XCircle } from 'lucide-react';

const STATUS_FLOW = ['planned', 'in_progress', 'staging', 'released', 'cancelled'] as const;
const TYPE_OPTIONS = ['planned', 'quarterly', 'major_platform', 'hotfix', 'emergency'] as const;

const DEFAULT_CHECKLIST = `[ ] Code review complete
[ ] Unit tests passing
[ ] Integration tests passing
[ ] Staging deployment verified
[ ] Security scan complete
[ ] Performance benchmarks checked
[ ] Release notes approved
[ ] Stakeholder sign-off obtained
[ ] Production deployment window confirmed
[ ] Rollback plan documented
[ ] Customer communication sent`;

const statusIcon: Record<string, React.ReactNode> = {
  planned:     <Clock className="w-4 h-4" />,
  in_progress: <PackageCheck className="w-4 h-4" />,
  staging:     <PackageCheck className="w-4 h-4" />,
  released:    <CheckSquare className="w-4 h-4" />,
  cancelled:   <XCircle className="w-4 h-4" />,
};

export default function ReleasesPanel() {
  const { can, user } = useAuth();
  const [items, setItems]       = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusF, setStatusF]   = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([listReleases(), listProducts()])
      .then(([r, p]) => { setItems(r); setProducts(p); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const pname = (id: string) => products.find(p => p.id === id)?.name ?? null;

  const blank = {
    name: '', type: 'planned', status: 'planned',
    target_date: '', checklist: DEFAULT_CHECKLIST, products_included: '',
  };

  const doSave = async () => {
    if (!form.name) return toast.error('Release name is required');
    setSaving(true);
    try {
      await saveRelease({ ...form, created_by: form.created_by || user?.id });
      toast.success(form.id ? 'Release updated' : 'Release created');
      load();
      setForm(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try { await deleteRelease(deleteId); toast.success('Release deleted'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setDeleteId(null); }
  };

  const toggleCheckItem = (idx: number) => {
    const lines = (form.checklist || '').split('\n');
    if (lines[idx]?.startsWith('[x]'))      lines[idx] = lines[idx].replace('[x]', '[ ]');
    else if (lines[idx]?.startsWith('[ ]')) lines[idx] = lines[idx].replace('[ ]', '[x]');
    setForm((f: any) => ({ ...f, checklist: lines.join('\n') }));
  };

  const getProgress = (checklist: string) => {
    const lines = (checklist || '').split('\n').filter(l => l.startsWith('['));
    const done = lines.filter(l => l.startsWith('[x]')).length;
    return lines.length ? { done, total: lines.length, pct: Math.round((done / lines.length) * 100) } : { done: 0, total: 0, pct: 0 };
  };

  // Stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = { planned: 0, in_progress: 0, staging: 0, released: 0, cancelled: 0 };
    items.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
    return counts;
  }, [items]);

  const filtered = useMemo(() =>
    items.filter(r => !statusF || r.status === statusF),
    [items, statusF]
  );

  // ── Form view ──────────────────────────────────────────────────────────────
  if (form) return (
    <div className="bg-card rounded-lg border p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-primary">{form.id ? 'Edit Release' : 'New Release'}</h3>
        <Button variant="outline" onClick={() => setForm(null)}>← Back</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Release Name *</Label>
          <Input
            className="mt-1"
            value={form.name || ''}
            onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
            placeholder="Q2 2026 Platform Release"
          />
        </div>
        <div>
          <Label>Type</Label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
            value={form.type}
            onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))}
          >
            {TYPE_OPTIONS.map(o => <option key={o}>{o.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <Label>Status</Label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
            value={form.status}
            onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
          >
            {STATUS_FLOW.map(o => <option key={o}>{o.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <Label>Target Date</Label>
          <Input
            type="date"
            className="mt-1"
            value={form.target_date || ''}
            onChange={e => setForm((f: any) => ({ ...f, target_date: e.target.value }))}
          />
        </div>

        {/* Product multi-select */}
        <div className="md:col-span-2">
          <Label>Products Included</Label>
          <div className="mt-1 flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[44px]">
            {products.map(p => {
              const ids: string[] = (form.products_included || '').split(',').map((s: string) => s.trim()).filter(Boolean);
              const checked = ids.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const next = checked ? ids.filter(id => id !== p.id) : [...ids, p.id];
                    setForm((f: any) => ({ ...f, products_included: next.join(',') }));
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                    checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  {p.name}
                </button>
              );
            })}
            {products.length === 0 && <span className="text-xs text-muted-foreground py-1">No products available</span>}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Click to select which products are included in this release</p>
        </div>
      </div>

      {/* Checklist */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <Label>Release Checklist</Label>
          <span className="text-xs text-muted-foreground font-semibold">
            {getProgress(form.checklist).done}/{getProgress(form.checklist).total} · {getProgress(form.checklist).pct}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-success rounded-full transition-all"
            style={{ width: `${getProgress(form.checklist).pct}%` }}
          />
        </div>
        <div className="space-y-1 max-h-[300px] overflow-y-auto border rounded-md p-2 bg-muted/20">
          {(form.checklist || '').split('\n').map((line: string, i: number) => {
            const checked = line.startsWith('[x]');
            const label = line.replace(/^\[.?\]\s*/, '');
            if (!label) return null;
            return (
              <label key={i} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2 hover:bg-muted/50 rounded transition-colors">
                <input type="checkbox" checked={checked} onChange={() => toggleCheckItem(i)} className="rounded flex-shrink-0" />
                <span className={cn('text-sm', checked && 'line-through text-muted-foreground')}>{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save Release'}</Button>
        <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
      </div>
    </div>
  );

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in space-y-4">
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={o => !o && setDeleteId(null)}
        title="Delete Release"
        description="This will permanently delete this release and its checklist."
        confirmLabel="Delete Release"
        variant="destructive"
        onConfirm={doDelete}
      />

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUS_FLOW.map(status => (
          <button
            key={status}
            onClick={() => setStatusF(statusF === status ? '' : status)}
            className={cn(
              'bg-card rounded-lg border p-3 text-left hover:shadow-sm transition-all cursor-pointer',
              statusF === status && 'ring-2 ring-primary'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">{status.replace(/_/g, ' ')}</span>
              <span className={cn(
                status === 'released' ? 'text-success' :
                status === 'cancelled' ? 'text-destructive' :
                status === 'in_progress' ? 'text-primary' :
                'text-muted-foreground'
              )}>{statusIcon[status]}</span>
            </div>
            <div className={cn(
              'text-2xl font-extrabold',
              status === 'released' ? 'text-success' :
              status === 'cancelled' ? 'text-destructive' :
              status === 'in_progress' ? 'text-primary' :
              'text-foreground'
            )}>{stats[status]}</div>
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div className="bg-card rounded-lg border p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            <PackageCheck className="w-5 h-5" />
            Releases ({filtered.length})
          </h3>
          <div className="flex gap-2">
            {statusF && (
              <Button variant="ghost" size="sm" onClick={() => setStatusF('')}>Clear filter</Button>
            )}
            {can('release') && (
              <Button onClick={() => setForm({ ...blank })}>+ New Release</Button>
            )}
          </div>
        </div>

        {loading ? <TableSkeleton /> :
          filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <PackageCheck className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="font-medium">No releases found</p>
              <p className="text-xs mt-1">Create a release to track deployment bundles</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => {
                const prog = getProgress(r.checklist);
                const includedIds: string[] = (r.products_included || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                const includedNames = includedIds.map(id => pname(id)).filter(Boolean);
                const isPast = r.target_date && r.target_date < new Date().toISOString().split('T')[0];
                return (
                  <div
                    key={r.id}
                    className={cn(
                      'border rounded-lg p-4 hover:shadow-sm transition-shadow group',
                      r.status === 'released' ? 'border-success/30 bg-success/5' :
                      r.status === 'cancelled' ? 'border-muted bg-muted/20 opacity-60' :
                      r.status === 'in_progress' ? 'border-primary/30' :
                      'bg-muted/20'
                    )}
                  >
                    <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                      <div>
                        <div className="flex gap-2 items-center flex-wrap mb-1">
                          <span className="font-bold text-sm">{r.name}</span>
                          <StatusBadge status={r.type || 'planned'} />
                          <StatusBadge status={r.status || 'planned'} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className={cn('flex items-center gap-1', isPast && r.status !== 'released' ? 'text-destructive' : '')}>
                            <CalendarDays className="w-3 h-3" />
                            Target: {fmtDate(r.target_date) || 'No date set'}
                          </span>
                          {includedNames.length > 0 && (
                            <span className="flex gap-1">
                              {includedNames.slice(0, 3).map((n, i) => (
                                <span key={i} className="bg-secondary text-primary px-1.5 py-0.5 rounded text-[10px] font-semibold">{n}</span>
                              ))}
                              {includedNames.length > 3 && <span className="text-[10px] text-muted-foreground">+{includedNames.length - 3}</span>}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        {can('release') && <Button size="sm" variant="outline" onClick={() => setForm(r)}>Edit</Button>}
                        {can('release') && <Button size="sm" variant="destructive" onClick={() => setDeleteId(r.id)}>Delete</Button>}
                      </div>
                    </div>

                    {/* Checklist progress */}
                    {prog.total > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1">
                          <div
                            className={cn('h-full rounded-full transition-all', prog.pct === 100 ? 'bg-success' : 'bg-primary')}
                            style={{ width: `${prog.pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                          {prog.done}/{prog.total} items
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}
