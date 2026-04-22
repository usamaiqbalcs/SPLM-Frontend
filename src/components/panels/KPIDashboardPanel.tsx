import { useEffect, useMemo, useState } from 'react';
import { kpiApi, KpiDashboardSummaryDto, KpiSnapshotDto } from '@/lib/api-aisdlc';
import { listProducts } from '@/lib/api';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const KPI_TABLE_PAGE_SIZE = 10;

interface Product { id: string; name: string }

interface KpiMetric {
  label: string;
  value: string;
  unit: string;
  target: string;
  status: 'good' | 'warning' | 'poor';
}

const getMetricStatus = (metric: string, value: number): 'good' | 'warning' | 'poor' => {
  switch (metric) {
    case 'auto_fix_rate':   return value >= 90 ? 'good' : value >= 75 ? 'warning' : 'poor';
    case 'override_rate':   return value <= 10 ? 'good' : value <= 20 ? 'warning' : 'poor';
    case 'regression_rate': return value <= 5  ? 'good' : value <= 10 ? 'warning' : 'poor';
    case 'acceptance_rate': return value >= 85 ? 'good' : value >= 70 ? 'warning' : 'poor';
    default: return 'good';
  }
};

const getStatusColor = (status: 'good' | 'warning' | 'poor') => {
  switch (status) {
    case 'good':    return 'bg-green-100 text-green-800';
    case 'warning': return 'bg-yellow-100 text-yellow-800';
    case 'poor':    return 'bg-red-100 text-red-800';
  }
};

const getStatusIcon = (status: 'good' | 'warning' | 'poor') => {
  if (status === 'good') return <TrendingUp className="w-4 h-4" />;
  if (status === 'poor') return <TrendingDown className="w-4 h-4" />;
  return null;
};

