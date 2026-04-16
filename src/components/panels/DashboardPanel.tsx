import { useEffect, useMemo, useState } from 'react';
import { getAnalytics, listDeploymentsPage, listProducts, listDevelopers } from '@/lib/api';
import { listSprints } from '@/lib/api-sprints';
import { StatusBadge, PriorityBar } from '@/components/StatusBadge';
import { fmtDateTime, fmtDate, ENV_CONFIG } from '@/lib/splm-utils';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { SplmEmptyState } from '@/components/layout/SplmEmptyState';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  Package,
  ListTodo,
  Tag,
  Rocket,
  Users,
  Flame,
  BarChart3,
  PieChart,
  Zap,
} from 'lucide-react';

const PIE_COLORS = [
  'hsl(var(--navy))',
  'hsl(var(--teal))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(var(--destructive))',
];

/**
 * Dashboard layout — explicit B2B-style rows (single vertical rhythm via DASHBOARD_STACK_GAP):
 * Row 1: KPI strip — 4 equal columns (xl), shared min-height, label/value/sub + icon hierarchy.
 * Row 2: Activity pair — Recent deployments | Top priority products (1:1 on lg), synced list
 *   viewports (PRIMARY_LIST_VIEWPORT) + overflow-y-auto so short content does not leave huge holes.
 * Row 3: Focus pair — Product focus | Active sprints (lg 6+6 for visual balance); charts use fixed
 *   pixel heights inside cards so Recharts never stretches the page.
 * Row 3b (optional): Task distribution — full-width, reduced pie height when shown with row 3.
 * Row 4: Team workload — full width, WORKLOAD_MAX_HEIGHT + overflow-y; progress uses softer tiers
 *   (primary/amber/destructive) so high load reads as “attention” without screaming red for 70%.
 * Row 5: Summary strip — 3 equal secondary metrics, styled closer to KPI cards for cohesion.
 */
const DASHBOARD_STACK_GAP = 'gap-5';
/** Shared scroll viewport for deployment + priority lists (keeps row 2 heights aligned). */
const PRIMARY_LIST_VIEWPORT = 'h-[min(12.5rem,28vh)]';
const CHART_CARD_HEIGHT = 168;
const WORKLOAD_MAX_HEIGHT = 'min(13rem,26vh)';
/** Horizontal bar chart for product focus — bounded so row 3 stays compact. */
const PRIORITY_CHART_HEIGHT = 200;
/** Unified card chrome across dashboard widgets. */
const DASH_CARD = 'border-border/70 bg-card shadow-sm';

/**
 * Root cause: `GET /analytics/dashboard` returns `top_products` as task/count rows (`product_id`,
 * `product_name`, `open_tasks`, `completion_rate`) — not `name` / `priority_score`. The UI read
 * the wrong keys, so Recharts got empty labels and all-zero lengths. We merge with `listProducts()`
 * for catalog `priority_score`, and derive a bounded "activity" score from open work when unset.
 */
type DashboardMergedProduct = {
  id: string;
  displayName: string;
  priorityScore: number;
  openTasks: number;
  totalTasks: number;
  completionRate: number;
  /** Bar length: DB priority when set, else workload signal from analytics row */
  chartScore: number;
  scoreKind: 'priority' | 'activity';
};

