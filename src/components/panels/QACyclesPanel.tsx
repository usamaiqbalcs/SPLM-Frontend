import { useState, useEffect } from 'react';
import { qaCyclesApi, qaIssuesApi, QaCycleDto, QaIssueDto } from '@/lib/api-aisdlc';
import { listProducts } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { fmtDate } from '@/lib/splm-utils';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-500' },
  in_review: { label: 'In Review', color: 'bg-yellow-500' },
  closed: { label: 'Closed', color: 'bg-gray-500' },
  passed: { label: 'Passed', color: 'bg-green-500' },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  P1: { label: 'P1 — Critical', color: 'bg-red-500' },
  P2: { label: 'P2 — High', color: 'bg-orange-500' },
  P3: { label: 'P3 — Medium', color: 'bg-yellow-500' },
  P4: { label: 'P4 — Low', color: 'bg-blue-500' },
};

const REVIEW_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-500' },
  accepted: { label: 'Accepted', color: 'bg-green-500' },
  modified: { label: 'Modified', color: 'bg-yellow-500' },
  rejected: { label: 'Rejected', color: 'bg-red-500' },
};

const CONFIDENCE_CONFIG: Record<string, string> = {
  high: '🟢 High',
  medium: '🟡 Medium',
  low: '🔴 Low',
};

interface CreateCycleForm {
  product_id: string;
  version_label: string;
  notes: string;
}

interface CreateIssueForm {
  title: string;
  description: string;
  affected_module: string;
  severity: string;
  reproduction_steps: string;
  fix_description: string;
  confidence_rating: string;
  ai_model_used: string;
  fix_applied: boolean;
}

