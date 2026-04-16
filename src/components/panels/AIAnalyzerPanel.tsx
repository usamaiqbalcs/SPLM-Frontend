import { useEffect, useState, useMemo } from 'react';
import { analyzerReportsApi, qaCyclesApi, AnalyzerReportDto, QaCycleDto } from '@/lib/api-aisdlc';
import {
  DEFAULT_LIST_PAGE_SIZE,
  ListPageSearchInput,
  ListPaginationBar,
  rowMatchesListSearch,
  useListPageSearchDebounce,
} from '@/components/listing/listPageSearch';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { fmtDateTime } from '@/lib/splm-utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
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
import { Zap, ChevronDown, ChevronUp, Code2, GitBranch, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface ChangedFile {
  file_name: string;
  lines_added: number;
  lines_removed: number;
}

export default function AIAnalyzerPanel() {
  const [reports, setReports] = useState<AnalyzerReportDto[]>([]);
  const [cycles, setCycles] = useState<QaCycleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [listSearch, setListSearch] = useState('');
  const debouncedListSearch = useListPageSearchDebounce(listSearch);

  const load = () => {
    setLoading(true);
    Promise.all([analyzerReportsApi.getAll(), qaCyclesApi.getAll()])
      .then(([r, c]) => { setReports(r); setCycles(c); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
      pending: { icon: <Clock className="w-4 h-4" />, label: 'Pending', color: 'text-muted-foreground', bg: 'bg-muted/50' },
      running: { icon: <Zap className="w-4 h-4 animate-pulse" />, label: 'Running', color: 'text-blue-500', bg: 'bg-blue-50' },
      completed: { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Completed', color: 'text-success', bg: 'bg-success/10' },
      failed: { icon: <XCircle className="w-4 h-4" />, label: 'Failed', color: 'text-destructive', bg: 'bg-destructive/10' },
    };
    return configs[status] || configs.pending;
  };

  const getConfidenceConfig = (confidence: string) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      high: { label: 'High', variant: 'default' },
      medium: { label: 'Medium', variant: 'secondary' },
      low: { label: 'Low', variant: 'destructive' },
    };
    return configs[confidence] || { label: 'Unknown', variant: 'outline' };
  };

  const doTriggerAnalysis = async () => {
    if (!selectedCycle) return toast.error('Please select a QA cycle');
    setTriggering(true);
    try {
      const cycle = cycles.find(c => c.id === selectedCycle);
      if (!cycle) return toast.error('Cycle not found');
      await analyzerReportsApi.trigger({ qa_cycle_id: selectedCycle, product_id: cycle.product_id });
      toast.success('Analysis triggered');
      setTriggerDialogOpen(false);
      setSelectedCycle('');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTriggering(false);
    }
  };

  const parseChangedFiles = (jsonStr: string): ChangedFile[] => {
    try {
      const raw = JSON.parse(jsonStr);
      if (!Array.isArray(raw)) return [];
      return raw.map((x: Record<string, unknown>) => ({
        file_name: String(x.file_name ?? x.file ?? ''),
        lines_added: Number(x.lines_added ?? x.additions ?? 0),
        lines_removed: Number(x.lines_removed ?? x.deletions ?? 0),
      }));
    } catch {
      return [];
    }
  };

  const filteredReports = useMemo(() => {
    const q = debouncedListSearch;
    if (!q.trim()) return reports;
    return reports.filter(r =>
      rowMatchesListSearch(q, [
        r.report_reference,
        r.product_name,
        r.status,
        r.overall_confidence,
        r.diff_summary,
        r.notes,
        r.analyzer_engine,
      ]),
    );
  }, [reports, debouncedListSearch]);

  const analyzerCycleOptions = useMemo(
    () => [
      { value: '', label: 'Select a cycle…' },
      ...cycles
        .filter((c) => c.status !== 'closed')
        .map((c) => ({
          value: c.id,
          label: `${c.product_name} • v${c.version_label} (Cycle #${c.cycle_number})`,
        })),
    ],
    [cycles],
  );

  const [reportListPage, setReportListPage] = useState(1);
  const reportTotalPages = Math.max(1, Math.ceil(filteredReports.length / DEFAULT_LIST_PAGE_SIZE));
  const pagedFilteredReports = useMemo(() => {
    const start = (reportListPage - 1) * DEFAULT_LIST_PAGE_SIZE;
    return filteredReports.slice(start, start + DEFAULT_LIST_PAGE_SIZE);
  }, [filteredReports, reportListPage]);

  useEffect(() => {
    setReportListPage(1);
  }, [debouncedListSearch]);

  useEffect(() => {
    setReportListPage((p) => Math.min(Math.max(1, p), reportTotalPages));
  }, [reportTotalPages]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, running: 0, completed: 0, failed: 0 };
    filteredReports.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
    return { ...counts, total: filteredReports.length };
  }, [filteredReports]);

  return (
    <div className="animate-fade-in min-h-0 min-w-0 space-y-4">
      {/* ── Trigger dialog ── */}
      <AlertDialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trigger New Analysis</AlertDialogTitle>
            <AlertDialogDescription>Select a QA cycle to analyze</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <Label className="mb-2 block">QA Cycle *</Label>
            <SearchableSelect
              options={analyzerCycleOptions}
              value={selectedCycle}
              onValueChange={setSelectedCycle}
              placeholder="Select a cycle…"
              searchPlaceholder="Search QA cycles…"
              contentWidth="wide"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doTriggerAnalysis}
              disabled={triggering || !selectedCycle}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {triggering ? 'Triggering…' : 'Trigger Analysis'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SplmPageHeader
        title="AI analyzer reports"
        subtitle="Backend diff analysis runs per QA cycle — review status, confidence, and drill into changed files."
        actions={<Button onClick={() => setTriggerDialogOpen(true)}>Trigger new analysis</Button>}
      />

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: <Zap className="w-4 h-4" />, color: 'text-primary' },
          { label: 'Pending', value: stats.pending, icon: <Clock className="w-4 h-4" />, color: 'text-muted-foreground' },
          { label: 'Running', value: stats.running, icon: <Zap className="w-4 h-4" />, color: 'text-blue-500' },
          { label: 'Completed', value: stats.completed, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-success' },
          { label: 'Failed', value: stats.failed, icon: <XCircle className="w-4 h-4" />, color: 'text-destructive' },
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

      {/* ── Main panel (pagination outside stacked rows = aligned inset footer). ── */}
      <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <div className="mb-4">
          <ListPageSearchInput
            value={listSearch}
            onChange={setListSearch}
            className="w-full sm:w-52"
            aria-label="Search analyzer reports"
          />
        </div>

        {loading ? (
          <TableSkeleton />
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Zap className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="font-medium">No analyzer reports</p>
            <p className="text-xs mt-1">Trigger a new analysis to get started</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="font-medium">No reports match your search</p>
            <p className="text-xs mt-1">Clear the search box to see all reports</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
            {pagedFilteredReports.map(report => {
              const statusConfig = getStatusConfig(report.status);
              const confidenceConfig = getConfidenceConfig(report.overall_confidence);
              const isExpanded = expandedId === report.id;
              const changedFiles = parseChangedFiles(report.changed_files_json || '[]');

              return (
                <div
                  key={report.id}
                  className={cn(
                    'border rounded-lg overflow-hidden transition-all',
                    isExpanded ? 'bg-muted/40 border-primary/30' : 'bg-muted/20 hover:bg-muted/30'
                  )}
                >
                  {/* ── Report header (clickable) ── */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : report.id)}
                    className="p-4 cursor-pointer group flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-1 flex-shrink-0">
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-foreground">{report.report_reference}</span>
                          <span className={cn('text-xs font-semibold', statusConfig.color)}>
                            {statusConfig.icon}
                          </span>
                          <span className="text-xs text-muted-foreground">{report.product_name}</span>
                          {report.task_title && (
                            <Badge variant="outline" className="text-[10px]">Task: {report.task_title}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <span>v{report.product_name}</span>
                          <span>•</span>
                          <span>{fmtDateTime(report.run_triggered_at)}</span>
                          {report.run_completed_at && (
                            <>
                              <span>•</span>
                              <span>Done {fmtDateTime(report.run_completed_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <Badge variant={confidenceConfig.variant as any}>{confidenceConfig.label}</Badge>
                      <div className="text-right">
                        <div className="text-sm font-bold text-foreground">{report.total_issues_found}</div>
                        <div className="text-[10px] text-muted-foreground">issues</div>
                      </div>
                    </div>
                  </div>

                  {/* ── Expanded details ── */}
                  {isExpanded && (
                    <div className="px-4 py-3 border-t bg-background/50 space-y-4 animate-in fade-in">
                      {/* Summary stats */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="bg-card rounded p-3 border">
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Issues Found</div>
                          <div className="text-2xl font-bold text-foreground">{report.total_issues_found}</div>
                        </div>
                        <div className="bg-card rounded p-3 border">
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Fixes Applied</div>
                          <div className="text-2xl font-bold text-foreground">{report.total_fixes_applied}</div>
                        </div>
                        <div className="bg-card rounded p-3 border">
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Confidence</div>
                          <Badge variant={confidenceConfig.variant as any} className="text-sm">{confidenceConfig.label}</Badge>
                        </div>
                        <div className="bg-card rounded p-3 border">
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Status</div>
                          <div className="flex items-center gap-1 text-sm font-semibold">
                            <span className={statusConfig.color}>{statusConfig.icon}</span>
                            {statusConfig.label}
                          </div>
                        </div>
                      </div>

                      {/* Changed files */}
                      {changedFiles.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                            <Code2 className="w-4 h-4" />
                            Changed Files ({changedFiles.length})
                          </h4>
                          <div className="bg-card rounded border p-3 space-y-1 max-h-48 overflow-y-auto">
                            {changedFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs p-2 bg-muted/40 rounded">
                                <code className="text-muted-foreground flex-1 truncate">{file.file_name}</code>
                                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                  <span className="text-success font-semibold">+{file.lines_added}</span>
                                  <span className="text-destructive font-semibold">-{file.lines_removed}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Diff summary */}
                      {report.diff_summary && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2">Diff Summary</h4>
                          <div className="bg-card rounded border p-3 text-sm text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                            {report.diff_summary}
                          </div>
                        </div>
                      )}

                      {/* Git diff info */}
                      {report.git_diff && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                            <GitBranch className="w-4 h-4" />
                            Git Diff Info
                          </h4>
                          <div className="bg-card rounded border p-3 space-y-2 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-muted-foreground">Base:</span>
                                <code className="block text-foreground font-mono truncate">{report.git_diff.base_commit.slice(0, 8)}</code>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Head:</span>
                                <code className="block text-foreground font-mono truncate">{report.git_diff.head_commit.slice(0, 8)}</code>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Files Changed:</span>
                                <div className="text-foreground font-semibold">{report.git_diff.files_changed}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Lines:</span>
                                <div className="text-foreground font-semibold">
                                  <span className="text-success">+{report.git_diff.lines_added}</span>
                                  {' '}
                                  <span className="text-destructive">-{report.git_diff.lines_removed}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {report.notes && (
                        <div className="bg-blue-50 rounded border border-blue-200 p-3 flex gap-2">
                          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-blue-900">{report.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            <ListPaginationBar
              variant="inset"
              page={reportListPage}
              totalPages={reportTotalPages}
              totalItems={filteredReports.length}
              pageSize={DEFAULT_LIST_PAGE_SIZE}
              onPageChange={setReportListPage}
              disabled={loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
