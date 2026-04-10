import { useEffect, useMemo, useState } from 'react';
import {
  listEnvironments,
  saveEnvironment,
  deleteEnvironment,
  listProducts,
  getEnvironment,
  normalizeEnvironmentForForm,
  normalizeGuidString,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ENV_CONFIG } from '@/lib/splm-utils';
import { cn } from '@/lib/utils';
import { GridCardSkeleton } from '@/components/ui/loading-skeleton';
import { toast } from 'sonner';

const STANDARD_ENV_KEYS = ['development', 'staging', 'production'] as const;

const DEPLOY_METHOD_OPTIONS = [
  'manual',
  'ssh',
  'github_actions',
  'docker',
  'aws_codedeploy',
  'ftp',
  'ci_cd',
  'kubernetes',
  'terraform',
] as const;

function deploySelectOptions(current: string | undefined): string[] {
  const c = (current || 'manual').trim();
  if (!c) return [...DEPLOY_METHOD_OPTIONS];
  if ((DEPLOY_METHOD_OPTIONS as readonly string[]).includes(c)) return [...DEPLOY_METHOD_OPTIONS];
  return [c, ...DEPLOY_METHOD_OPTIONS];
}

function blankForm() {
  return {
    product_id: '',
    product_name: '',
    environment: 'development' as string,
    custom_environment: '',
    server_host: '',
    server_url: '',
    deploy_method: 'manual',
    git_repo: '',
    git_branch: 'main',
    deploy_path: '/var/www/html',
    health_check_url: '',
    env_vars_encrypted: '',
    notes: '',
  };
}

