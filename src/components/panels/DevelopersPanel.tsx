import { useEffect, useState, useMemo } from 'react';
import { listDevelopersPage, saveDeveloper, deleteDeveloper } from '@/lib/api';
import { ListPageSearchInput, ListPaginationBar, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { GridCardSkeleton } from '@/components/ui/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { SearchableSelect, optionsFromStrings } from '@/components/forms/SearchableSelect';

const DEV_ROLES = ['developer', 'senior_developer', 'team_lead', 'manager', 'admin'] as const;
const OFFICES = ['Toronto', 'Chicago', 'Vancouver', 'Seoul', 'Tokyo', 'Dubai', 'Remote'] as const;

export default function DevelopersPanel() {
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string }>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const debouncedSearch = useListPageSearchDebounce(search);

  const load = () => {
    setLoading(true);
    listDevelopersPage({
      page,
      pageSize,
      sortBy: 'name',
      sortDir: 'asc',
      search: debouncedSearch || undefined,
    })
      .then((r: Record<string, unknown> & { items?: unknown[] }) => {
        const list = (r.items ?? (r as { Items?: unknown[] }).Items ?? []) as any[];
        const tc = Number(r.total_count ?? (r as { totalCount?: number }).totalCount ?? 0);
        const rawTp = r.total_pages ?? (r as { totalPages?: number }).totalPages;
        const tp =
          typeof rawTp === 'number' && rawTp > 0
            ? rawTp
            : Math.max(1, Math.ceil(tc / pageSize));
        setItems(list);
        setTotalPages(tp);
        setTotalCount(tc);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);
  useEffect(() => {
    load();
  }, [page, debouncedSearch]);

  const blank = { name: '', email: '', role: 'developer', skills: '', office_location: 'Toronto', capacity_hours_week: 40, active: true };

  const emailLooksValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const doSave = async () => {
    const next: { name?: string; email?: string } = {};
    if (!form.name?.trim()) next.name = 'Name is required';
    if (!form.email?.trim()) next.email = 'Email is required';
    else if (!emailLooksValid(form.email)) next.email = 'Enter a valid email address';
    setFormErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveDeveloper(form);
      toast.success(form.id ? 'Developer updated' : 'Developer added');
      load();
      setForm(null);
      setFormErrors({});
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save developer.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try { await deleteDeveloper(deleteId); toast.success('Developer removed'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setDeleteId(null); }
  };

  const devRoleOptions = useMemo(() => optionsFromStrings([...DEV_ROLES]), []);
  const officeOptions = useMemo(() => OFFICES.map((o) => ({ value: o, label: o })), []);
  const activeStatusOptions = useMemo(
    () => [
      { value: '1', label: 'Active' },
      { value: '0', label: 'Inactive' },
    ],
    [],
  );

  if (form) return (
    <div className="bg-card rounded-lg border p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-primary">{form.id ? 'Edit Developer' : 'Add Developer'}</h3>
        <Button variant="outline" onClick={() => setForm(null)}>← Back</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <Label>Name *</Label>
          <Input
            value={form.name || ''}
            onChange={(e) => {
              setFormErrors((p) => ({ ...p, name: undefined }));
              setForm((f: any) => ({ ...f, name: e.target.value }));
            }}
            aria-invalid={!!formErrors.name}
            className={formErrors.name ? 'border-destructive' : undefined}
          />
          {formErrors.name ? <p className="text-xs text-destructive">{formErrors.name}</p> : null}
        </div>
        <div className="space-y-1">
          <Label>Email *</Label>
          <Input
            type="email"
            value={form.email || ''}
            onChange={(e) => {
              setFormErrors((p) => ({ ...p, email: undefined }));
              setForm((f: any) => ({ ...f, email: e.target.value }));
            }}
            aria-invalid={!!formErrors.email}
            className={formErrors.email ? 'border-destructive' : undefined}
          />
          {formErrors.email ? <p className="text-xs text-destructive">{formErrors.email}</p> : null}
        </div>
        <div><Label>Role</Label><div className="mt-1"><SearchableSelect options={devRoleOptions} value={form.role} onValueChange={(v) => setForm((f: any) => ({ ...f, role: v }))} searchPlaceholder="Search role…" /></div></div>
        <div><Label>Office</Label><div className="mt-1"><SearchableSelect options={officeOptions} value={form.office_location} onValueChange={(v) => setForm((f: any) => ({ ...f, office_location: v }))} searchPlaceholder="Search office…" /></div></div>
        <div><Label>Capacity (hrs/wk)</Label><Input type="number" min={1} max={60} value={form.capacity_hours_week || 40} onChange={e => setForm((f: any) => ({ ...f, capacity_hours_week: parseInt(e.target.value) || 40 }))} /></div>
        <div><Label>Status</Label><div className="mt-1"><SearchableSelect options={activeStatusOptions} value={form.active ? '1' : '0'} onValueChange={(v) => setForm((f: any) => ({ ...f, active: v === '1' }))} searchPlaceholder="Search status…" /></div></div>
        <div className="md:col-span-2"><Label>Skills (comma-separated)</Label><Input value={form.skills || ''} onChange={e => setForm((f: any) => ({ ...f, skills: e.target.value }))} placeholder="Python, React, Flask, AWS, ML" /></div>
      </div>
      <div className="flex gap-2"><Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
    </div>
  );

  return (
    <div className="animate-fade-in min-h-0 min-w-0 space-y-0">
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Remove Developer"
        description="This will remove the developer from the roster. Their assigned tasks will not be reassigned."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={doDelete}
      />
      <SplmPageHeader
        title="Team"
        subtitle="Developer roster, capacity, and skills — used for assignments and load visibility."
        actions={can('users') ? <Button onClick={() => setForm({ ...blank })}>+ Add developer</Button> : undefined}
      />

      <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {loading ? (
              <span className="inline-block min-w-[7rem] animate-pulse">…</span>
            ) : totalCount === 0 ? (
              '0 members'
            ) : (
              <>
                Showing {(page - 1) * pageSize + 1}–{(page - 1) * pageSize + items.length} of {totalCount.toLocaleString()}
              </>
            )}
          </span>
          <ListPageSearchInput value={search} onChange={setSearch} className="w-40 sm:w-48" />
        </div>
        {loading ? <GridCardSkeleton count={3} /> :
          items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <span className="text-4xl mb-3">👩‍💻</span>
              <p className="font-medium">No developers</p>
              <p className="text-xs mt-1">Add team members to manage workload</p>
            </div>
          ) :
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(d => {
                const loadPct = (Number(d.current_load_hours) || 0) / (d.capacity_hours_week || 40) * 100;
                const loadColor = loadPct > 85 ? 'bg-destructive' : loadPct > 60 ? 'bg-warning' : 'bg-success';
                return (
                  <div key={d.id} className="bg-muted/30 rounded-lg p-4 border hover:shadow-sm transition-shadow group min-w-0 overflow-hidden">
                    <div className="flex gap-2 items-start justify-between mb-1.5 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold truncate" title={d.name}>{d.name}</div>
                        <div
                          className="text-xs text-muted-foreground truncate"
                          title={d.email}
                        >
                          {d.email}
                        </div>
                      </div>
                      <StatusBadge status={d.role || 'developer'} className="flex-shrink-0 self-start" />
                    </div>
                    <div className="text-xs text-muted-foreground mb-2 break-words">📍 {d.office_location}</div>
                    <div className="flex flex-wrap gap-1 mb-3 min-h-[22px]">
                      {(d.skills || '').split(',').filter(Boolean).slice(0, 5).map((s: string) => (
                        <span key={s} className="bg-secondary text-primary px-2 py-0.5 rounded-full text-[10px] font-semibold">{s.trim()}</span>
                      ))}
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Load</span>
                        <span className={cn('font-bold', loadPct > 85 ? 'text-destructive' : loadPct > 60 ? 'text-warning' : 'text-success')}>
                          {d.current_load_hours || 0}h/{d.capacity_hours_week || 40}h
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', loadColor)} style={{ width: `${Math.min(loadPct, 100)}%` }} />
                      </div>
                    </div>
                    {can('users') && (
                      <div className="flex gap-1 mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setForm({
                              ...d,
                              office_location: d.office_location ?? 'Toronto',
                              capacity_hours_week: d.capacity_hours_week ?? 40,
                              active: d.active ?? true,
                            })}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleteId(d.id)}>Remove</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
        }
        {!loading && totalCount > 0 && (
          <ListPaginationBar
            variant="inset"
            page={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            disabled={loading}
          />
        )}
      </div>
    </div>
  );
}
