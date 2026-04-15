import { useEffect, useMemo, useState } from 'react';
import {
  aiSdlcOverviewApi,
  AiSdlcOverviewDto,
} from '@/lib/api-aisdlc';
import { listProductsForDropdown } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { Skeleton } from '@/components/ui/skeleton';
import { fmtDateTime } from '@/lib/splm-utils';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Activity, BarChart3, FlaskConical, GitMerge, ListChecks, Zap } from 'lucide-react';

interface Product { id: string; name: string }

/** Normalize API payload whether JSON uses snake_case or PascalCase. */
function coerceOverview(raw: unknown): AiSdlcOverviewDto {
  const x = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const n = (snake: string, pascal: string) => {
    const v = x[snake] ?? x[pascal];
    const num = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(num) ? num : 0;
  };
  const phases = (x.phase_distribution ?? x.PhaseDistribution) as unknown;
  const phase_distribution = Array.isArray(phases)
    ? phases.map((p: Record<string, unknown>) => ({
        phase: String(p.phase ?? p.Phase ?? ''),
        count: Number(p.count ?? p.Count ?? 0) || 0,
      }))
    : [];
  const trend = (x.kpi_trend ?? x.KpiTrend) as unknown;
  const kpi_trend = Array.isArray(trend)
    ? trend.map((p: Record<string, unknown>) => ({
        snapshot_date: String(p.snapshot_date ?? p.SnapshotDate ?? ''),
        ai_auto_fix_rate_pct: Number(p.ai_auto_fix_rate_pct ?? p.AiAutoFixRatePct ?? 0) || 0,
      }))
    : [];
  const qc = (x.recent_qa_cycles ?? x.RecentQaCycles) as unknown;
  const recent_qa_cycles = Array.isArray(qc) ? (qc as AiSdlcOverviewDto['recent_qa_cycles']) : [];
  const ar = (x.recent_analyzer_reports ?? x.RecentAnalyzerReports) as unknown;
  const recent_analyzer_reports = Array.isArray(ar) ? (ar as AiSdlcOverviewDto['recent_analyzer_reports']) : [];

  return {
    tracked_products: n('tracked_products', 'TrackedProducts'),
    open_qa_cycles: n('open_qa_cycles', 'OpenQaCycles'),
    completed_analyzer_reports: n('completed_analyzer_reports', 'CompletedAnalyzerReports'),
    pending_qa_issue_reviews: n('pending_qa_issue_reviews', 'PendingQaIssueReviews'),
    phase_distribution,
    kpi_trend,
    recent_qa_cycles,
    recent_analyzer_reports,
  };
}

export default function AiSdlcOverviewPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>('all');
  const [data, setData] = useState<AiSdlcOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProductsForDropdown()
      .then((p) => setProducts(p as Product[]))
      .catch(() => toast.error('Failed to load products'));
  }, []);

  useEffect(() => {
    const pid = productId === 'all' ? undefined : productId;
    setLoading(true);
    aiSdlcOverviewApi
      .get(pid)
      .then((r) => setData(coerceOverview(r)))
      .catch(() => toast.error('Failed to load AI-SDLC overview'))
      .finally(() => setLoading(false));
  }, [productId]);

  const aiOverviewProductOptions = useMemo(
    () => [{ value: 'all', label: 'All products' }, ...products.map((p) => ({ value: p.id, label: p.name }))],
    [products],
  );

  const trendChartData = useMemo(() => {
    if (!data?.kpi_trend?.length) return [];
    return data.kpi_trend.map((p) => {
      const pct = Number(p.ai_auto_fix_rate_pct ?? 0);
      const d = p.snapshot_date ? new Date(p.snapshot_date) : null;
      return {
        label: d && !Number.isNaN(d.getTime())
          ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : '',
        ai_auto_fix_rate_pct: Number((Number.isFinite(pct) ? pct : 0).toFixed(1)),
      };
    });
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex h-full min-w-0 flex-col gap-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground p-6">
        No overview data
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6">
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            AI-SDLC Overview
          </h2>
          <p className="mt-1 text-sm text-muted-foreground truncate">
            Cross-pipeline snapshot: workflow, QA, analyzer, and KPI trend
          </p>
        </div>
        <div className="w-full min-w-0 sm:w-[220px]">
          <SearchableSelect
            triggerClassName="w-full"
            options={aiOverviewProductOptions}
            value={productId}
            onValueChange={setProductId}
            placeholder="Filter by product"
            searchPlaceholder="Search products…"
            contentWidth="wide"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Tracked products', value: data.tracked_products, icon: GitMerge },
          { label: 'Open QA cycles', value: data.open_qa_cycles, icon: FlaskConical },
          { label: 'Analyzer reports (done)', value: data.completed_analyzer_reports, icon: Zap },
          { label: 'QA issues pending review', value: data.pending_qa_issue_reviews, icon: ListChecks },
        ].map((c) => (
          <Card key={c.label} className="p-4 border-l-4 border-l-primary/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</span>
              <c.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums">{c.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <GitMerge className="w-4 h-4" />
            Workflow phase distribution
          </h3>
          <div className="flex flex-wrap gap-2">
            {(data.phase_distribution ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No workflow states yet.</p>
            ) : (
              data.phase_distribution!.map((p) => (
                <Badge key={p.phase} variant="secondary" className="text-xs">
                  {p.phase.replace(/_/g, ' ')} · {p.count}
                </Badge>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 min-h-[220px]">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            AI auto-fix rate trend
          </h3>
          {trendChartData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Not enough KPI snapshots for a trend.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={32} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="ai_auto_fix_rate_pct" name="Auto-fix %" stroke="hsl(var(--primary))" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Recent QA cycles</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(data.recent_qa_cycles ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No cycles.</p>
            ) : (
              data.recent_qa_cycles!.map((c) => (
                <div key={c.id} className="flex justify-between gap-2 border-b border-border/60 pb-2 text-xs">
                  <div>
                    <div className="font-medium">{c.product_name}</div>
                    <div className="text-muted-foreground">v{c.version_label} · #{c.cycle_number}</div>
                  </div>
                  <Badge variant="outline">{c.status}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Recent AI analyzer reports</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(data.recent_analyzer_reports ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No reports.</p>
            ) : (
              data.recent_analyzer_reports!.map((r) => (
                <div key={r.id} className="border-b border-border/60 pb-2 text-xs">
                  <div className="font-medium">{r.report_reference}</div>
                  <div className="text-muted-foreground truncate">
                    {r.product_name}
                    {r.task_title ? ` · ${r.task_title}` : ''}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">{r.status}</Badge>
                    <span className="text-muted-foreground">{fmtDateTime(r.run_triggered_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