function mergeDashboardTopProducts(stats: any, catalog: any[]): DashboardMergedProduct[] {
  const productById = new Map(catalog.map((p) => [String(p.id), p]));
  const raw: any[] = Array.isArray(stats?.top_products) ? stats.top_products : [];

  const fromApi: DashboardMergedProduct[] = raw.map((row, i) => {
    const id = String(row.product_id ?? row.productId ?? '').trim() || `idx-${i}`;
    const full = productById.get(id);
    const displayName = String(
      row.product_name ?? row.productName ?? full?.name ?? 'Unknown product',
    ).trim();
    const openTasks = Number(row.open_tasks ?? row.openTasks ?? full?.open_task_count ?? 0);
    const totalTasks = Number(row.total_tasks ?? row.totalTasks ?? full?.task_count ?? 0);
    const completionRate = Math.min(100, Math.max(0, Number(row.completion_rate ?? row.completionRate ?? 0)));
    const priorityScore = Math.min(100, Math.max(0, Number(full?.priority_score ?? row.priority_score ?? 0)));
    const activityScore = Math.min(
      100,
      Math.round(openTasks * 6.5 + (100 - completionRate) * 0.35 + Math.min(15, totalTasks * 0.5)),
    );
    const usePriority = priorityScore > 0;
    const chartScore = usePriority
      ? priorityScore
      : activityScore > 0
        ? activityScore
        : openTasks > 0
          ? Math.min(99, 10 + openTasks * 12)
          : 0;

    return {
      id,
      displayName: displayName || 'Unknown product',
      priorityScore,
      openTasks,
      totalTasks,
      completionRate,
      chartScore,
      scoreKind: usePriority ? 'priority' : 'activity',
    };
  });

  if (fromApi.length > 0) return fromApi;

  return catalog
    .map((p) => {
      const id = String(p.id);
      const priorityScore = Math.min(100, Math.max(0, Number(p.priority_score ?? 0)));
      const openTasks = Number(p.open_task_count ?? p.open_tasks ?? 0);
      const totalTasks = Number(p.task_count ?? 0);
      const completionRate =
        totalTasks > 0 ? Math.round(((totalTasks - openTasks) / totalTasks) * 100) : 0;
      const activityScore = Math.min(100, Math.round(openTasks * 6.5 + (100 - completionRate) * 0.35));
      const usePriority = priorityScore > 0;
      const chartScore = usePriority ? priorityScore : activityScore > 0 ? activityScore : openTasks > 0 ? Math.min(99, 10 + openTasks * 12) : 0;
      return {
        id,
        displayName: String(p.name ?? 'Product'),
        priorityScore,
        openTasks,
        totalTasks,
        completionRate,
        chartScore,
        scoreKind: usePriority ? 'priority' : 'activity',
      };
    })
    .sort((a, b) => b.chartScore - a.chartScore || b.priorityScore - a.priorityScore)
    .slice(0, 12);
}

