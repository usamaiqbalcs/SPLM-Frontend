/**
 * CanaryDeploymentPanel.tsx
 * Feature #8 — Canary Deployment Support
 *
 * Displays deployments with canary stage support.
 * Allows creating canary deployments with rollout_percentage and monitoring window.
 * Supports promoting or rolling back canary deployments.
 */

import { useState, useEffect } from 'react';
import { listDeploymentsPage, createDeployment, listProductsForDropdown } from '@/lib/api';
import { netFetch } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Rocket, AlertTriangle, CheckCircle2, ArrowUpCircle, RotateCcw, Plus, Loader2 } from 'lucide-react';

interface Deployment {
  id: string;
  product_id: string;
  product_name?: string;
  version: string;
  environment: string;
  deploy_type: string;
  status: string;
  branch?: string;
  commit_sha?: string;
  canary_stage?: string;
  rollout_percentage?: number;
  monitoring_window_hrs?: number;
  canary_promoted_at?: string;
  canary_notes?: string;
  created_at: string;
}

const CANARY_STAGE_COLORS: Record<string, string> = {
  none:   'bg-gray-100 text-gray-700',
  canary: 'bg-yellow-100 text-yellow-800',
  full:   'bg-green-100 text-green-800',
};

export default function CanaryDeploymentPanel() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<Deployment | null>(null);
  const [form, setForm] = useState({
    product_id: '',
    version: '',
    environment: 'production',
    branch: 'main',
    commit_sha: '',
    canary_stage: 'canary',
    rollout_percentage: 10,
    monitoring_window_hrs: 24,
    canary_notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [detailDeployment, setDetailDeployment] = useState<Deployment | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [depPage, prods] = await Promise.all([
        listDeploymentsPage({ page: 1, pageSize: 100 }),
        listProductsForDropdown(),
      ]);
      const deps = (depPage.items ?? []) as Deployment[];
      // Show only production/canary deployments
      const filtered = deps.filter(
        d => d.environment === 'production' || d.canary_stage === 'canary',
      );
      setDeployments(filtered);
      setProducts(prods as any[]);
    } catch {
      toast.error('Failed to load deployments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.product_id || !form.version) {
      toast.error('Product and version are required');
      return;
    }
    try {
      setSubmitting(true);
      await createDeployment({
        ...form,
        deploy_type: 'partial',
      });
      toast.success('Canary deployment created');
      setShowCreate(false);
      setForm({ product_id: '', version: '', environment: 'production', branch: 'main', commit_sha: '', canary_stage: 'canary', rollout_percentage: 10, monitoring_window_hrs: 24, canary_notes: '' });
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create deployment');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromote = async (d: Deployment) => {
    try {
      setSubmitting(true);
      await netFetch('PATCH', `/deployments/${d.id}`, {
        canary_stage: 'full',
        rollout_percentage: 100,
        canary_promoted_at: new Date().toISOString(),
      });
      toast.success('Canary promoted to full deployment');
      setPromoteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to promote canary');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRollback = async (d: Deployment) => {
    try {
      await netFetch('PATCH', `/deployments/${d.id}`, {
        status: 'rolled_back',
        canary_stage: 'none',
      });
      toast.success('Canary rolled back');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to roll back');
    }
  };

  const canaryDeployments = deployments.filter(d => d.canary_stage === 'canary');
  const fullDeployments = deployments.filter(d => d.canary_stage !== 'canary');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Canary Deployments</h2>
          <p className="text-sm text-muted-foreground">
            Manage gradual rollout deployments with monitoring windows
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> New Canary Deployment
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          Per AI-SDLC spec: all MINOR and MAJOR version releases require a canary deployment
          to 5–10% of users, monitored for 24 hours before full production rollout.
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading deployments…
        </div>
      ) : (
        <>
          {/* Active Canary Deployments */}
          {canaryDeployments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Active Canary Deployments
              </h3>
              <div className="space-y-3">
                {canaryDeployments.map(d => {
                  const product = products.find(p => p.id === d.product_id);
                  const rollout = d.rollout_percentage ?? 10;
                  const monitorHrs = d.monitoring_window_hrs ?? 24;
                  const createdDiff = Math.round(
                    (Date.now() - new Date(d.created_at).getTime()) / (1000 * 3600),
                  );
                  const monitorComplete = createdDiff >= monitorHrs;

                  return (
                    <Card key={d.id} className="border-yellow-300">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{product?.name ?? d.product_id}</span>
                              <Badge variant="outline" className="text-xs">v{d.version}</Badge>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                🟡 Canary Active
                              </span>
                            </div>
                            {/* Rollout progress */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Rollout: {rollout}% of users</span>
                                <span>Monitoring: {Math.min(createdDiff, monitorHrs)}/{monitorHrs} hrs</span>
                              </div>
                              <Progress value={rollout} className="h-1.5" />
                              <Progress
                                value={Math.min((createdDiff / monitorHrs) * 100, 100)}
                                className="h-1.5"
                              />
                            </div>
                            {d.canary_notes && (
                              <p className="text-xs text-muted-foreground">{d.canary_notes}</p>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setDetailDeployment(d)}>
                              Details
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                              onClick={() => setPromoteTarget(d)}
                              disabled={!monitorComplete}
                              title={!monitorComplete ? `Monitoring window not complete (${monitorHrs}h required)` : 'Promote to full deployment'}
                            >
                              <ArrowUpCircle className="w-3.5 h-3.5" />
                              Promote
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-red-700 border-red-300 hover:bg-red-50"
                              onClick={() => handleRollback(d)}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Rollback
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent full deployments */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Recent Production Deployments
            </h3>
            {fullDeployments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No production deployments yet.</p>
            ) : (
              <div className="space-y-2">
                {fullDeployments.slice(0, 10).map(d => {
                  const product = products.find(p => p.id === d.product_id);
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 p-3 bg-card border rounded-lg text-sm"
                    >
                      <Rocket className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Button type="button" size="sm" variant="ghost" className="text-[10px] h-7 px-2" onClick={() => setDetailDeployment(d)}>
                        View
                      </Button>
                      <span className="font-medium flex-1">{product?.name ?? d.product_id}</span>
                      <Badge variant="outline" className="text-xs">v{d.version}</Badge>
                      {d.canary_stage === 'full' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                          Promoted from Canary
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        d.status === 'success' ? 'bg-green-100 text-green-800' :
                        d.status === 'failed'  ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {d.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Canary Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Canary Deployment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Product</Label>
              <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Version (MAJOR.MINOR.CYCLE)</Label>
              <Input
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                placeholder="e.g. 1.2.0"
              />
            </div>
            <div>
              <Label>Branch</Label>
              <Input
                value={form.branch}
                onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
              />
            </div>
            <div>
              <Label>Rollout Percentage: {form.rollout_percentage}%</Label>
              <Slider
                value={[form.rollout_percentage]}
                onValueChange={([v]) => setForm(f => ({ ...f, rollout_percentage: v }))}
                min={1} max={15} step={1}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                AI-SDLC spec recommends 5–10% for initial canary rollout.
              </p>
            </div>
            <div>
              <Label>Monitoring Window (hours)</Label>
              <Input
                type="number"
                value={form.monitoring_window_hrs}
                onChange={e => setForm(f => ({ ...f, monitoring_window_hrs: Number(e.target.value) }))}
                min={1} max={168}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.canary_notes}
                onChange={e => setForm(f => ({ ...f, canary_notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Canary Deployment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailDeployment} onOpenChange={(o) => !o && setDetailDeployment(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deployment details</DialogTitle>
          </DialogHeader>
          {detailDeployment && (
            <div className="space-y-2 text-sm">
              {[
                ['Product', detailDeployment.product_name ?? detailDeployment.product_id],
                ['Version', detailDeployment.version],
                ['Environment', detailDeployment.environment],
                ['Status', detailDeployment.status],
                ['Deploy type', detailDeployment.deploy_type],
                ['Branch', detailDeployment.branch ?? '—'],
                ['Commit', detailDeployment.commit_sha ?? '—'],
                ['Canary stage', detailDeployment.canary_stage ?? '—'],
                ['Rollout %', String(detailDeployment.rollout_percentage ?? '—')],
                ['Monitoring (hrs)', String(detailDeployment.monitoring_window_hrs ?? '—')],
                ['Canary promoted at', detailDeployment.canary_promoted_at
                  ? new Date(detailDeployment.canary_promoted_at).toLocaleString()
                  : '—'],
                ['Created', new Date(detailDeployment.created_at).toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-border/60 py-1">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-right break-all">{v}</span>
                </div>
              ))}
              {detailDeployment.canary_notes && (
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground mb-1">Canary notes</div>
                  <p className="text-sm whitespace-pre-wrap">{detailDeployment.canary_notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDeployment(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote confirmation dialog */}
      <Dialog open={!!promoteTarget} onOpenChange={() => setPromoteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Promote to Full Production
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will promote the canary deployment of{' '}
            <strong>v{promoteTarget?.version}</strong> to 100% of users.
            Monitoring window has completed. Confirm promotion?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteTarget(null)}>Cancel</Button>
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => promoteTarget && handlePromote(promoteTarget)}
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Promote to 100%
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
