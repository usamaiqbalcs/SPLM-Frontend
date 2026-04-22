import { useState, useEffect, useMemo } from 'react';
import { workflowApi, WorkflowStateDto, WorkflowAuditLogDto } from '@/lib/api-aisdlc';
import { listProductsForDropdown } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { fmtDate } from '@/lib/splm-utils';
import { toast } from 'sonner';
import { ChevronRight, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_LIST_PAGE_SIZE,
  ListPageSearchInput,
  ListPaginationBar,
  rowMatchesListSearch,
  useListPageSearchDebounce,
} from '@/components/listing/listPageSearch';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';

const PHASES = ['pm_build', 'dev_handoff', 'qa_cycle', 'acceptance', 'production'] as const;
type Phase = typeof PHASES[number];

const PHASE_CONFIG: Record<Phase, { label: string; color: string; icon: string }> = {
  pm_build: { label: 'PM Build', color: 'bg-blue-500', icon: '📋' },
  dev_handoff: { label: 'Dev Handoff', color: 'bg-yellow-500', icon: '👨‍💻' },
  qa_cycle: { label: 'QA Cycle', color: 'bg-orange-500', icon: '🧪' },
  acceptance: { label: 'Acceptance', color: 'bg-purple-500', icon: '✅' },
  production: { label: 'Production', color: 'bg-green-500', icon: '🚀' },
};

function isPhase(p: string | null | undefined): p is Phase {
  return !!p && (PHASES as readonly string[]).includes(p);
}

function phaseBadgeClass(phase: string | null | undefined): string {
  if (isPhase(phase)) return PHASE_CONFIG[phase].color;
  return 'bg-muted';
}

function phaseLabel(phase: string | null | undefined): string {
  if (!phase?.trim()) return 'Start';
  if (isPhase(phase)) return PHASE_CONFIG[phase].label;
  return phase;
}

