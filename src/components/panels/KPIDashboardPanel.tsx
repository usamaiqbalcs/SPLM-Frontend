import { useEffect, useState } from 'react';
import { kpiApi, KpiDashboardSummaryDto, KpiSnapshotDto } from '@/lib/api-aisdlc';
import { listProducts } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    listProducts()
      .then(setProducts)
      .catch(() => toast.error('Failed to load products'));
  }, []);

  useEffect(() => {
    const fetchKPIData = async () => {
      try {
        setLoading(true);
        const pid = selectedProductId === 'all' ? undefined : selectedProductId;
        // ← was kpiApi.getSummary / kpiApi.listSnapshots (didn't exist)
        const [summaryData, snapshotsData] = await Promise.all([
          kpiApi.getDashboard(pid),
          kpiApi.getSnapshots(pid),
        ]);
        setSummary(summaryData);
        setSnapshots(snapshotsData);
      } catch (error) {
        toast.error('Failed to load KPI data');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchKPIData();
  }, [selectedProductId]);

  if (loading && !summary) {
    return (
      <div className="h-full flex flex-col p-6 gap-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64 mt-2" /></div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
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
  ];

  return (
    <div className="h-full flex flex-col p-6 gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-background z-10 pb-4 border-b">
        <div>
          <h2 className="text-2xl font-bold">KPI Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedProductId === 'all'
              ? 'All Products'
              : products.find((p) => p.id === selectedProductId)?.name}
          </p>
        </div>
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Product Breakdown — product_breakdown items are KpiSnapshotDto */}
      {summary.product_breakdown && summary.product_breakdown.length > 0 && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <h3 className="text-lg font-semibold mb-3">Product Breakdown</h3>
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
                {summary.product_breakdown.map((snap, idx) => (
                  <TableRow key={idx}>
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
          <h3 className="text-lg font-semibold mb-3">Recent Snapshots</h3>
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
                {snapshots.map((snap, idx) => (
                  <TableRow key={idx}>
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
