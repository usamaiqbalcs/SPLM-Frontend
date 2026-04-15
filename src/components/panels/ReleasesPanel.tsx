import { useEffect, useState, useMemo } from 'react';
import { listReleasesPage, saveRelease, deleteRelease, listProductsForDropdown } from '@/lib/api';
import { ListPageSearchInput, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fmtDate, toHtmlDateInputValue } from '@/lib/splm-utils';
import { DateField } from '@/components/ui/date-field';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { SearchableProductMultiSelect } from '@/components/forms/SearchableProductMultiSelect';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [serverStats, setServerStats] = useState({
    planned: 0, in_progress: 0, staging: 0, released: 0, cancelled: 0, total: 0,
  });
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const debouncedSearch = useListPageSearchDebounce(search);

  const load = () => {
    setLoading(true);
    Promise.all([
      listReleasesPage({
        page,
        pageSize,
        status: statusF || undefined,
        search: debouncedSearch || undefined,
      }),
      listProductsForDropdown(),
    ])
      .then(([data, p]) => {
        setItems(data.items);
        setProducts(p);
        setTotalPages(Math.max(1, data.total_pages));
        setTotalCount(data.total_count);
        const st = data.stats;
        setServerStats({
          planned: st?.planned ?? 0,
          in_progress: st?.in_progress ?? 0,
          staging: st?.staging ?? 0,
          released: st?.released ?? 0,
          cancelled: st?.cancelled ?? 0,
          total: st?.total ?? 0,
        });
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusF]);
  useEffect(() => {
    load();
  }, [page, statusF, debouncedSearch]);

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

  /** Mark every `[ ]` / `[x]` checklist line as checked or unchecked. */
  const setAllChecklistChecked = (checked: boolean) => {
    setForm((f: any) => {
      const lines = (f.checklist || '').split('\n');
      const next = lines.map((line: string) => {
        if (/^\[[ x]\]\s*/.test(line)) {
          const body = line.replace(/^\[[ x]\]\s*/, '');
          return (checked ? '[x] ' : '[ ] ') + body;
        }
        return line;
      });
      return { ...f, checklist: next.join('\n') };
    });
  };

  const getProgress = (checklist: string) => {
    const lines = (checklist || '').split('\n').filter(l => l.startsWith('['));
    const done = lines.filter(l => l.startsWith('[x]')).length;
    return lines.length ? { done, total: lines.length, pct: Math.round((done / lines.length) * 100) } : { done: 0, total: 0, pct: 0 };
  };

  const stats = useMemo(() => ({
    planned: serverStats.planned,
    in_progress: serverStats.in_progress,
    staging: serverStats.staging,
    released: serverStats.released,
    cancelled: serverStats.cancelled,
  }), [serverStats]);

  const releaseTypeOptions = useMemo(
    () => TYPE_OPTIONS.map((o) => ({ value: o, label: o.replace(/_/g, ' ') })),
    [],
  );
  const releaseStatusFormOptions = useMemo(
    () => STATUS_FLOW.map((o) => ({ value: o, label: o.replace(/_/g, ' ') })),
    [],
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
          <div className="mt-1">
            <SearchableSelect options={releaseTypeOptions} value={form.type} onValueChange={(v) => setForm((f: any) => ({ ...f, type: v }))} searchPlaceholder="Search type…" />
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <div className="mt-1">
            <SearchableSelect options={releaseStatusFormOptions} value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))} searchPlaceholder="Search status…" />
          </div>
        </div>
        <DateField
          className="mt-1"
          label="Target Date"
          value={toHtmlDateInputValue(form.target_date)}
          onChange={(v) => setForm((f: any) => ({ ...f, target_date: v }))}
          helperText="Optional release target day."
        />

        <SearchableProductMultiSelect
          label="Products Included"
          products={products}
          value={form.products_included || ''}
          onChange={(csv) => setForm((f: any) => ({ ...f, products_included: csv }))}
          helpText="Search and select one or more products included in this release."
        />
      </div>

      {/* Checklist */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Label className="mb-0">Release Checklist</Label>
            {getProgress(form.checklist).total > 0 && (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAllChecklistChecked(true)}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAllChecklistChecked(false)}
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground font-semibold shrink-0">
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
            onClick={() => {
              const next = statusF === status ? '' : status;
              setPage(1);
              setStatusF(next);
            }}
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
            Releases ({totalCount.toLocaleString()})
          </h3>
          <div className="flex gap-2 flex-wrap items-center">
            <ListPageSearchInput value={search} onChange={setSearch} className="w-40 sm:w-48" />
            {statusF && (
              <Button variant="ghost" size="sm" onClick={() => { setPage(1); setStatusF(''); }}>Clear filter</Button>
            )}
            {can('release') && (
              <Button onClick={() => setForm({ ...blank })}>+ New Release</Button>
            )}
          </div>
        </div>

        {loading ? <TableSkeleton /> :
          items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <PackageCheck className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="font-medium">No releases found</p>
              <p className="text-xs mt-1">Create a release to track deployment bundles</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(r => {
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
                        {can('release') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setForm({ ...r, target_date: toHtmlDateInputValue(r.target_date) })}
                          >
                            Edit
                          </Button>
                        )}
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
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm">
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