export default function WorkflowPipelinePanel() {
  const { can } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowStateDto[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitionTarget, setTransitionTarget] = useState<WorkflowStateDto | null>(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [auditTarget, setAuditTarget] = useState<WorkflowStateDto | null>(null);
  const [auditLogs, setAuditLogs] = useState<WorkflowAuditLogDto[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [wfPage, setWfPage] = useState(1);
  const [wfSearch, setWfSearch] = useState('');
  const debouncedWfSearch = useListPageSearchDebounce(wfSearch);

  // Sort descending by phase_started_at (newest first), then filter by search
  const filteredWorkflows = useMemo(() => {
    const sorted = [...workflows].sort(
      (a, b) =>
        new Date(b.phase_started_at ?? b.updated_at).getTime() -
        new Date(a.phase_started_at ?? a.updated_at).getTime(),
    );
    if (!debouncedWfSearch.trim()) return sorted;
    return sorted.filter((w) =>
      rowMatchesListSearch(debouncedWfSearch, [w.product_name, w.phase]),
    );
  }, [workflows, debouncedWfSearch]);

  const wfTotalPages = Math.max(1, Math.ceil(filteredWorkflows.length / DEFAULT_LIST_PAGE_SIZE));
  const pagedWorkflows = useMemo(() => {
    const start = (wfPage - 1) * DEFAULT_LIST_PAGE_SIZE;
    return filteredWorkflows.slice(start, start + DEFAULT_LIST_PAGE_SIZE);
  }, [filteredWorkflows, wfPage]);

  useEffect(() => {
    setWfPage((p) => Math.min(Math.max(1, p), wfTotalPages));
  }, [wfTotalPages]);

  useEffect(() => {
    setWfPage(1);
  }, [debouncedWfSearch]);

  const load = async () => {
    setLoading(true);
    try {
      const [w, p] = await Promise.all([workflowApi.getAll(), listProductsForDropdown()]);
      setWorkflows(w);
      setProducts(p);
    } catch (e: any) {
      toast.error('Failed to load workflows: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getNextPhase = (currentPhase: Phase): Phase | null => {
    const currentIndex = PHASES.indexOf(currentPhase);
    if (currentIndex < 0) return null;
    return currentIndex < PHASES.length - 1 ? PHASES[currentIndex + 1] : null;
  };

  const handleAdvancePhase = async () => {
    if (!transitionTarget) return;
    const nextPhase = getNextPhase(transitionTarget.phase as Phase);
    if (!nextPhase) {
      toast.error('Already at final phase');
      return;
    }

    setTransitionLoading(true);
    try {
      await workflowApi.transition({
        product_id: transitionTarget.product_id,
        to_phase: nextPhase,
        note: transitionNote || undefined,
      });
      toast.success(`Transitioned to ${PHASE_CONFIG[nextPhase].label}`);
      setTransitionTarget(null);
      setTransitionNote('');
      await load();
    } catch (e: any) {
      toast.error('Failed to transition: ' + e.message);
    } finally {
      setTransitionLoading(false);
    }
  };

  const handleViewAudit = async (workflow: WorkflowStateDto) => {
    setAuditTarget(workflow);
    setAuditLoading(true);
    try {
      const logs = await workflowApi.getAudit(workflow.product_id);
      setAuditLogs(logs);
    } catch (e: any) {
      toast.error('Failed to load audit history: ' + e.message);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="animate-fade-in min-h-0 min-w-0 space-y-0">
      {/* Transition Dialog */}
      <Dialog open={!!transitionTarget} onOpenChange={(o) => !o && setTransitionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advance Workflow Phase</DialogTitle>
          </DialogHeader>
          {transitionTarget && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Product</p>
                <p className="font-semibold">{transitionTarget.product_name}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Current Phase</p>
                  <Badge className={cn('text-white', phaseBadgeClass(transitionTarget.phase))}>
                    {phaseLabel(transitionTarget.phase)}
                  </Badge>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground mt-6" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Next Phase</p>
                  {getNextPhase(transitionTarget.phase as Phase) && (
                    <Badge className={cn('text-white', phaseBadgeClass(getNextPhase(transitionTarget.phase as Phase)!))}>
                      {phaseLabel(getNextPhase(transitionTarget.phase as Phase)!)}
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Optional Note</label>
                <Textarea
                  placeholder="Add details about this transition..."
                  value={transitionNote}
                  onChange={(e) => setTransitionNote(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleAdvancePhase} disabled={transitionLoading} className="bg-primary">
              {transitionLoading ? 'Advancing…' : 'Confirm Transition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit History Dialog */}
      <Dialog open={!!auditTarget} onOpenChange={(o) => !o && setAuditTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workflow Audit History — {auditTarget?.product_name}</DialogTitle>
          </DialogHeader>
          {auditLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading audit logs…</div>
          ) : auditLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No audit history found</div>
          ) : (
            <div className="space-y-3 py-4">
              {auditLogs.map((log, i) => (
                <div key={log.id || `audit-${i}`} className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn('text-white', phaseBadgeClass(log.from_phase))}>
                        {phaseLabel(log.from_phase)}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      <Badge className={cn('text-white', phaseBadgeClass(log.to_phase))}>
                        {phaseLabel(log.to_phase)}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{fmtDate(log.created_at ?? null)}</span>
                  </div>
                  {log.transition_note && <p className="text-sm mb-1">{log.transition_note}</p>}
                  <p className="text-xs text-muted-foreground">by {log.transitioned_by_name || 'System'}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SplmPageHeader
        title="Workflow pipeline"
        subtitle="Advance products through gated phases and review transition history per product."
        actions={
          can('edit') ? (
            <Button type="button" onClick={load} variant="outline" size="sm">
              Refresh
            </Button>
          ) : undefined
        }
      />

      {/* Footer sits outside the vertical stack so inset pagination aligns with card edges, not spaced like a row. */}
      <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        {/* Search bar + match count */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {debouncedWfSearch.trim()
              ? `${filteredWorkflows.length} of ${workflows.length} match`
              : `${workflows.length} pipeline${workflows.length === 1 ? '' : 's'}`}
          </span>
          <ListPageSearchInput
            value={wfSearch}
            onChange={setWfSearch}
            className="w-full sm:w-52"
            aria-label="Search by product name or phase"
          />
        </div>

        {loading ? (
          <TableSkeleton />
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-4xl mb-3">📊</span>
            <p className="font-medium">No products in workflow</p>
            <p className="text-xs mt-1">Products will appear here once they enter the workflow</p>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-4xl mb-3">🔎</span>
            <p className="font-medium">No pipelines match your search</p>
            <p className="text-xs mt-1">Try a different product name or phase</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
            {pagedWorkflows.map((workflow) => {
              const nextPhase = isPhase(workflow.phase) ? getNextPhase(workflow.phase) : null;
              const currentPhaseConfig = isPhase(workflow.phase) ? PHASE_CONFIG[workflow.phase] : null;

              return (
                <div key={workflow.id} className="border rounded-lg p-4 bg-muted/20 hover:bg-muted/40 transition-colors">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-sm">{workflow.product_name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Started at {fmtDate(workflow.phase_started_at ?? null)}
                      </p>
                    </div>
                    <Badge className={cn('text-white text-xs', currentPhaseConfig?.color ?? 'bg-muted')}>
                      {currentPhaseConfig ? `${currentPhaseConfig.icon} ${currentPhaseConfig.label}` : (workflow.phase || 'Unknown')}
                    </Badge>
                  </div>

                  {/* Phase Progress Bar */}
                  <div className="mb-3 pb-3 border-b">
                    <div className="flex gap-1">
                      {PHASES.map((phase, idx) => {
                        const idxCurrent = isPhase(workflow.phase) ? PHASES.indexOf(workflow.phase) : -1;
                        const isCompleted = idxCurrent > idx;
                        const isCurrent = phase === workflow.phase;
                        return (
                          <div key={phase} className="flex-1 relative">
                            <div
                              className={cn(
                                'h-2 rounded-full transition-colors',
                                isCompleted ? 'bg-success' : isCurrent ? 'bg-primary' : 'bg-border'
                              )}
                            />
                            {idx < PHASES.length - 1 && (
                              <div
                                className={cn(
                                  'absolute top-1/2 -right-0.5 w-0.5 h-3 -translate-y-1/2 transition-colors',
                                  isCompleted || isCurrent ? 'bg-primary' : 'bg-border'
                                )}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      {PHASES.map((phase) => (
                        <span key={phase}>{PHASE_CONFIG[phase].label.split(' ')[0]}</span>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  {workflow.phase_note && (
                    <div className="mb-3 p-2 bg-background rounded text-xs border-l-2 border-primary">
                      <p className="text-muted-foreground">{workflow.phase_note}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {can('edit') && nextPhase && (
                      <Button
                        size="sm"
                        onClick={() => setTransitionTarget(workflow)}
                        className="flex-1"
                      >
                        Advance to {PHASE_CONFIG[nextPhase].label}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewAudit(workflow)}
                      className="flex-shrink-0"
                    >
                      <History className="w-3.5 h-3.5 mr-1" />
                      History
                    </Button>
                  </div>
                </div>
              );
            })}
            </div>
            <ListPaginationBar
              variant="inset"
              page={wfPage}
              totalPages={wfTotalPages}
              totalItems={filteredWorkflows.length}
              pageSize={DEFAULT_LIST_PAGE_SIZE}
              onPageChange={setWfPage}
              disabled={loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