export default function EnvironmentsPanel() {
  const { can } = useAuth();
  const [envs, setEnvs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([listEnvironments(), listProducts()])
      .then(([e, p]) => {
        setEnvs(e);
        setProducts(p);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const productOptions = useMemo(
    () =>
      products
        .map((p: any) => ({
          id: normalizeGuidString(String(p.id ?? p.Id ?? '').trim()),
          name: String(p.name ?? p.Name ?? 'Product').trim() || 'Product',
        }))
        .filter(p => p.id.length > 0),
    [products],
  );

  const selectedProductId = form
    ? normalizeGuidString(String(form.product_id ?? '').trim())
    : '';
  const productMissingFromCatalog =
    !!form?.id &&
    !!selectedProductId &&
    !productOptions.some(p => p.id === selectedProductId);

  const pname = (id: string) =>
    productOptions.find(p => p.id === normalizeGuidString(String(id).trim()))?.name ?? 'Unknown';

  const takenForProduct = useMemo(() => {
    if (!form?.product_id) return new Set<string>();
    const pid = normalizeGuidString(String(form.product_id).trim());
    return new Set(
      envs
        .filter(
          e =>
            normalizeGuidString(String(e.product_id ?? (e as any).productId ?? '').trim()) === pid,
        )
        .map(e => String(e.environment).toLowerCase()),
    );
  }, [envs, form?.product_id]);

  const doSave = async () => {
    if (!form.product_id || !form.environment) {
      toast.error('Product and environment are required');
      return;
    }

    let envNameForCreate = '';
    if (!form.id) {
      envNameForCreate =
        form.environment === '__custom'
          ? String(form.custom_environment || '').trim()
          : String(form.environment).trim();
      if (form.environment === '__custom' && !envNameForCreate) {
        toast.error('Enter a custom environment name.');
        return;
      }
      if (envNameForCreate.length > 50) {
        toast.error('Environment name cannot exceed 50 characters.');
        return;
      }
      const pid = normalizeGuidString(String(form.product_id).trim());
      const dup = envs.some(
        e =>
          normalizeGuidString(String(e.product_id ?? (e as any).productId ?? '').trim()) === pid &&
          String(e.environment).toLowerCase() === envNameForCreate.toLowerCase(),
      );
      if (dup) {
        toast.error(
          'That environment already exists for this product. Edit the card in the list, or delete it first.',
        );
        return;
      }
    }

    setSaving(true);
    try {
      const payload = form.id ? form : { ...form, environment: envNameForCreate };
      await saveEnvironment(payload);
      toast.success(form.id ? 'Environment updated' : 'Environment created');
      load();
      setForm(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (row: any) => {
    const id = row.id ?? row.Id;
    if (!id) return;
    setEditLoadingId(String(id));
    // Populate from list immediately so fields are never blank while fetching.
    setForm(normalizeEnvironmentForForm(row));
    try {
      const f = await getEnvironment(String(id), row);
      setForm(f);
    } catch (e: any) {
      toast.error(
        e.message ||
          'Could not refresh from server. You can still edit using the values shown (from the list).',
      );
    } finally {
      setEditLoadingId(null);
    }
  };

  const doDelete = async (row: any) => {
    const id = row.id ?? row.Id;
    if (!id) return;
    const label = ENV_CONFIG[row.environment as keyof typeof ENV_CONFIG]?.label ?? row.environment;
    if (
      !window.confirm(
        `Remove "${label}" for ${pname(row.product_id)}? You can add it again later from Configure Environment.`,
      )
    )
      return;
    setDeletingId(String(id));
    try {
      await deleteEnvironment(String(id));
      toast.success('Environment removed');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (form)
    return (
      <div
        key={form.id ? `env-edit-${form.id}` : 'env-new'}
        className="bg-card rounded-lg border p-6 animate-fade-in"
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-primary">{form.id ? 'Edit Environment' : 'Configure Environment'}</h3>
          <Button variant="outline" onClick={() => setForm(null)}>
            ← Back
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label>Product *</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-60"
              value={selectedProductId}
              disabled={!!form.id}
              onChange={e => {
                const pid = normalizeGuidString(e.target.value);
                setForm((f: any) => {
                  if (f.id) return { ...f, product_id: pid };
                  const taken = new Set(
                    envs
                      .filter(
                        x =>
                          normalizeGuidString(
                            String(x.product_id ?? (x as any).productId ?? '').trim(),
                          ) === pid,
                      )
                      .map(x => String(x.environment).toLowerCase()),
                  );
                  let nextEnv = f.environment;
                  if (nextEnv !== '__custom' && taken.has(String(nextEnv).toLowerCase()))
                    nextEnv = STANDARD_ENV_KEYS.find(k => !taken.has(k)) ?? '__custom';
                  return { ...f, product_id: pid, environment: nextEnv };
                });
              }}
            >
              <option value="">Select…</option>
              {productMissingFromCatalog && (
                <option value={selectedProductId}>
                  {String(form.product_name || '').trim()
                    ? `${form.product_name} (from record)`
                    : `Linked product ${selectedProductId.slice(0, 8)}…`}
                </option>
              )}
              {productOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {form.id && (
              <p className="text-xs text-muted-foreground mt-1">Product cannot be changed. Delete and recreate to move.</p>
            )}
            {form.id && productMissingFromCatalog && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                This environment’s product is not in the current product list (wrong tenant, deleted product, or stale
                cache). Refresh the page or restore the product so the dropdown can resolve the name.
              </p>
            )}
          </div>
          <div>
            <Label>Environment *</Label>
            {form.id ? (
              <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">
                <span className="font-medium">
                  {ENV_CONFIG[String(form.environment).toLowerCase() as keyof typeof ENV_CONFIG]?.label ??
                    form.environment}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Environment slot is fixed. Delete this entry if you need a different name.
                </p>
              </div>
            ) : (
              <>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.environment}
                  onChange={e =>
                    setForm((f: any) => ({
                      ...f,
                      environment: e.target.value,
                      ...(e.target.value !== '__custom' ? { custom_environment: '' } : {}),
                    }))
                  }
                >
                  {STANDARD_ENV_KEYS.map(k => (
                    <option key={k} value={k} disabled={takenForProduct.has(k)}>
                      {ENV_CONFIG[k].label}
                      {takenForProduct.has(k) ? ' (already configured)' : ''}
                    </option>
                  ))}
                  <option value="__custom">Other name…</option>
                </select>
                {form.environment === '__custom' && (
                  <Input
                    className="mt-2 font-mono"
                    maxLength={50}
                    placeholder="e.g. qa, preprod"
                    value={form.custom_environment || ''}
                    onChange={e => setForm((f: any) => ({ ...f, custom_environment: e.target.value }))}
                  />
                )}
                {!form.product_id && (
                  <p className="text-xs text-muted-foreground mt-1">Select a product to see which slots are free.</p>
                )}
              </>
            )}
          </div>
          <div>
            <Label>Server Host *</Label>
            <Input
              className="font-mono"
              value={form.server_host || ''}
              onChange={e => setForm((f: any) => ({ ...f, server_host: e.target.value }))}
              placeholder="ec2-xx.compute.amazonaws.com"
            />
            {!form.id && <p className="text-xs text-muted-foreground mt-1">Required for new environments.</p>}
          </div>
          <div>
            <Label>Application URL</Label>
            <Input
              className="font-mono"
              value={form.server_url || ''}
              onChange={e => setForm((f: any) => ({ ...f, server_url: e.target.value }))}
              placeholder="https://app.zenatech.com"
            />
          </div>
          <div>
            <Label>Deploy Method</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={form.deploy_method ?? 'manual'}
              onChange={e => setForm((f: any) => ({ ...f, deploy_method: e.target.value }))}
            >
              {deploySelectOptions(form.deploy_method).map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Deploy Path</Label>
            <Input
              className="font-mono"
              value={form.deploy_path || ''}
              onChange={e => setForm((f: any) => ({ ...f, deploy_path: e.target.value }))}
            />
          </div>
          <div>
            <Label>Git Repository</Label>
            <Input
              className="font-mono"
              value={form.git_repo || ''}
              onChange={e => setForm((f: any) => ({ ...f, git_repo: e.target.value }))}
              placeholder="git@github.com:zenatech/app.git"
            />
          </div>
          <div>
            <Label>Default Branch</Label>
            <Input
              className="font-mono"
              value={form.git_branch || 'main'}
              onChange={e => setForm((f: any) => ({ ...f, git_branch: e.target.value }))}
            />
          </div>
          <div>
            <Label>Health Check URL</Label>
            <Input
              className="font-mono"
              value={form.health_check_url || ''}
              onChange={e => setForm((f: any) => ({ ...f, health_check_url: e.target.value }))}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] bg-background"
              value={form.notes || ''}
              onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Environment Variables (KEY=VALUE, one per line)</Label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm font-mono min-h-[100px] bg-background"
              value={form.env_vars_encrypted || ''}
              onChange={e => setForm((f: any) => ({ ...f, env_vars_encrypted: e.target.value }))}
              placeholder={'ZT_DB_HOST=rds.amazonaws.com\nAPP_ENV=production'}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={doSave} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save'}
          </Button>
          <Button variant="outline" onClick={() => setForm(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );

  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-lg border p-5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-primary">🌐 Environment Registry ({envs.length})</h3>
          {can('config') && (
            <Button onClick={() => setForm({ ...blankForm() })}>+ Configure Environment</Button>
          )}
        </div>
        {loading ? (
          <GridCardSkeleton count={3} />
        ) : envs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-4xl mb-3">🌐</span>
            <p className="font-medium">No environments configured</p>
            <p className="text-xs mt-1">Set up dev, staging, and production environments</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {envs.map(e => {
              const ec = ENV_CONFIG[e.environment as keyof typeof ENV_CONFIG];
              return (
                <div
                  key={e.id}
                  className={cn(
                    'rounded-lg p-4 border-2 hover:shadow-sm transition-shadow',
                    e.environment === 'production'
                      ? 'border-success/50 bg-success/5'
                      : e.environment === 'staging'
                        ? 'border-purple/50 bg-purple/5'
                        : 'border-primary/30 bg-primary/5',
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-2xl">{ec?.icon ?? '🌐'}</div>
                      <div className="font-bold text-primary text-sm mt-1">{ec?.label ?? e.environment}</div>
                      <div className="text-xs text-muted-foreground">{pname(e.product_id)}</div>
                    </div>
                    {can('config') && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={String(editLoadingId) === String(e.id)}
                          onClick={() => openEdit(e)}
                        >
                          {String(editLoadingId) === String(e.id) ? '…' : 'Edit'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={String(deletingId) === String(e.id)}
                          onClick={() => doDelete(e)}
                        >
                          {String(deletingId) === String(e.id) ? '…' : 'Delete'}
                        </Button>
                      </div>
                    )}
                  </div>
                  {[
                    { l: 'Host', v: e.server_host },
                    { l: 'URL', v: e.server_url },
                    { l: 'Method', v: e.deploy_method },
                    { l: 'Branch', v: e.git_branch },
                    { l: 'Path', v: e.deploy_path },
                  ]
                    .filter(r => r.v)
                    .map((r, i) => (
                      <div key={i} className="flex gap-2 mb-0.5">
                        <span className="text-[11px] text-muted-foreground font-semibold w-12 shrink-0">{r.l}</span>
                        <span className="text-[11px] font-mono text-foreground break-all">{r.v}</span>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
