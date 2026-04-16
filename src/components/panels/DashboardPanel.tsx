import { useEffect, useMemo, useState } from 'react';
import { getAnalytics, listDeploymentsPage, listProducts, listDevelopers } from '@/lib/api';
import { listSprints } from '@/lib/api-sprints';
import { StatusBadge, PriorityBar } from '@/components/StatusBadge';
import { fmtDateTime, fmtDate, ENV_CONFIG } from '@/lib/splm-utils';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { SplmEmptyState } from '@/components/layout/SplmEmptyState';
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
  Activity,
} from 'lucide-react';

const PIE_COLORS = [
  'hsl(var(--navy))',
  'hsl(var(--teal))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(var(--destructive))',
];

/**
 * Dashboard shell layout (see JSX regions below):
 * - Full-width app main is fine; problems came from unconstrained flex children + unbounded lists,
 *   which stretched cards and let Team workload grow without bound. We use explicit grids per row,
 *   paired fixed-height scroll areas for primary columns, fixed chart viewport heights, and
 *   max-height + overflow-auto on workload so one widget cannot dominate the viewport.
 */
const PRIMARY_LIST_VIEWPORT = 'h-[min(17.5rem,38vh)]';
const CHART_CARD_HEIGHT = 220;
const WORKLOAD_MAX_HEIGHT = 'min(16rem,34vh)';
/** Chart viewport for priority widget (slightly taller than pie sibling for Y-axis labels). */
const PRIORITY_CHART_HEIGHT = 248;

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

  /** Product focus + sprints share one lg row (5/12 vs 7/12); requires charts strip + at least one sprint. */
  const hasFocusSprintsPair = showChartsRow && activeSprints.length > 0;

  const renderProductFocusCard = (opts?: { fillColumn?: boolean }) => (
    <Card
      className={cn(
        'flex min-h-0 flex-col overflow-hidden border-border/80 bg-card shadow-splm',
        opts?.fillColumn && 'h-full min-h-0',
      )}
    >
      <CardHeader className="shrink-0 space-y-2 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div>
              <CardTitle>Product focus</CardTitle>
              <CardDescription className="mt-1 max-w-prose">
                Top products by <span className="font-medium text-foreground">catalog priority</span> when set,
                otherwise by a compact <span className="font-medium text-foreground">activity</span> index from open
                tasks and completion on the analytics feed.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {avgCatalogPriority != null && (
              <Badge variant="secondary" className="tabular-nums">
                Avg priority {avgCatalogPriority}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] font-normal">
              Top {priorityChartRows.length || mergedTopProducts.length || 0} shown
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
          <div className="flex min-h-[11rem] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center sm:min-h-[12rem]">
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
              className="w-full shrink-0 rounded-lg border border-border/60 bg-muted/10 p-1"
              style={{ height: PRIORITY_CHART_HEIGHT }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={priorityChartRows}
                  layout="vertical"
                  margin={{ left: 4, right: 24, top: 6, bottom: 6 }}
                  barCategoryGap={10}
                >
                  <XAxis
                    type="number"
                    domain={[0, priorityChartMaxX]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
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
                  <Bar dataKey="score" radius={[0, 5, 5, 0]} maxBarSize={20}>
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

  const renderActiveSprintsCard = (sprintGridClass: string, stretchColumn?: boolean) => (
    <Card
      className={cn(
        'overflow-hidden border-border/80 bg-card shadow-splm',
        stretchColumn && 'flex h-full min-h-0 flex-col',
      )}
    >
      <CardHeader className="shrink-0 space-y-1 pb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" aria-hidden />
          <CardTitle>Active sprints</CardTitle>
        </div>
        <CardDescription>In progress or planning — task and timeline progress</CardDescription>
      </CardHeader>
      <CardContent
        className={cn(
          'px-4 pb-4 pt-0 sm:px-5 sm:pb-5',
          stretchColumn && 'flex min-h-0 flex-1 flex-col',
        )}
      >
        <div className={cn('grid gap-3', sprintGridClass)}>
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
                  'flex min-h-[9rem] flex-col rounded-xl border p-3 transition-colors sm:min-h-[9.5rem] sm:p-3.5',
                  isOverdue ? 'border-destructive/35 bg-destructive/[0.06]' : 'border-border/80 bg-muted/15',
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{sp.name}</p>
                    {sp.goal ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{sp.goal}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={sp.status || 'planning'} className="shrink-0 scale-90" />
                </div>

                <div className="mt-auto space-y-2">
                  {total > 0 && (
                    <div>
                      <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                        <span>
                          Tasks {done}/{total}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-success transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {start && end && (
                    <div>
                      <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                        <span>{fmtDate(start)}</span>
                        <span className={isOverdue ? 'font-semibold text-destructive' : ''}>{fmtDate(end)}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', isOverdue ? 'bg-destructive' : 'bg-primary/45')}
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

  return (
    <div className="animate-fade-in space-y-6">
      {/* statsRow: equal-height KPI tiles; grid stretches row so cards share one band height */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
          {tiles.map((t) => (
            <Card
              key={t.label}
              className="flex min-h-[7.5rem] flex-col overflow-hidden transition-shadow duration-200 hover:shadow-splm-md"
            >
              <CardContent className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</p>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                      {t.value ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.sub}</p>
                  </div>
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl',
                      t.accent,
                    )}
                  >
                    <t.icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* primaryGrid: two columns share one row height; list bodies scroll inside a fixed viewport */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch" aria-label="Activity">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0 space-y-1 pb-2">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardTitle>Recent deployments</CardTitle>
            </div>
            <CardDescription>Latest pipeline activity across products</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
            <div
              className={cn(
                'min-h-0 overflow-y-auto overscroll-contain rounded-lg border border-border/50 bg-muted/20',
                PRIMARY_LIST_VIEWPORT,
              )}
            >
              {deploys.length === 0 ? (
                <div className="p-4">
                  <SplmEmptyState
                    icon={Rocket}
                    title="No deployments yet"
                    description="When deployments run, they will appear here with environment and version."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {deploys.map((d) => {
                    const ec = ENV_CONFIG[d.environment as keyof typeof ENV_CONFIG];
                    return (
                      <li key={d.id}>
                        <div className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{pname(d.product_id)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                {ec?.icon} {d.environment}
                              </span>
                              <span className="mx-1 text-border">·</span>
                              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">v{d.version}</code>
                              <span className="mx-1 text-border">·</span>
                              {fmtDateTime(d.created_at)}
                            </p>
                          </div>
                          <StatusBadge status={d.status || ''} className="shrink-0 self-start sm:self-center" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0 space-y-1 pb-2">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardTitle>Top priority products</CardTitle>
            </div>
            <CardDescription>Ranked by composite priority score</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
            <div
              className={cn(
                'min-h-0 overflow-y-auto overscroll-contain rounded-lg border border-border/50 bg-muted/20',
                PRIMARY_LIST_VIEWPORT,
              )}
            >
              {mergedTopProducts.length === 0 ? (
                <div className="p-4">
                  <SplmEmptyState
                    icon={Package}
                    title="No products yet"
                    description="Add products to see how they rank by priority."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {mergedTopProducts.map((row) => {
                    const full = products.find((p) => String(p.id) === row.id);
                    const barScore =
                      row.priorityScore > 0 ? row.priorityScore : Math.min(100, Math.round(row.chartScore));
                    return (
                      <li key={row.id}>
                        <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{row.displayName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {full?.current_version ? `v${full.current_version}` : '—'}
                              <span className="mx-1">·</span>
                              {full?.customer_count ?? '—'} customers
                              <span className="mx-1">·</span>
                              {row.openTasks} open tasks
                            </p>
                          </div>
                          <PriorityBar score={barScore} />
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

      {/* focusAndSprintsRow: lg side-by-side — Product focus 5/12, Active sprints 7/12 (stacks <lg). Pie moves to next row when paired. */}
      {hasFocusSprintsPair && (
        <section
          className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch"
          aria-label="Product focus and active sprints"
        >
          <div className="flex min-h-0 min-w-0 lg:col-span-5">{renderProductFocusCard({ fillColumn: true })}</div>
          <div className="flex min-h-0 min-w-0 lg:col-span-7">
            {renderActiveSprintsCard('grid-cols-1 sm:grid-cols-2', true)}
          </div>
        </section>
      )}

      {hasFocusSprintsPair && taskDistribution.length > 0 && (
        <section className="w-full" aria-label="Task distribution">
          <Card className="flex min-h-0 flex-col overflow-hidden border-border/80 bg-card shadow-splm">
            <CardHeader className="shrink-0 space-y-1 pb-2">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-muted-foreground" aria-hidden />
                <CardTitle>Task distribution</CardTitle>
              </div>
              <CardDescription>Open work by workflow state</CardDescription>
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
            'grid w-full gap-6',
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
            <Card className="flex min-h-0 flex-col overflow-hidden border-border/80 bg-card shadow-splm">
              <CardHeader className="shrink-0 space-y-1 pb-2">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <CardTitle>Task distribution</CardTitle>
                </div>
                <CardDescription>Open work by workflow state</CardDescription>
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
        <section aria-label="Active sprints">
          {renderActiveSprintsCard('grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', false)}
        </section>
      )}

      {/* Team workload: cap vertical growth; scroll inside card (see module comment). */}
      {workloadRows.length > 0 && (
        <section aria-label="Team workload">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-1 pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                <CardTitle>Team workload</CardTitle>
              </div>
              <CardDescription>Active developers by hours vs weekly capacity — scroll if needed</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
              <div
                className="overflow-y-auto overscroll-contain rounded-lg border border-border/50 bg-muted/15 pr-1"
                style={{ maxHeight: WORKLOAD_MAX_HEIGHT }}
              >
                <ul className="divide-y divide-border/50">
                  {workloadRows.map((d) => {
                    const load = Number(d.current_load_hours) || 0;
                    const cap = d.capacity_hours_week || 40;
                    const pct = Math.min(100, Math.round((load / cap) * 100));
                    const barColor = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-success';
                    const textColor = pct >= 90 ? 'text-destructive' : pct >= 70 ? 'text-warning' : 'text-success';
                    return (
                      <li key={d.id}>
                        <div className="flex flex-col gap-1.5 px-2.5 py-2 sm:flex-row sm:items-center sm:gap-3 sm:py-1.5">
                          <div className="w-full min-w-0 sm:w-36">
                            <p className="truncate text-xs font-semibold leading-tight text-foreground">{d.name}</p>
                            <p className="truncate text-[10px] capitalize text-muted-foreground">
                              {d.role} · {d.office_location}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn('h-full rounded-full transition-all', barColor)}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <div
                            className={cn(
                              'shrink-0 text-right text-[11px] font-semibold tabular-nums sm:w-24',
                              textColor,
                            )}
                          >
                            {load}h / {cap}h
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

      {/* Summary strip: compact secondary KPIs */}
      <section aria-label="Summary metrics">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            { label: 'Avg priority score', value: Math.round(s.avg_priority || 0), suffix: '/100' },
            { label: 'Overdue tasks', value: s.overdue_tasks || 0, suffix: 'tasks' },
            { label: 'Developers active', value: s.developers || 0, suffix: 'engineers' },
          ].map((m) => (
            <Card key={m.label} className="flex min-h-[5.5rem] flex-col transition-shadow hover:shadow-splm-md">
              <CardContent className="flex flex-1 flex-col justify-center p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
                      {m.value}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{m.suffix}</span>
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