export default function KPIDashboardPanel() {   // ← was: export function (named), 'use client' removed
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [summary, setSummary] = useState<KpiDashboardSummaryDto | null>(null);
  const [snapshots, setSnapshots] = useState<KpiSnapshotDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdownPage, setBreakdownPage] = useState(1);
  const [snapshotsPage, setSnapshotsPage] = useState(1);

  useEffect(() => {
    listProducts()
      .then(setProducts)
      .catch(() => toast.error('Failed to load products'));
  }, []);

  useEffect(() => {
    // Reset all state before re-fetching so the skeleton shows for the new product
    // and stale data from a previously selected product is never visible.
    setBreakdownPage(1);
    setSnapshotsPage(1);
    setSummary(null);
    setSnapshots([]);
    setLoading(true);

    const fetchKPIData = async () => {
      try {
        const pid = selectedProductId === 'all' ? undefined : selectedProductId;
        const [summaryData, snapshotsData] = await Promise.all([
          kpiApi.getDashboard(pid),
          kpiApi.getSnapshots(pid),
        ]);
        setSummary(summaryData);
        setSnapshots(snapshotsData);
      } catch (error) {
        toast.error('Failed to load KPI data');
        console.error(error);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };
    fetchKPIData();
  }, [selectedProductId]);

  const productBreakdown = summary?.product_breakdown ?? [];
  const breakdownTotalPages = Math.max(1, Math.ceil(productBreakdown.length / KPI_TABLE_PAGE_SIZE));
  const pagedBreakdown = useMemo(() => {
    const start = (breakdownPage - 1) * KPI_TABLE_PAGE_SIZE;
    return productBreakdown.slice(start, start + KPI_TABLE_PAGE_SIZE);
  }, [productBreakdown, breakdownPage]);

  const snapshotsTotalPages = Math.max(1, Math.ceil(snapshots.length / KPI_TABLE_PAGE_SIZE));
  const pagedSnapshots = useMemo(() => {
    const start = (snapshotsPage - 1) * KPI_TABLE_PAGE_SIZE;
    return snapshots.slice(start, start + KPI_TABLE_PAGE_SIZE);
  }, [snapshots, snapshotsPage]);

  const trendChartData = useMemo(() => {
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
    );
    return sorted.slice(-24).map((s) => ({
      label: new Date(s.snapshot_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ai_auto_fix: Number(s.ai_auto_fix_rate_pct.toFixed(1)),
      acceptance: Number(s.acceptance_pass_rate_pct.toFixed(1)),
    }));
  }, [snapshots]);

  useEffect(() => {
    setBreakdownPage((p) => Math.min(Math.max(1, p), breakdownTotalPages));
  }, [breakdownTotalPages]);

  useEffect(() => {
    setSnapshotsPage((p) => Math.min(Math.max(1, p), snapshotsTotalPages));
  }, [snapshotsTotalPages]);

  const kpiProductFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All Products' }, ...products.map((p) => ({ value: p.id, label: p.name }))],
    [products],
  );

  if (loading && !summary) {
    return (
      <div className="flex h-full min-w-0 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-10 w-full max-w-[200px] sm:w-40" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No KPI data available</p>
      </div>
    );
  }

  const pmOnTime = summary.pm_on_time_rate_pct ?? 0;
  const avgIssues = summary.avg_total_issues_per_snapshot ?? 0;

  // ── All field names corrected to match KpiDashboardSummaryDto ───────────────
  const metrics: KpiMetric[] = [
    {
      label: 'AI Auto-Fix Rate',
      value: summary.avg_ai_auto_fix_rate_pct.toFixed(1),       // ← was ai_auto_fix_rate
      unit: '%', target: '≥90%',
      status: getMetricStatus('auto_fix_rate', summary.avg_ai_auto_fix_rate_pct),
    },
    {
      label: 'QA Cycle Duration',
      value: summary.avg_qa_cycle_duration_days.toFixed(1),     // ← was qa_cycle_duration_days
      unit: 'days', target: 'avg', status: 'good',
    },
    {
      label: 'Acceptance Pass Rate',
      value: summary.avg_acceptance_pass_rate_pct.toFixed(1),   // ← was acceptance_pass_rate
      unit: '%', target: '≥85%',
      status: getMetricStatus('acceptance_rate', summary.avg_acceptance_pass_rate_pct),
    },
    {
      label: 'Regression Rate',
      value: summary.avg_regression_rate_pct.toFixed(1),        // ← was regression_rate
      unit: '%', target: '≤5%',
      status: getMetricStatus('regression_rate', summary.avg_regression_rate_pct),
    },
    {
      label: 'Developer Override Rate',
      value: summary.avg_developer_override_rate_pct.toFixed(1), // ← was developer_override_rate
      unit: '%', target: '≤10%',
      status: getMetricStatus('override_rate', summary.avg_developer_override_rate_pct),
    },
    {
      label: 'Production Incidents',
      value: summary.total_production_incidents.toString(),      // ← was production_incidents
      unit: '', target: 'count',
      status: summary.total_production_incidents > 5 ? 'poor'
            : summary.total_production_incidents > 2 ? 'warning'
            : 'good',
    },
    {
      label: 'PM On-Time Delivery',
      value: pmOnTime.toFixed(1),
      unit: '%', target: 'share on-time',
      status: pmOnTime >= 85 ? 'good' : pmOnTime >= 70 ? 'warning' : 'poor',
    },
    {
      label: 'Avg QA Issues / Snapshot',
      value: avgIssues.toFixed(1),
      unit: '', target: 'volume',
      status: avgIssues <= 20 ? 'good' : avgIssues <= 40 ? 'warning' : 'poor',
    },
  ];

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6">
      {/* Header */}
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">KPI Dashboard</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {selectedProductId === 'all'
              ? 'All Products'
              : products.find((p) => p.id === selectedProductId)?.name}
          </p>
        </div>
        <div className="w-full min-w-0 sm:w-[200px]">
          <SearchableSelect
            triggerClassName="w-full"
            options={kpiProductFilterOptions}
            value={selectedProductId}
            onValueChange={setSelectedProductId}
            placeholder="All Products"
            searchPlaceholder="Search products…"
            contentWidth="wide"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => (
          <Card key={idx} className={`p-6 border-l-4 ${
            metric.status === 'good' ? 'border-l-green-500'
            : metric.status === 'warning' ? 'border-l-yellow-500'
            : 'border-l-red-500'
          }`}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{metric.label}</h3>
              <Badge className={getStatusColor(metric.status)}>{getStatusIcon(metric.status)}</Badge>
            </div>
            <div className="mb-3">
              <span className="text-3xl font-bold">
                {metric.value}<span className="text-lg ml-1">{metric.unit}</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Target: {metric.target}</p>
          </Card>
        ))}
      </div>

      {trendChartData.length > 0 && (
        <Card className="p-4 border">
          <h3 className="text-sm font-semibold mb-3">Historical trend (snapshots)</h3>
          <div className="h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={36} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="ai_auto_fix" name="AI auto-fix %" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="acceptance" name="Acceptance %" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Product Breakdown — product_breakdown items are KpiSnapshotDto */}
      {productBreakdown.length > 0 && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-lg font-semibold">Product Breakdown</h3>
            {breakdownTotalPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Button type="button" variant="outline" size="sm" disabled={breakdownPage <= 1}
                  onClick={() => setBreakdownPage((p) => Math.max(1, p - 1))}>Prev</Button>
                <span className="tabular-nums">{breakdownPage}/{breakdownTotalPages}</span>
                <Button type="button" variant="outline" size="sm" disabled={breakdownPage >= breakdownTotalPages}
                  onClick={() => setBreakdownPage((p) => p + 1)}>Next</Button>
              </div>
            )}
          </div>
          <div className="border rounded-lg overflow-hidden flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Auto-Fix Rate</TableHead>
                  <TableHead className="text-right">Cycle Duration</TableHead>
                  <TableHead className="text-right">Acceptance Rate</TableHead>
                  <TableHead className="text-right">Regression Rate</TableHead>
                  <TableHead className="text-right">Override Rate</TableHead>
                  <TableHead className="text-right">Incidents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedBreakdown.map((snap, idx) => (
                  <TableRow key={`${snap.product_id ?? snap.product_name ?? idx}-${idx}`}>
                    <TableCell className="font-medium">{snap.product_name ?? snap.product_id}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={getStatusColor(getMetricStatus('auto_fix_rate', snap.ai_auto_fix_rate_pct))}>
                        {snap.ai_auto_fix_rate_pct.toFixed(1)}%          {/* ← was auto_fix_rate */}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {snap.qa_cycle_duration_days.toFixed(1)} days        {/* ← was cycle_duration_days */}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getStatusColor(getMetricStatus('acceptance_rate', snap.acceptance_pass_rate_pct))}>
                        {snap.acceptance_pass_rate_pct.toFixed(1)}%       {/* ← was acceptance_rate */}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getStatusColor(getMetricStatus('regression_rate', snap.regression_rate_pct))}>
                        {snap.regression_rate_pct.toFixed(1)}%            {/* ← was regression_rate */}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getStatusColor(getMetricStatus('override_rate', snap.developer_override_rate_pct))}>
                        {snap.developer_override_rate_pct.toFixed(1)}%   {/* ← was override_rate */}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={
                        snap.production_incident_count > 5 ? 'bg-red-100 text-red-800'    // ← was incidents
                        : snap.production_incident_count > 2 ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                      }>
                        {snap.production_incident_count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Recent Snapshots */}
      {snapshots.length > 0 && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-lg font-semibold">Recent Snapshots</h3>
            {snapshotsTotalPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Button type="button" variant="outline" size="sm" disabled={snapshotsPage <= 1}
                  onClick={() => setSnapshotsPage((p) => Math.max(1, p - 1))}>Prev</Button>
                <span className="tabular-nums">{snapshotsPage}/{snapshotsTotalPages}</span>
                <Button type="button" variant="outline" size="sm" disabled={snapshotsPage >= snapshotsTotalPages}
                  onClick={() => setSnapshotsPage((p) => p + 1)}>Next</Button>
              </div>
            )}
          </div>
          <div className="border rounded-lg overflow-hidden flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Auto-Fix Rate</TableHead>
                  <TableHead className="text-right">Acceptance Rate</TableHead>
                  <TableHead className="text-right">Regression Rate</TableHead>
                  <TableHead className="text-right">Override Rate</TableHead>
                  <TableHead className="text-right">Incidents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedSnapshots.map((snap, idx) => (
                  <TableRow key={snap.id ?? `${snap.snapshot_date}-${idx}`}>
                    <TableCell className="text-sm">
                      {new Date(snap.snapshot_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{snap.product_name}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={getStatusColor(getMetricStatus('auto_fix_rate', snap.ai_auto_fix_rate_pct))}>
                        {snap.ai_auto_fix_rate_pct.toFixed(1)}%           {/* ← was auto_fix_rate */}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getStatusColor(getMetricStatus('acceptance_rate', snap.acceptance_pass_rate_pct))}>
                        {snap.acceptance_pass_rate_pct.toFixed(1)}%      {/* ← was acceptance_rate */}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getStatusColor(getMetricStatus('regression_rate', snap.regression_rate_pct))}>
                        {snap.regression_rate_pct.toFixed(1)}%           {/* ← was regression_rate */}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getStatusColor(getMetricStatus('override_rate', snap.developer_override_rate_pct))}>
                        {snap.developer_override_rate_pct.toFixed(1)}%  {/* ← was override_rate */}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={
                        snap.production_incident_count > 5 ? 'bg-red-100 text-red-800'   // ← was production_incidents
                        : snap.production_incident_count > 2 ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                      }>
                        {snap.production_incident_count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {snapshots.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>No snapshot data available</p>
        </div>
      )}
    </div>
  );
}
