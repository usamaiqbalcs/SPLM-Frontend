import { useEffect, useState } from 'react';
import { listDeploymentsPage, createDeployment, updateDeploymentStatus, listProductsForDropdown } from '@/lib/api';
import { ListPageSearchInput, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { fmtDateTime, ENV_CONFIG } from '@/lib/splm-utils';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { PromptDialog } from '@/components/ui/prompt-dialog';
import { toast } from 'sonner';

function Pipeline({ status }: { status: string }) {
  const steps = [
    { k: 'pending', l: 'Queued', i: '📋' },
    { k: 'building', l: 'Build', i: '🔨' },
    { k: 'testing', l: 'Test', i: '🧪' },
    { k: 'deploying', l: 'Deploy', i: '⬆️' },
    { k: 'success', l: 'Live', i: '✅' },
  ];
  const order: Record<string, number> = { pending: 0, building: 1, testing: 2, deploying: 3, success: 4, failed: 2, rolled_back: 0 };
  const cur = order[status] ?? 0;

  return (
    <div className="flex min-w-0 items-start gap-0 overflow-x-auto py-3 scrollbar-thin">
      {steps.map((s, i) => {
        const done = (status === 'success' && i <= 4) || i < cur;
        const active = i === cur && status !== 'success' && status !== 'failed';
        return (
          <div key={s.k} className="flex flex-col items-center flex-1 relative">
            {i < steps.length - 1 && <div className={cn('absolute top-5 right-0 w-1/2 h-0.5', done ? 'bg-success' : 'bg-border')} />}
            {i > 0 && <div className={cn('absolute top-5 left-0 w-1/2 h-0.5', done || active ? (i <= cur ? 'bg-success' : 'bg-border') : 'bg-border')} />}
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-base font-bold z-10 border-[3px]',
              done ? 'bg-success border-success text-card' : active ? 'bg-primary border-primary text-card' : 'bg-muted border-border text-muted-foreground'
            )}>
              {done ? '✓' : active ? <span className="animate-spin-slow">⚙</span> : s.i}
            </div>
            <div className={cn('text-[10px] mt-1 font-medium', done ? 'text-success' : active ? 'text-primary' : 'text-muted-foreground')}>{s.l}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function DeploymentsPanel() {
  const { can, user } = useAuth();
  const [deploys, setDeploys] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [envF, setEnvF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [failTarget, setFailTarget] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const debouncedSearch = useListPageSearchDebounce(search);

  const load = () => {
    setLoading(true);
    Promise.all([
      listDeploymentsPage({
        page,
        pageSize,
        environment: envF || undefined,
        status: statusF || undefined,
        search: debouncedSearch || undefined,
      }),
      listProductsForDropdown(),
    ])
      .then(([res, p]) => {
        setDeploys(res.items);
        setProducts(p);
        setTotalPages(Math.max(1, res.total_pages));
        setTotalCount(res.total_count);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, envF, statusF]);
  useEffect(() => {
    load();
  }, [page, envF, statusF, debouncedSearch]);

  const pname = (id: string) => products.find(p => p.id === id)?.name || id?.slice(0, 8);
  const blank = { product_id: '', version: '', environment: 'development', deploy_type: 'full', branch: '', commit_sha: '', rollback_version: '' };

  const nextStatus: Record<string, string> = { pending: 'building', building: 'testing', testing: 'deploying', deploying: 'success' };

  const doCreate = async () => {
    if (!form.product_id || !form.version) return toast.error('Product and version are required');
    setSaving(true);
    try { await createDeployment({ ...form, deployed_by: user?.id, status: 'pending' }); toast.success('Deployment queued'); load(); setForm(null); }
    catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const doAdvance = async (id: string, current: string) => {
    const next = nextStatus[current];
    if (!next) return;
    try { await updateDeploymentStatus(id, next); toast.success(`Stage advanced to ${next}`); load(); } catch (e: any) { toast.error(e.message); }
  };

  const doFail = async (reason: string) => {
    if (!failTarget) return;
    try { await updateDeploymentStatus(failTarget, 'failed', reason); toast.error('Deployment marked as failed'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setFailTarget(null); }
  };

  if (form) return (
    <div className="bg-card rounded-lg border p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-primary">🚀 New Deployment</h3>
        <Button variant="outline" onClick={() => setForm(null)}>← Back</Button>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {Object.entries(ENV_CONFIG).map(([key, ec]) => (
          <div key={key} onClick={() => setForm((f: any) => ({ ...f, environment: key }))}
            className={cn('rounded-lg p-4 cursor-pointer transition-all border-2',
              form.environment === key ? 'border-primary bg-secondary' : 'border-border hover:border-primary/30')}>
            <div className="text-2xl">{ec.icon}</div>
            <div className="font-bold text-primary mt-1">{ec.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{ec.description}</div>
          </div>
        ))}
      </div>
      {form.environment === 'production' && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 text-sm text-destructive font-semibold">⚠ Production deployment — proceed with caution</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div><Label>Product *</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.product_id || ''} onChange={e => setForm((f: any) => ({ ...f, product_id: e.target.value }))}><option value="">Select…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><Label>Version *</Label><Input className="font-mono" value={form.version || ''} onChange={e => setForm((f: any) => ({ ...f, version: e.target.value }))} placeholder="2.1.0" /></div>
        <div><Label>Deploy Type</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.deploy_type} onChange={e => setForm((f: any) => ({ ...f, deploy_type: e.target.value }))}>{['full', 'hotfix', 'rollback', 'config_only', 'migration_only'].map(o => <option key={o}>{o}</option>)}</select></div>
        <div><Label>Branch</Label><Input className="font-mono" value={form.branch || ''} onChange={e => setForm((f: any) => ({ ...f, branch: e.target.value }))} placeholder="release/2.1.0" /></div>
        <div><Label>Commit SHA</Label><Input className="font-mono" value={form.commit_sha || ''} onChange={e => setForm((f: any) => ({ ...f, commit_sha: e.target.value }))} /></div>
        <div><Label>Rollback Version</Label><Input className="font-mono" value={form.rollback_version || ''} onChange={e => setForm((f: any) => ({ ...f, rollback_version: e.target.value }))} placeholder="Previous version" /></div>
      </div>
      <Button onClick={doCreate} disabled={saving} className={form.environment === 'production' ? 'bg-destructive hover:bg-destructive/90' : ''}>
        {saving ? 'Queueing…' : `🚀 Queue ${form.environment === 'production' ? 'PRODUCTION ' : ''}Deployment`}
      </Button>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PromptDialog
        open={!!failTarget}
        onOpenChange={(o) => !o && setFailTarget(null)}
        title="Mark Deployment Failed"
        description="Please provide a reason for the failure."
        placeholder="e.g., Build timeout, test failures, config error..."
        confirmLabel="Mark Failed"
        onConfirm={doFail}
      />
      <div className="bg-card rounded-lg border p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-primary">
            🚀 Deployments ({totalCount.toLocaleString()})
          </h3>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <ListPageSearchInput value={search} onChange={setSearch} className="w-full min-w-0 sm:w-44" />
            <select className="w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm sm:w-auto" value={envF} onChange={e => { setPage(1); setEnvF(e.target.value); }}><option value="">All Environments</option>{['development', 'staging', 'production'].map(o => <option key={o}>{o}</option>)}</select>
            <select className="w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm sm:w-auto" value={statusF} onChange={e => { setPage(1); setStatusF(e.target.value); }}><option value="">All Statuses</option>{['pending', 'building', 'testing', 'deploying', 'success', 'failed', 'rolled_back'].map(o => <option key={o}>{o}</option>)}</select>
            {can('deploy') && <Button className="w-full shrink-0 sm:w-auto" onClick={() => setForm({ ...blank })}>+ New Deployment</Button>}
          </div>
        </div>
        {loading ? <TableSkeleton /> :
          deploys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <span className="text-4xl mb-3">🚀</span>
              <p className="font-medium">No deployments</p>
              <p className="text-xs mt-1">Queue a deployment to see the pipeline</p>
            </div>
          ) :
            <div className="space-y-3">
              {deploys.map(d => {
                const ec = ENV_CONFIG[d.environment as keyof typeof ENV_CONFIG];
                return (
                  <div key={d.id} className={cn('border rounded-lg p-4 hover:shadow-sm transition-shadow', d.status === 'failed' ? 'border-destructive/30 bg-destructive/5' : d.status === 'success' && d.environment === 'production' ? 'border-success/30' : '')}>
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <div className="flex gap-2 items-center flex-wrap">
                          <span className="font-bold text-sm">{pname(d.product_id)}</span>
                          <code className="bg-muted px-2 py-0.5 rounded text-xs font-semibold">v{d.version}</code>
                          <span className="bg-secondary text-primary px-2 py-0.5 rounded-full text-[11px] font-semibold">{ec?.icon} {ec?.label}</span>
                          <StatusBadge status={d.status || 'pending'} />
                          {d.deploy_type && d.deploy_type !== 'full' && <StatusBadge status={d.deploy_type} />}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {d.branch && <><code>🌿 {d.branch}</code> </>}
                          {d.commit_sha && <code className="bg-muted px-1 rounded">{d.commit_sha.slice(0, 8)}</code>}
                          <span className="ml-2">{fmtDateTime(d.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {nextStatus[d.status] && can('deploy') && (
                          <Button size="sm" onClick={() => doAdvance(d.id, d.status)}>
                            → {nextStatus[d.status] === 'success' ? '✓ Mark Success' : `Mark ${nextStatus[d.status]}`}
                          </Button>
                        )}
                        {d.status !== 'success' && d.status !== 'failed' && d.status !== 'rolled_back' && can('deploy') && (
                          <Button size="sm" variant="destructive" onClick={() => setFailTarget(d.id)}>✕ Fail</Button>
                        )}
                      </div>
                    </div>
                    <Pipeline status={d.status || 'pending'} />
                    {d.fail_reason && <div className="bg-destructive/10 rounded-md px-3 py-2 text-xs text-destructive mt-1">⚠ {d.fail_reason}</div>}
                  </div>
                );
              })}
            </div>
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