export default function QACyclesPanel() {
  const { can } = useAuth();
  const [cycles, setCycles] = useState<QaCycleDto[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [cycleIssues, setCycleIssues] = useState<Record<string, QaIssueDto[]>>({});
  const [issueLoading, setIssueLoading] = useState<Record<string, boolean>>({});
  const [createCycleOpen, setCreateCycleOpen] = useState(false);
  const [newCycleForm, setNewCycleForm] = useState<CreateCycleForm>({
    product_id: '',
    version_label: '',
    notes: '',
  });
  const [cycleCreating, setCycleCreating] = useState(false);
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [createIssueCycleId, setCreateIssueCycleId] = useState<string | null>(null);
  const [newIssueForm, setNewIssueForm] = useState<CreateIssueForm>({
    title: '',
    description: '',
    affected_module: '',
    severity: 'P2',
    reproduction_steps: '',
    fix_description: '',
    confidence_rating: 'medium',
    ai_model_used: '',
    fix_applied: false,
  });
  const [issueCreating, setIssueCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([qaCyclesApi.getAll(), listProducts()]);
      setCycles(c);
      setProducts(p);
    } catch (e: any) {
      toast.error('Failed to load QA cycles: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadIssuesForCycle = async (cycleId: string) => {
    setIssueLoading((prev) => ({ ...prev, [cycleId]: true }));
    try {
      const issues = await qaIssuesApi.getByCycle(cycleId);
      setCycleIssues((prev) => ({ ...prev, [cycleId]: issues }));
    } catch (e: any) {
      toast.error('Failed to load issues: ' + e.message);
      setCycleIssues((prev) => ({ ...prev, [cycleId]: [] }));
    } finally {
      setIssueLoading((prev) => ({ ...prev, [cycleId]: false }));
    }
  };

  const handleExpandCycle = async (cycleId: string) => {
    if (expandedCycleId === cycleId) {
      setExpandedCycleId(null);
    } else {
      setExpandedCycleId(cycleId);
      if (!cycleIssues[cycleId]) {
        await loadIssuesForCycle(cycleId);
      }
    }
  };

  const validateVersionLabel = (label: string): boolean => {
    return /^\d+\.\d+\.\d+$/.test(label);
  };

  const handleCreateCycle = async () => {
    if (!newCycleForm.product_id || !newCycleForm.version_label) {
      toast.error('Product and version label are required');
      return;
    }
    if (!validateVersionLabel(newCycleForm.version_label)) {
      toast.error('Version label must follow MAJOR.MINOR.CYCLE format (e.g., 1.2.3)');
      return;
    }

    setCycleCreating(true);
    try {
      const product = products.find((p) => p.id === newCycleForm.product_id);
      await qaCyclesApi.create({
        product_id: newCycleForm.product_id,
        product_name: product?.name || '',
        cycle_number: Math.max(...cycles.filter((c) => c.product_id === newCycleForm.product_id).map((c) => c.cycle_number || 0), 0) + 1,
        version_label: newCycleForm.version_label,
        status: 'open',
        notes: newCycleForm.notes,
      });
      toast.success('QA cycle created successfully');
      setCreateCycleOpen(false);
      setNewCycleForm({ product_id: '', version_label: '', notes: '' });
      await load();
    } catch (e: any) {
      toast.error('Failed to create cycle: ' + e.message);
    } finally {
      setCycleCreating(false);
    }
  };

  const handleCreateIssue = async () => {
    if (!createIssueCycleId) return;
    if (!newIssueForm.title || !newIssueForm.affected_module) {
      toast.error('Title and affected module are required');
      return;
    }

    setIssueCreating(true);
    try {
      const cycle = cycles.find((c) => c.id === createIssueCycleId);
      if (!cycle) throw new Error('Cycle not found');

      await qaIssuesApi.create({
        qa_cycle_id: createIssueCycleId,
        product_id: cycle.product_id,
        product_name: cycle.product_name,
        title: newIssueForm.title,
        description: newIssueForm.description,
        affected_module: newIssueForm.affected_module,
        severity: newIssueForm.severity,
        reproduction_steps: newIssueForm.reproduction_steps,
        fix_description: newIssueForm.fix_description,
        confidence_rating: newIssueForm.confidence_rating,
        ai_model_used: newIssueForm.ai_model_used,
        fix_applied: newIssueForm.fix_applied,
        review_status: 'pending',
      });
      toast.success('QA issue logged successfully');
      setCreateIssueOpen(false);
      setCreateIssueCycleId(null);
      setNewIssueForm({
        title: '',
        description: '',
        affected_module: '',
        severity: 'P2',
        reproduction_steps: '',
        fix_description: '',
        confidence_rating: 'medium',
        ai_model_used: '',
        fix_applied: false,
      });
      await loadIssuesForCycle(createIssueCycleId);
    } catch (e: any) {
      toast.error('Failed to create issue: ' + e.message);
    } finally {
      setIssueCreating(false);
    }
  };

  const calculatePassRate = (cycle: QaCycleDto): string => {
    const issues = cycleIssues[cycle.id] || [];
    if (issues.length === 0) return '—';
    const accepted = issues.filter((i) => i.review_status === 'accepted').length;
    return `${Math.round((accepted / issues.length) * 100)}%`;
  };

  const calculateDuration = (cycle: QaCycleDto): string => {
    if (!cycle.closed_at) return 'In Progress';
    const start = new Date(cycle.started_at).getTime();
    const end = new Date(cycle.closed_at).getTime();
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return `${days}d`;
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Create Cycle Dialog */}
      <Dialog open={createCycleOpen} onOpenChange={setCreateCycleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New QA Cycle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="product-select" className="text-sm font-medium mb-1 block">
                Product *
              </Label>
              <select
                id="product-select"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={newCycleForm.product_id}
                onChange={(e) =>
                  setNewCycleForm((f) => ({ ...f, product_id: e.target.value }))
                }
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="version-input" className="text-sm font-medium mb-1 block">
                Version Label (MAJOR.MINOR.CYCLE) *
              </Label>
              <Input
                id="version-input"
                placeholder="1.2.3"
                value={newCycleForm.version_label}
                onChange={(e) =>
                  setNewCycleForm((f) => ({ ...f, version_label: e.target.value }))
                }
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="notes-input" className="text-sm font-medium mb-1 block">
                Notes
              </Label>
              <Textarea
                id="notes-input"
                placeholder="Add cycle details…"
                value={newCycleForm.notes}
                onChange={(e) =>
                  setNewCycleForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateCycleOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCycle}
              disabled={cycleCreating}
              className="bg-primary"
            >
              {cycleCreating ? 'Creating…' : 'Create Cycle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Issue Dialog */}
      <Dialog open={createIssueOpen} onOpenChange={setCreateIssueOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log QA Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Title *</Label>
                <Input
                  placeholder="Issue title"
                  value={newIssueForm.title}
                  onChange={(e) =>
                    setNewIssueForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Affected Module *</Label>
                <Input
                  placeholder="e.g., Authentication, Payment"
                  value={newIssueForm.affected_module}
                  onChange={(e) =>
                    setNewIssueForm((f) => ({
                      ...f,
                      affected_module: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Description</Label>
              <Textarea
                placeholder="Detailed description of the issue"
                value={newIssueForm.description}
                onChange={(e) =>
                  setNewIssueForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Severity</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={newIssueForm.severity}
                  onChange={(e) =>
                    setNewIssueForm((f) => ({ ...f, severity: e.target.value }))
                  }
                >
                  {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Confidence</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={newIssueForm.confidence_rating}
                  onChange={(e) =>
                    setNewIssueForm((f) => ({
                      ...f,
                      confidence_rating: e.target.value,
                    }))
                  }
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">AI Model</Label>
                <Input
                  placeholder="e.g., GPT-4, Claude"
                  value={newIssueForm.ai_model_used}
                  onChange={(e) =>
                    setNewIssueForm((f) => ({
                      ...f,
                      ai_model_used: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Reproduction Steps
              </Label>
              <Textarea
                placeholder="Step-by-step instructions to reproduce the issue"
                value={newIssueForm.reproduction_steps}
                onChange={(e) =>
                  setNewIssueForm((f) => ({
                    ...f,
                    reproduction_steps: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Fix Description
              </Label>
              <Textarea
                placeholder="Description of the fix applied"
                value={newIssueForm.fix_description}
                onChange={(e) =>
                  setNewIssueForm((f) => ({
                    ...f,
                    fix_description: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="fix-applied"
                checked={newIssueForm.fix_applied}
                onChange={(e) =>
                  setNewIssueForm((f) => ({ ...f, fix_applied: e.target.checked }))
                }
                className="w-4 h-4 rounded border"
              />
              <Label htmlFor="fix-applied" className="text-sm font-medium cursor-pointer">
                Fix Applied
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateIssueOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateIssue}
              disabled={issueCreating}
              className="bg-primary"
            >
              {issueCreating ? 'Logging…' : 'Log Issue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Panel */}
      <div className="bg-card rounded-lg border p-5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-primary">🧪 QA Cycles ({cycles.length})</h3>
          {can('edit') && (
            <Button onClick={() => setCreateCycleOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Cycle
            </Button>
          )}
        </div>

        {loading ? (
          <TableSkeleton />
        ) : cycles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-4xl mb-3">🧪</span>
            <p className="font-medium">No QA cycles</p>
            <p className="text-xs mt-1">Create a new cycle to start QA testing</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cycles.map((cycle) => (
              <div key={cycle.id}>
                {/* Cycle Row */}
                <div
                  onClick={() => handleExpandCycle(cycle.id)}
                  className="border rounded-lg p-4 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{cycle.product_name}</span>
                        <Badge className={cn('text-white text-xs', STATUS_CONFIG[cycle.status]?.color)}>
                          {STATUS_CONFIG[cycle.status]?.label || cycle.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-3">
                        <span>Version {cycle.version_label}</span>
                        <span>Cycle #{cycle.cycle_number}</span>
                        <span>{cycle.total_issues_found} issues • {cycle.total_fixes_applied} fixes</span>
                        <span>Pass Rate: {calculatePassRate(cycle)}</span>
                        <span>Duration: {calculateDuration(cycle)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-muted-foreground">
                      {expandedCycleId === cycle.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Issues Table - Expanded */}
                {expandedCycleId === cycle.id && (
                  <div className="border-l border-r border-b rounded-b-lg p-4 bg-muted/10">
                    {issueLoading[cycle.id] ? (
                      <div className="py-4 text-center text-muted-foreground text-sm">
                        Loading issues…
                      </div>
                    ) : (cycleIssues[cycle.id] || []).length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground flex flex-col items-center justify-center">
                        <p className="text-sm">No issues logged for this cycle</p>
                        {can('edit') && cycle.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreateIssueCycleId(cycle.id);
                              setCreateIssueOpen(true);
                            }}
                            className="mt-3"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Log First Issue
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-sm font-semibold">
                            Issues ({(cycleIssues[cycle.id] || []).length})
                          </p>
                          {can('edit') && cycle.status === 'open' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreateIssueCycleId(cycle.id);
                                setCreateIssueOpen(true);
                              }}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              Log Issue
                            </Button>
                          )}
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-xs">Ref</TableHead>
                                <TableHead className="text-xs">Title</TableHead>
                                <TableHead className="text-xs">Severity</TableHead>
                                <TableHead className="text-xs">Module</TableHead>
                                <TableHead className="text-xs">Confidence</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(cycleIssues[cycle.id] || []).map((issue) => (
                                <TableRow key={issue.id} className="text-xs">
                                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                                    {issue.issue_ref}
                                  </TableCell>
                                  <TableCell className="font-medium max-w-xs truncate">
                                    {issue.title}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className={cn(
                                        'text-white text-[10px]',
                                        SEVERITY_CONFIG[issue.severity]?.color
                                      )}
                                    >
                                      {issue.severity}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{issue.affected_module}</TableCell>
                                  <TableCell>
                                    {CONFIDENCE_CONFIG[issue.confidence_rating] ||
                                      issue.confidence_rating}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      className={cn(
                                        'text-white text-[10px]',
                                        REVIEW_STATUS_CONFIG[
                                          issue.review_status
                                        ]?.color
                                      )}
                                    >
                                      {REVIEW_STATUS_CONFIG[issue.review_status]
                                        ?.label || issue.review_status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