function truncateLabel(s: string, max = 20) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function DashboardPanel() {
  const [stats, setStats] = useState<any>(null);
  const [deploys, setDeploys] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAnalytics(),
      listDeploymentsPage({ page: 1, pageSize: 6 }),
      listProducts(),
      listDevelopers(),
      listSprints(),
    ])
      .then(([s, depPage, p, devs, sp]) => {
        setStats(s);
        setDeploys(depPage.items ?? []);
        setProducts(p);
        setDevelopers(devs);
        setSprints(sp);
      })
      .finally(() => setLoading(false));
  }, []);

  const mergedTopProducts = useMemo(
    () => mergeDashboardTopProducts(stats ?? {}, products),
    [stats, products],
  );

  const priorityChartRows = useMemo(() => {
    return mergedTopProducts
      .filter((m) => m.chartScore > 0 || m.priorityScore > 0 || m.openTasks > 0)
      .sort((a, b) => b.chartScore - a.chartScore)
      .slice(0, 6)
      .map((m) => ({
        key: m.id,
        name: truncateLabel(m.displayName, 22),
        fullName: m.displayName,
        score: Math.max(0, Math.round(m.chartScore)),
        scoreKind: m.scoreKind,
        priorityScore: m.priorityScore,
        openTasks: m.openTasks,
        completionRate: Math.round(m.completionRate),
      }));
  }, [mergedTopProducts]);

  const priorityChartMaxX = useMemo(() => {
    const maxS = priorityChartRows.reduce((acc, r) => Math.max(acc, r.score), 0);
    return Math.min(100, Math.max(8, Math.ceil(maxS * 1.15) || 8));
  }, [priorityChartRows]);

  const avgCatalogPriority = useMemo(() => {
    const scored = products.map((p) => Number(p.priority_score ?? 0)).filter((n) => n > 0);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
  }, [products]);

  if (loading) return <DashboardSkeleton />;

  const s = stats || {};
  const pname = (id: string) => products.find((p) => p.id === id)?.name || id?.slice(0, 8) || '—';

  const tiles: {
    label: string;
    value: number | string;
    sub: string;
    icon: typeof Package;
    accent: string;
  }[] = [
    {
      label: 'Total products',
      value: s.products ?? 0,
      sub: `${s.active_products ?? 0} active`,
      icon: Package,
      accent: 'bg-primary/10 text-primary',
    },
    {
      label: 'Open tasks',
      value: s.open_tasks ?? 0,
      sub: `${s.critical_tasks ?? 0} critical`,
      icon: ListTodo,
      accent: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    },
    {
      label: 'Versions tracked',
      value: s.total_versions ?? 0,
      sub: 'Across all products',
      icon: Tag,
      accent: 'bg-teal-bg text-teal',
    },
    {
      label: 'Deployments today',
      value: s.deploys_today ?? 0,
      sub: `${s.failed_deploys ?? 0} failed`,
      icon: Rocket,
      accent: 'bg-info-bg text-info-foreground',
    },
  ];

  const taskDistribution = [
    { name: 'Backlog', value: s.task_by_status?.backlog || 0 },
    { name: 'Assigned', value: s.task_by_status?.assigned || 0 },
    { name: 'In Progress', value: s.task_by_status?.in_progress || 0 },
    { name: 'Review', value: s.task_by_status?.review || 0 },
    { name: 'Done', value: s.task_by_status?.done || 0 },
  ].filter((d) => d.value > 0);

  const showChartsRow =
    taskDistribution.length > 0 || mergedTopProducts.length > 0 || products.length > 0;

  const TODAY = new Date().toISOString().split('T')[0];
  const activeSprints = sprints
    .filter((sp) => sp.status === 'active' || sp.status === 'planning')
    .slice(0, 4);

  const workloadRows = developers
    .filter((d) => d.active)
    .sort((a, b) => {
      const pctA = (Number(a.current_load_hours) || 0) / (a.capacity_hours_week || 40);
      const pctB = (Number(b.current_load_hours) || 0) / (b.capacity_hours_week || 40);
      return pctB - pctA;
    });

  /** Product focus + sprints share one lg row (6/6) when analytics strip + active sprints both exist. */
  const hasFocusSprintsPair = showChartsRow && activeSprints.length > 0;

  const renderProductFocusCard = (opts?: { fillColumn?: boolean }) => (
    <Card
      className={cn(
        DASH_CARD,
        'flex min-h-0 flex-col overflow-hidden',
        opts?.fillColumn && 'h-full min-h-0',
      )}
    >
      <CardHeader className="shrink-0 space-y-0 pb-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold tracking-tight">Product focus</CardTitle>
              <CardDescription className="mt-1.5 line-clamp-2 text-xs leading-relaxed">
                Catalog <span className="font-medium text-foreground/90">priority</span> when set; otherwise a compact{' '}
                <span className="font-medium text-foreground/90">activity</span> index from open tasks and completion.
              </CardDescription>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {avgCatalogPriority != null && (
              <Badge variant="secondary" className="tabular-nums text-[10px]">
                Avg {avgCatalogPriority}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] font-normal">
              Top {priorityChartRows.length || mergedTopProducts.length || 0}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          'flex flex-col gap-3 px-4 pb-4 pt-0 sm:px-5 sm:pb-5',
          opts?.fillColumn && 'min-h-0 flex-1',
        )}
      >
        {priorityChartRows.length === 0 ? (
          <div className="flex min-h-[9.5rem] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-5 text-center">
            <BarChart3 className="mb-2 h-9 w-9 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium text-foreground">No priority or activity signal yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Set <strong>priority score</strong> on products in the catalog, or add tasks so open work shows up on the
              dashboard feed.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-primary" aria-hidden />
                Priority (catalog)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-sky" aria-hidden />
                Activity (derived)
              </span>
            </div>
            <div
              className="w-full shrink-0 rounded-lg border border-border/60 bg-muted/10 p-1.5"
              style={{ height: PRIORITY_CHART_HEIGHT }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={priorityChartRows}
                  layout="vertical"
                  margin={{ left: 2, right: 12, top: 4, bottom: 4 }}
                  barCategoryGap={8}
                >
                  <XAxis
                    type="number"
                    domain={[0, priorityChartMaxX]}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as (typeof priorityChartRows)[0];
                      return (
                        <div className="max-w-xs rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                          <p className="font-semibold leading-snug">{d.fullName}</p>
                          <p className="mt-1.5 text-muted-foreground">
                            {d.scoreKind === 'priority' ? (
                              <>
                                Priority score:{' '}
                                <span className="font-medium text-foreground">{d.priorityScore}</span> / 100
                              </>
                            ) : (
                              <>
                                Activity index: <span className="font-medium text-foreground">{d.score}</span>
                                <span className="block pt-1">
                                  Open tasks {d.openTasks} · Completion ~{d.completionRate}%
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={16}>
                    {priorityChartRows.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={entry.scoreKind === 'priority' ? 'hsl(var(--primary))' : 'hsl(var(--sky))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  const renderActiveSprintsCard = (stretchColumn?: boolean) => {
    const sprintGridClass = stretchColumn
      ? 'grid auto-rows-fr gap-3 sm:grid-cols-2'
      : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4';
    return (
    <Card
      className={cn(
        DASH_CARD,
        'overflow-hidden',
        stretchColumn && 'flex h-full min-h-0 flex-col',
      )}
    >
      <CardHeader className="shrink-0 space-y-0 pb-3 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/15">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight">Active sprints</CardTitle>
            <CardDescription className="mt-1 text-xs leading-relaxed">
              In progress or planning — task and timeline progress
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          'px-4 pb-4 pt-0 sm:px-5 sm:pb-5',
          stretchColumn && 'flex min-h-0 flex-1 flex-col',
        )}
      >
        <div className={cn('min-h-0 flex-1', sprintGridClass)}>
          {activeSprints.map((sp) => {
            const sprintTasks = sp.tasks || [];
            const done = sprintTasks.filter((t: any) => t.status === 'done').length;
            const total = sprintTasks.length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const start = sp.start_date;
            const end = sp.end_date;
            let datePct = 0;
            if (start && end) {
              const startMs = new Date(start).getTime();
              const endMs = new Date(end).getTime();
              const nowMs = Date.now();
              datePct = Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100)));
            }
            const isOverdue = end && end < TODAY && sp.status !== 'completed';

            return (
              <div
                key={sp.id}
                className={cn(
                  'flex h-full min-h-[8.25rem] flex-col rounded-lg border p-3.5 transition-colors',
                  isOverdue ? 'border-destructive/30 bg-destructive/[0.04]' : 'border-border/60 bg-muted/20',
                )}
              >
                <div className="mb-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{sp.name}</p>
                    {sp.goal ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{sp.goal}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={sp.status || 'planning'} className="shrink-0" />
                </div>

                <div className="mt-auto space-y-2.5">
                  {total > 0 && (
                    <div>
                      <div className="mb-1 flex justify-between text-[10px] font-medium text-muted-foreground">
                        <span>
                          Tasks {done}/{total}
                        </span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                        <div
                          className="h-full rounded-full bg-emerald-600/85 dark:bg-emerald-500/80"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {start && end && (
                    <div>
                      <div className="mb-1 flex justify-between text-[10px] font-medium text-muted-foreground">
                        <span className="tabular-nums">{fmtDate(start)}</span>
                        <span className={cn('tabular-nums', isOverdue ? 'font-semibold text-destructive' : '')}>
                          {fmtDate(end)}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted/80">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            isOverdue ? 'bg-destructive/75' : 'bg-primary/40',
                          )}
                          style={{ width: `${datePct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
    );
  };

  return (
    <div className={cn('animate-fade-in flex flex-col', DASHBOARD_STACK_GAP)}>
      <SplmPageHeader
        className="mb-0 sm:mb-1"
        title="Dashboard"
        subtitle="At-a-glance health across products, delivery, people, and risk — tuned for a quick daily scan."
      />

      {/* Row 1 — KPI strip: four equal metrics, shared min-height band */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {tiles.map((t) => (
            <Card
              key={t.label}
              className={cn(
                DASH_CARD,
                'flex min-h-[5.75rem] flex-col overflow-hidden transition-shadow duration-200 hover:shadow-md',
              )}
            >
              <CardContent className="flex flex-1 flex-col justify-center p-4 sm:min-h-[6rem] sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</p>
                    <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-[1.65rem]">
                      {t.value ?? 0}
                    </p>
                    <p className="text-[11px] leading-snug text-muted-foreground">{t.sub}</p>
                  </div>
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
                      t.accent,
                    )}
                  >
                    <t.icon className="h-5 w-5" strokeWidth={1.65} aria-hidden />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Row 2 — deployments | priority lists: 1:1 lg, matched list viewports + scrollbar-gutter-stable feel */}
      <section
        className={cn('grid grid-cols-1 lg:grid-cols-2 lg:items-stretch', 'gap-4 lg:gap-5')}
        aria-label="Activity"
      >
        <Card className={cn(DASH_CARD, 'flex min-h-0 flex-col overflow-hidden')}>
          <CardHeader className="shrink-0 space-y-0 pb-2 pt-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Rocket className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold tracking-tight">Recent deployments</CardTitle>
                <CardDescription className="mt-0.5 text-xs">Latest pipeline activity across products</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0 sm:px-5 sm:pb-4">
            <div
              className={cn(
                'min-h-0 overflow-y-auto overscroll-contain rounded-md border border-border/50 bg-muted/15 [scrollbar-gutter:stable]',
                PRIMARY_LIST_VIEWPORT,
              )}
            >
              {deploys.length === 0 ? (
                <div className="p-3">
                  <SplmEmptyState
                    icon={Rocket}
                    title="No deployments yet"
                    description="When deployments run, they will appear here with environment and version."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {deploys.map((d) => {
                    const ec = ENV_CONFIG[d.environment as keyof typeof ENV_CONFIG];
                    return (
                      <li key={d.id}>
                        <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-tight text-foreground">
                              {pname(d.product_id)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                {ec?.icon} {d.environment}
                              </span>
                              <span className="mx-1 text-border">·</span>
                              <code className="rounded bg-background/80 px-1 py-px font-mono text-[10px]">v{d.version}</code>
                              <span className="mx-1 text-border">·</span>
                              {fmtDateTime(d.created_at)}
                            </p>
                          </div>
                          <StatusBadge status={d.status || ''} className="w-fit shrink-0 self-start sm:self-center" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(DASH_CARD, 'flex min-h-0 flex-col overflow-hidden')}>
          <CardHeader className="shrink-0 space-y-0 pb-2 pt-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Flame className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold tracking-tight">Top priority products</CardTitle>
                <CardDescription className="mt-0.5 text-xs">Catalog priority or derived activity signal</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0 sm:px-5 sm:pb-4">
            <div
              className={cn(
                'min-h-0 overflow-y-auto overscroll-contain rounded-md border border-border/50 bg-muted/15 [scrollbar-gutter:stable]',
                PRIMARY_LIST_VIEWPORT,
              )}
            >
              {mergedTopProducts.length === 0 ? (
                <div className="p-3">
                  <SplmEmptyState
                    icon={Package}
                    title="No products yet"
                    description="Add products to see how they rank by priority."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {mergedTopProducts.map((row) => {
                    const full = products.find((p) => String(p.id) === row.id);
                    const barScore =
                      row.priorityScore > 0 ? row.priorityScore : Math.min(100, Math.round(row.chartScore));
                    return (
                      <li key={row.id}>
                        <div className="grid grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_6.5rem] sm:gap-3 sm:py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-tight text-foreground">{row.displayName}</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                              {full?.current_version ? `v${full.current_version}` : '—'}
                              <span className="mx-1">·</span>
                              {full?.customer_count ?? '—'} cust.
                              <span className="mx-1">·</span>
                              {row.openTasks} open
                            </p>
                          </div>
                          <div className="flex justify-start sm:justify-end">
                            <PriorityBar score={barScore} width={72} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Row 3 — product focus | active sprints: lg 6+6 so both read as primary peers */}
      {hasFocusSprintsPair && (
        <section
          className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch lg:gap-5"
          aria-label="Product focus and active sprints"
        >
          <div className="flex min-h-0 min-w-0 lg:col-span-6">{renderProductFocusCard({ fillColumn: true })}</div>
          <div className="flex min-h-0 min-w-0 lg:col-span-6">{renderActiveSprintsCard(true)}</div>
        </section>
      )}

      {hasFocusSprintsPair && taskDistribution.length > 0 && (
        <section className="w-full" aria-label="Task distribution">
          <Card className={cn(DASH_CARD, 'flex min-h-0 flex-col overflow-hidden')}>
            <CardHeader className="shrink-0 space-y-0 pb-2 pt-4">
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <PieChart className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base font-semibold tracking-tight">Task distribution</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">Open work by workflow state</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
              <div className="w-full shrink-0" style={{ height: CHART_CARD_HEIGHT }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={taskDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={72}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                      labelLine={false}
                    >
                      {taskDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {!hasFocusSprintsPair && showChartsRow && (
        <section
          className={cn(
            'grid w-full gap-4 md:gap-5',
            priorityChartRows.length > 0 && taskDistribution.length > 0
              ? 'grid-cols-1 md:grid-cols-2'
              : priorityChartRows.length > 0
                ? 'grid-cols-1 lg:max-w-3xl'
                : 'grid-cols-1 md:max-w-xl',
          )}
          aria-label="Charts"
        >
          {renderProductFocusCard()}
          {taskDistribution.length > 0 && (
            <Card className={cn(DASH_CARD, 'flex min-h-0 flex-col overflow-hidden')}>
              <CardHeader className="shrink-0 space-y-0 pb-2 pt-4">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <PieChart className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold tracking-tight">Task distribution</CardTitle>
                    <CardDescription className="mt-0.5 text-xs">Open work by workflow state</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                <div className="w-full shrink-0" style={{ height: CHART_CARD_HEIGHT }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={taskDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={72}
                        dataKey="value"
                        label={({ name, value }) => `${name} (${value})`}
                        labelLine={false}
                      >
                        {taskDistribution.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {activeSprints.length > 0 && !hasFocusSprintsPair && (
        <section aria-label="Active sprints">{renderActiveSprintsCard(false)}</section>
      )}

      {/* Row 4 — team workload: height-capped + internal scroll; softer bar ramp (primary → amber → destructive). */}
      {workloadRows.length > 0 && (
        <section aria-label="Team workload">
          <Card className={cn(DASH_CARD, 'overflow-hidden')}>
            <CardHeader className="shrink-0 space-y-0 pb-2 pt-4">
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base font-semibold tracking-tight">Team workload</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Hours booked vs weekly capacity — scroll when the roster is long
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 sm:px-5 sm:pb-4">
              <div
                className="overflow-y-auto overscroll-contain rounded-md border border-border/50 bg-muted/10 pr-0.5 [scrollbar-gutter:stable]"
                style={{ maxHeight: WORKLOAD_MAX_HEIGHT }}
              >
                <ul className="divide-y divide-border/40">
                  {workloadRows.map((d) => {
                    const load = Number(d.current_load_hours) || 0;
                    const cap = d.capacity_hours_week || 40;
                    const pct = Math.min(100, Math.round((load / cap) * 100));
                    const barColor =
                      pct >= 95
                        ? 'bg-destructive/75'
                        : pct >= 85
                          ? 'bg-destructive/45'
                          : pct >= 70
                            ? 'bg-amber-500/45 dark:bg-amber-400/35'
                            : 'bg-primary/35 dark:bg-primary/30';
                    const textColor =
                      pct >= 95
                        ? 'text-destructive'
                        : pct >= 85
                          ? 'text-destructive/90'
                          : pct >= 70
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-muted-foreground';
                    return (
                      <li key={d.id}>
                        <div className="grid grid-cols-1 items-center gap-1.5 px-2.5 py-1.5 sm:grid-cols-[minmax(0,7.5rem)_1fr_auto] sm:gap-3 sm:px-3 sm:py-1.5">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold leading-tight text-foreground">{d.name}</p>
                            <p className="truncate text-[10px] capitalize text-muted-foreground">
                              {d.role} · {d.office_location}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted/90">
                              <div
                                className={cn('h-full rounded-full transition-all', barColor)}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-[11px] font-medium tabular-nums sm:min-w-[4.5rem]">
                            <span className={textColor}>
                              {load}h/{cap}h
                            </span>
                            <span className="ml-1 font-normal text-muted-foreground">({pct}%)</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Row 5 — secondary KPI strip: same grid rhythm as row 1, lighter visual weight than hero KPIs */}
      <section aria-label="Summary metrics">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            {
              label: 'Avg priority score',
              value: Math.round(s.avg_priority || 0),
              suffix: '/100',
              icon: BarChart3,
              tint: 'bg-primary/8 text-primary ring-1 ring-primary/10',
            },
            {
              label: 'Overdue tasks',
              value: s.overdue_tasks || 0,
              suffix: 'tasks',
              icon: ListTodo,
              tint: 'bg-destructive/8 text-destructive ring-1 ring-destructive/10',
            },
            {
              label: 'Developers active',
              value: s.developers || 0,
              suffix: 'engineers',
              icon: Users,
              tint: 'bg-teal-bg text-teal ring-1 ring-teal/15',
            },
          ].map(({ label, value, suffix, icon: MetricIcon, tint }) => (
            <Card
              key={label}
              className={cn(
                DASH_CARD,
                'flex min-h-[5.25rem] flex-col overflow-hidden transition-shadow hover:shadow-md',
              )}
            >
              <CardContent className="flex flex-1 flex-col justify-center p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tint)}>
                    <MetricIcon className="h-4 w-4" strokeWidth={1.7} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">
                      {value}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">{suffix}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
