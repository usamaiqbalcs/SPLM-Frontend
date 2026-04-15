import { useEffect, useState, useMemo } from 'react';
import { qaIssuesApi, qaCyclesApi, QaIssueDto, QaCycleDto } from '@/lib/api-aisdlc';
import { listProductsForDropdown } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/forms/SearchableSelect';

const FIX_REJECTION_REASON_OPTIONS = [
  { value: '', label: 'Select reason…' },
  { value: 'logic_error', label: 'Logic Error' },
  { value: 'performance_issue', label: 'Performance Issue' },
  { value: 'security_risk', label: 'Security Risk' },
  { value: 'style_violation', label: 'Style Violation' },
  { value: 'scope_creep', label: 'Scope Creep' },
];
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, Edit2, XCircle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface ReviewActionDialog {
  type: 'reject';
  issueId: string;
  open: boolean;
}

export default function FixReviewPanel() {
  const [issues, setIssues] = useState<QaIssueDto[]>([]);
  const [cycles, setCycles] = useState<QaCycleDto[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rejectionDialog, setRejectionDialog] = useState<ReviewActionDialog>({
    type: 'reject',
    issueId: '',
    open: false,
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Filters
  const [productFilter, setProductFilter] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p, issueRows] = await Promise.all([
        qaCyclesApi.getAll(),
        listProductsForDropdown(),
        qaIssuesApi.getForFixReview(),
      ]);
      setCycles(c);
      setProducts(p);
      setIssues(issueRows);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getSeverityConfig = (severity: string) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      P1: { label: 'P1 - Critical', variant: 'destructive' },
      P2: { label: 'P2 - High', variant: 'outline' },
      P3: { label: 'P3 - Medium', variant: 'secondary' },
      P4: { label: 'P4 - Low', variant: 'outline' },
    };
    return configs[severity] || { label: severity, variant: 'outline' };
  };

  const getConfidenceConfig = (confidence: string) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      high: { label: 'High', variant: 'default' },
      medium: { label: 'Medium', variant: 'secondary' },
      low: { label: 'Low', variant: 'destructive' },
    };
    return configs[confidence] || { label: 'Unknown', variant: 'outline' };
  };

  const handleReview = async (issueId: string, reviewStatus: 'accepted' | 'modified' | 'rejected', data?: any) => {
    setReviewing(issueId);
    try {
      const reviewData: any = { review_status: reviewStatus };
      if (data) {
        if (data.rejection_reason_code) reviewData.rejection_reason_code = data.rejection_reason_code;
        if (data.rejection_notes) reviewData.rejection_notes = data.rejection_notes;
      }
      await qaIssuesApi.review(issueId, reviewData);
      toast.success(`Issue ${reviewStatus}`);
      // Remove from list with smooth transition
      setIssues(issues.filter(i => i.id !== issueId));
      setExpandedId(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReviewing(null);
    }
  };

  const handleAccept = (issueId: string) => {
    handleReview(issueId, 'accepted');
  };

  const handleModify = (issueId: string) => {
    // TODO: Could enhance with a note dialog for modification context
    handleReview(issueId, 'modified', { rejection_notes: 'Modified by developer' });
  };

  const handleRejectClick = (issueId: string) => {
    setRejectionDialog({ type: 'reject', issueId, open: true });
    setRejectionReason('');
    setRejectionNotes('');
  };

  const handleRejectConfirm = async () => {
    if (!rejectionReason || !rejectionNotes.trim()) {
      return toast.error('Please select a reason and add notes');
    }
    await handleReview(rejectionDialog.issueId, 'rejected', {
      rejection_reason_code: rejectionReason,
      rejection_notes: rejectionNotes,
    });
    setRejectionDialog({ ...rejectionDialog, open: false });
  };

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      if (showPendingOnly && issue.review_status !== 'pending') return false;
      if (!issue.fix_applied) return false;
      if (productFilter && issue.product_id !== productFilter) return false;
      if (cycleFilter && issue.qa_cycle_id !== cycleFilter) return false;
      if (severityFilter && issue.severity !== severityFilter) return false;
      return true;
    });
  }, [issues, productFilter, cycleFilter, severityFilter, showPendingOnly]);

  // Stats
  const stats = useMemo(() => {
    const fixed = issues.filter(i => i.fix_applied);
    return {
      pending: fixed.filter(i => i.review_status === 'pending').length,
      accepted: fixed.filter(i => i.review_status === 'accepted').length,
      modified: fixed.filter(i => i.review_status === 'modified').length,
      rejected: fixed.filter(i => i.review_status === 'rejected').length,
    };
  }, [issues]);

  const severityOptions = ['P1', 'P2', 'P3', 'P4'];

  const fixReviewProductFilterOptions = useMemo(
    () => [{ value: '', label: 'All Products' }, ...products.map((p: any) => ({ value: p.id, label: p.name }))],
    [products],
  );
  const fixReviewCycleFilterOptions = useMemo(
    () => [{ value: '', label: 'All Cycles' }, ...cycles.map((c) => ({ value: c.id, label: `v${c.version_label}` }))],
    [cycles],
  );
  const fixReviewSeverityFilterOptions = useMemo(
    () => [{ value: '', label: 'All Severities' }, ...severityOptions.map((s) => ({ value: s, label: s }))],
    [],
  );

  return (
    <div className="animate-fade-in space-y-4">
      {/* ── Rejection dialog ── */}
      <AlertDialog open={rejectionDialog.open} onOpenChange={o => setRejectionDialog({ ...rejectionDialog, open: o })}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Fix</AlertDialogTitle>
            <AlertDialogDescription>Provide reason and notes for rejection</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label className="mb-2 block">Rejection Reason *</Label>
              <SearchableSelect
                options={FIX_REJECTION_REASON_OPTIONS}
                value={rejectionReason}
                onValueChange={setRejectionReason}
                placeholder="Select reason…"
                searchPlaceholder="Search reason…"
                contentWidth="wide"
              />
            </div>
            <div>
              <Label className="mb-2 block">Rejection Notes *</Label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background min-h-[80px]"
                value={rejectionNotes}
                onChange={e => setRejectionNotes(e.target.value)}
                placeholder="Explain why this fix is being rejected…"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={!rejectionReason || !rejectionNotes.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Pending', value: stats.pending, icon: <AlertCircle className="w-4 h-4" />, color: 'text-warning' },
          { label: 'Accepted', value: stats.accepted, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-success' },
          { label: 'Modified', value: stats.modified, icon: <Edit2 className="w-4 h-4" />, color: 'text-blue-500' },
          { label: 'Rejected', value: stats.rejected, icon: <XCircle className="w-4 h-4" />, color: 'text-destructive' },
          { label: 'Total Fixed', value: stats.pending + stats.accepted + stats.modified + stats.rejected, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-primary' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-lg border p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">{s.label}</span>
              <span className={s.color}>{s.icon}</span>
            </div>
            <div className={cn('text-2xl font-extrabold', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Main panel ── */}
      <div className="bg-card rounded-lg border p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-primary">👁️ Developer Fix Review</h3>
          <div className="text-xs text-muted-foreground">
            Showing {filteredIssues.length} of {stats.pending} pending
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-muted/30 rounded-lg p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="mb-2 block text-xs">Product</Label>
            <SearchableSelect
              options={fixReviewProductFilterOptions}
              value={productFilter}
              onValueChange={setProductFilter}
              placeholder="All Products"
              searchPlaceholder="Search products…"
              contentWidth="wide"
            />
          </div>
          <div>
            <Label className="mb-2 block text-xs">QA Cycle</Label>
            <SearchableSelect
              options={fixReviewCycleFilterOptions}
              value={cycleFilter}
              onValueChange={setCycleFilter}
              placeholder="All Cycles"
              searchPlaceholder="Search cycles…"
              contentWidth="wide"
            />
          </div>
          <div>
            <Label className="mb-2 block text-xs">Severity</Label>
            <SearchableSelect
              options={fixReviewSeverityFilterOptions}
              value={severityFilter}
              onValueChange={setSeverityFilter}
              placeholder="All Severities"
              searchPlaceholder="Search severity…"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pendingOnly"
              checked={showPendingOnly}
              onChange={e => setShowPendingOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="pendingOnly" className="text-xs text-muted-foreground cursor-pointer">Pending only</label>
          </div>
        </div>

        {/* ── Issues list ── */}
        {loading ? (
          <TableSkeleton />
        ) : filteredIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="font-medium">No pending fixes</p>
            <p className="text-xs mt-1">All fixes have been reviewed</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredIssues.map(issue => {
              const severityConfig = getSeverityConfig(issue.severity);
              const confidenceConfig = getConfidenceConfig(issue.confidence_rating);
              const isExpanded = expandedId === issue.id;

              return (
                <div
                  key={issue.id}
                  className={cn(
                    'border rounded-lg overflow-hidden transition-all',
                    isExpanded ? 'bg-muted/40 border-primary/30' : 'bg-muted/20 hover:bg-muted/30'
                  )}
                >
                  {/* ── Issue header (clickable) ── */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                    className="p-4 cursor-pointer flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-1 flex-shrink-0">
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-sm font-bold text-foreground">{issue.issue_ref}</span>
                          <Badge variant={severityConfig.variant as any} className="text-xs">{severityConfig.label}</Badge>
                          <Badge variant={confidenceConfig.variant as any} className="text-xs">{confidenceConfig.label}</Badge>
                        </div>
                        <h4 className="text-sm font-medium text-foreground mb-1">{issue.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>📦 {issue.affected_module}</span>
                          <span>•</span>
                          <span>🤖 {issue.ai_model_used}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Expanded details ── */}
                  {isExpanded && (
                    <div className="px-4 py-3 border-t bg-background/50 space-y-4 animate-in fade-in">
                      {/* Fix description */}
                      {issue.fix_description && (
                        <div>
                          <h5 className="text-sm font-semibold text-foreground mb-2">Fix Description</h5>
                          <div className="bg-card rounded border p-3 text-sm text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                            {issue.fix_description}
                          </div>
                        </div>
                      )}

                      {/* Reproduction steps */}
                      {issue.reproduction_steps && (
                        <div>
                          <h5 className="text-sm font-semibold text-foreground mb-2">Reproduction Steps</h5>
                          <div className="bg-card rounded border p-3 text-sm text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                            {issue.reproduction_steps}
                          </div>
                        </div>
                      )}

                      {/* Details grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="bg-card rounded p-3 border">
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Severity</div>
                          <Badge variant={severityConfig.variant as any}>{severityConfig.label}</Badge>
                        </div>
                        <div className="bg-card rounded p-3 border">
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Confidence</div>
                          <Badge variant={confidenceConfig.variant as any}>{confidenceConfig.label}</Badge>
                        </div>
                        <div className="bg-card rounded p-3 border">
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Module</div>
                          <div className="text-sm font-medium text-foreground truncate">{issue.affected_module}</div>
                        </div>
                        <div className="bg-card rounded p-3 border">
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">AI Model</div>
                          <div className="text-sm font-medium text-foreground truncate">{issue.ai_model_used}</div>
                        </div>
                        {issue.prompt_name && (
                          <div className="bg-card rounded p-3 border">
                            <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Prompt</div>
                            <div className="text-sm font-medium text-foreground truncate">{issue.prompt_name}</div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          onClick={() => handleAccept(issue.id)}
                          disabled={reviewing === issue.id}
                          className="flex-1 bg-success hover:bg-success/90"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          {reviewing === issue.id ? 'Accepting…' : 'Accept'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleModify(issue.id)}
                          disabled={reviewing === issue.id}
                          className="flex-1"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          {reviewing === issue.id ? 'Modifying…' : 'Modify'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectClick(issue.id)}
                          disabled={reviewing === issue.id}
                          className="flex-1"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          {reviewing === issue.id ? 'Rejecting…' : 'Reject'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
