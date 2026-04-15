import { useEffect, useMemo, useState } from 'react';
import { listVersions, getVersion, saveVersion, listProductsForDropdown } from '@/lib/api';
import { ListPageSearchInput, rowMatchesListSearch, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { fmtDate, semverBump, toHtmlDateInputValue } from '@/lib/splm-utils';
import { DateField } from '@/components/ui/date-field';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { toast } from 'sonner';
import { SearchableSelect, optionsFromStrings } from '@/components/forms/SearchableSelect';

const VERSION_TYPES = ['major', 'minor', 'patch', 'hotfix'] as const;
const VERSION_STATUSES = ['planned', 'in_development', 'testing', 'staging', 'released'] as const;

/** Normalize API row (snake_case) for the edit form; list rows were missing fields before Dapper aliases. */
function mapVersionToForm(row: Record<string, unknown>) {
  return {
    ...row,
    version_type: (row.version_type as string) || 'minor',
    status: (row.status as string) || 'planned',
    planned_date: toHtmlDateInputValue(row.planned_date as string | null),
    tasks_included: row.tasks_included != null ? String(row.tasks_included) : '',
  };
}

export default function VersionControlPanel() {
  const { can } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [selProd, setSelProd] = useState('');
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [verSearch, setVerSearch] = useState('');
  const debouncedVerSearch = useListPageSearchDebounce(verSearch);

  useEffect(() => {
    listProductsForDropdown().then(setProducts);
  }, []);
  useEffect(() => {
    if (!selProd) return;
    setLoading(true);
    listVersions(selProd).then(setVersions).finally(() => setLoading(false));
  }, [selProd]);

  const filteredVersions = useMemo(() => {
    const q = debouncedVerSearch;
    if (!q) return versions;
    return versions.filter((v: any) =>
      rowMatchesListSearch(q, [v.version, v.title, v.git_branch, v.git_commit, v.status, v.version_type, v.release_notes]),
    );
  }, [versions, debouncedVerSearch]);

  const versionTypeOptions = useMemo(() => optionsFromStrings([...VERSION_TYPES]), []);
  const versionStatusFormOptions = useMemo(() => optionsFromStrings([...VERSION_STATUSES]), []);
  const productPickerOptions = useMemo(
    () => [{ value: '', label: 'Select product…' }, ...products.map((p: any) => ({ value: p.id, label: p.name }))],
    [products],
  );

  const curVer = versions.find(v => v.is_current) || versions[0];
  const blank = (type = 'minor') => ({
    product_id: selProd, version: curVer ? semverBump(curVer.version, type) : '1.0.0',
    version_type: type, status: 'planned', title: '', release_notes: '', changelog: '',
    breaking_changes: '', git_branch: '', git_commit: '', planned_date: '', tasks_included: ''
  });

  const doSave = async () => {
    if (!form.version || !form.title) return toast.error('Version and title are required');
    setSaving(true);
    try { await saveVersion(form); toast.success(form.id ? 'Version updated' : 'Version created'); listVersions(selProd).then(setVersions); setForm(null); }
    catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const typeColor: Record<string, string> = { major: 'bg-destructive', minor: 'bg-primary', patch: 'bg-success', hotfix: 'bg-warning' };

  if (form) return (
    <div className="bg-card rounded-lg border p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-primary">{form.id ? 'Edit Version' : 'New Version'}</h3>
        <Button variant="outline" onClick={() => setForm(null)}>← Back</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div><Label>Version *</Label><Input className="font-mono" value={form.version || ''} onChange={e => setForm((f: any) => ({ ...f, version: e.target.value }))} /></div>
        <div><Label>Title *</Label><Input value={form.title || ''} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Azure AD SSO Integration" /></div>
        <div><Label>Version Type</Label><div className="mt-1"><SearchableSelect options={versionTypeOptions} value={form.version_type || 'minor'} onValueChange={(v) => setForm((f: any) => ({ ...f, version_type: v }))} searchPlaceholder="Search type…" /></div></div>
        <div><Label>Status</Label><div className="mt-1"><SearchableSelect options={versionStatusFormOptions} value={form.status || 'planned'} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))} searchPlaceholder="Search status…" /></div></div>
        <div><Label>Git Branch</Label><Input className="font-mono" value={form.git_branch || ''} onChange={e => setForm((f: any) => ({ ...f, git_branch: e.target.value }))} placeholder="release/2.1.0" /></div>
        <div><Label>Git Commit</Label><Input className="font-mono" value={form.git_commit || ''} onChange={e => setForm((f: any) => ({ ...f, git_commit: e.target.value }))} placeholder="abc1234" /></div>
        <DateField
          label="Planned Date"
          value={toHtmlDateInputValue(form.planned_date)}
          onChange={(v) => setForm((f: any) => ({ ...f, planned_date: v }))}
          helperText="Optional planned release day."
        />
        <div><Label>Tasks Included</Label><Input value={form.tasks_included || ''} onChange={e => setForm((f: any) => ({ ...f, tasks_included: e.target.value }))} placeholder="Comma-separated task IDs" /></div>
        <div className="md:col-span-2"><Label>Release Notes</Label><textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] bg-background" value={form.release_notes || ''} onChange={e => setForm((f: any) => ({ ...f, release_notes: e.target.value }))} /></div>
        <div className="md:col-span-2"><Label>Changelog</Label><textarea className="w-full border rounded-md px-3 py-2 text-sm font-mono min-h-[100px] bg-background" value={form.changelog || ''} onChange={e => setForm((f: any) => ({ ...f, changelog: e.target.value }))} placeholder="[feat] Add MFA\n[fix] Fix rounding\n[break] Remove v1 API" /></div>
        <div className="md:col-span-2"><Label>Breaking Changes</Label><textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[60px] bg-background" value={form.breaking_changes || ''} onChange={e => setForm((f: any) => ({ ...f, breaking_changes: e.target.value }))} /></div>
      </div>
      <div className="flex gap-2"><Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
    </div>
  );

  if (detail) return (
    <div className="bg-card rounded-lg border p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3"><code className="text-2xl font-extrabold text-primary">v{detail.version}</code><span className="text-foreground">{detail.title}</span></div>
        <Button variant="outline" onClick={() => setDetail(null)}>← Back</Button>
      </div>
      <div className="flex gap-2 mb-4"><StatusBadge status={detail.version_type} /><StatusBadge status={detail.status} />{detail.is_current && <span className="bg-success/10 text-success px-2 py-0.5 rounded-full text-[10px] font-bold">CURRENT</span>}</div>
      {detail.release_notes && <div className="mb-4"><h4 className="font-bold text-primary mb-1">Release Notes</h4><p className="text-sm leading-relaxed">{detail.release_notes}</p></div>}
      {detail.changelog && (
        <div className="mb-4">
          <h4 className="font-bold text-primary mb-2">Changelog</h4>
          {detail.changelog.split('\n').filter(Boolean).map((line: string, i: number) => {
            const type = line.match(/^\[(feat|fix|perf|sec|break)\]/)?.[1];
            return (
              <div key={i} className="flex gap-2 items-start py-1 border-b border-muted last:border-0">
                {type && <StatusBadge status={type === 'feat' ? 'minor' : type === 'fix' ? 'patch' : type === 'break' ? 'major' : type === 'sec' ? 'hotfix' : 'building'} />}
                <span className="text-sm">{line.replace(/^\[.*?\]\s*/, '')}</span>
              </div>
            );
          })}
        </div>
      )}
      {detail.breaking_changes && <div className="bg-destructive/10 rounded-lg p-3"><h4 className="font-bold text-destructive mb-1">⚠ Breaking Changes</h4><p className="text-sm">{detail.breaking_changes}</p></div>}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-lg border p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-primary">🏷️ Version Control</h3>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="w-52 min-w-[10rem]">
              <SearchableSelect
                size="sm"
                options={productPickerOptions}
                value={selProd}
                onValueChange={(v) => { setVerSearch(''); setSelProd(v); }}
                placeholder="Select product…"
                searchPlaceholder="Search products…"
                contentWidth="wide"
              />
            </div>
            {selProd && (
              <ListPageSearchInput value={verSearch} onChange={setVerSearch} className="w-36 sm:w-44" aria-label="Search versions" />
            )}
            {selProd && can('edit') && ['patch', 'minor', 'major', 'hotfix'].map(t => (
              <Button key={t} size="sm" variant="outline" onClick={() => setForm(blank(t))}>+ {t}</Button>
            ))}
          </div>
        </div>
        {!selProd && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-4xl mb-3">🏷️</span>
            <p className="font-medium">Select a product</p>
            <p className="text-xs mt-1">Choose a product to view its version history</p>
          </div>
        )}
        {selProd && loading && <TableSkeleton />}
        {selProd && !loading && versions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-4xl mb-3">📝</span>
            <p className="font-medium">No versions yet</p>
            <p className="text-xs mt-1">Create the first version for this product</p>
          </div>
        )}
        {selProd && !loading && versions.length > 0 && filteredVersions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
            No versions match your search
          </div>
        )}
        {filteredVersions.length > 0 && (
          <div className="relative pl-6">
            <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-border" />
            {filteredVersions.map(v => (
              <div key={v.id} className="relative mb-4 pl-4">
                <div className={cn('absolute -left-4 top-2 w-3 h-3 rounded-full border-2 border-card', typeColor[v.version_type] || 'bg-primary')} />
                <div className={cn('rounded-lg p-4 border hover:shadow-sm transition-shadow', v.is_current ? 'bg-primary/5 border-primary/30' : 'bg-muted/30')}>
                  <div className="flex justify-between items-start flex-wrap gap-2 mb-1">
                    <div className="flex gap-2 items-center flex-wrap">
                      <code className="text-lg font-extrabold text-primary">v{v.version}</code>
                      <span className="text-sm">{v.title}</span>
                      {v.is_current && <span className="bg-success/10 text-success px-2 py-0.5 rounded-full text-[10px] font-bold">CURRENT</span>}
                      <StatusBadge status={v.version_type || 'minor'} />
                      <StatusBadge status={v.status || 'planned'} />
                    </div>
                    <div className="flex gap-1 items-center">
                      <span className="text-xs text-muted-foreground">{fmtDate(v.released_at || v.planned_date)}</span>
                      <Button size="sm" variant="outline" onClick={() => setDetail(v)}>View</Button>
                      {can('edit') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={loadingEditId === v.id}
                          onClick={async () => {
                            setLoadingEditId(v.id);
                            try {
                              const full = await getVersion(v.id);
                              setForm(mapVersionToForm(full as Record<string, unknown>));
                            } catch (e: unknown) {
                              const msg = e instanceof Error ? e.message : 'Failed to load version';
                              toast.error(msg);
                              setForm(mapVersionToForm(v as Record<string, unknown>));
                            } finally {
                              setLoadingEditId(null);
                            }
                          }}
                        >
                          {loadingEditId === v.id ? '…' : 'Edit'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {v.release_notes && <p className="text-xs text-muted-foreground line-clamp-2">{v.release_notes}</p>}
                  {v.git_branch && <div className="mt-1 text-[11px] text-muted-foreground">🌿 <code>{v.git_branch}</code>{v.git_commit && <code className="bg-muted px-1.5 rounded ml-1">{v.git_commit.slice(0, 8)}</code>}</div>}
                  {v.breaking_changes && <div className="mt-1.5 bg-destructive/10 rounded px-2 py-0.5 text-[11px] text-destructive font-semibold inline-block">⚠ Breaking changes</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
