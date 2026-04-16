import { useEffect, useState } from 'react';
import { getAnalytics, listDeploymentsPage, listProducts, listDevelopers } from '@/lib/api';
import { listSprints } from '@/lib/api-sprints';
import { StatusBadge, PriorityBar } from '@/components/StatusBadge';
import { fmtDateTime, fmtDate, ENV_CONFIG } from '@/lib/splm-utils';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { SplmEmptyState } from '@/components/layout/SplmEmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
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

  const priorityData = (s.top_products || []).map((p: any) => ({
    name: p.name?.length > 14 ? `${p.name.slice(0, 14)}…` : p.name,
    score: Number(p.priority_score || 0),
  }));

  const TODAY = new Date().toISOString().split('T')[0];
  const activeSprints = sprints
    .filter((sp) => sp.status === 'active' || sp.status === 'planning')
    .slice(0, 4);

  return (
    <div className="animate-fade-in space-y-8">
      {/* KPI strip */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => (
            <Card
              key={t.label}
              className="overflow-hidden transition-shadow duration-200 hover:shadow-splm-md"
            >
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</p>
                    <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{t.value ?? 0}</p>
                    <p className="text-xs text-muted-foreground">{t.sub}</p>
                  </div>
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                      t.accent,
                    )}
                  >
                    <t.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Activity">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardTitle>Recent deployments</CardTitle>
            </div>
            <CardDescription>Latest pipeline activity across products</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {deploys.length === 0 ? (
              <SplmEmptyState
                icon={Rocket}
                title="No deployments yet"
                description="When deployments run, they will appear here with environment and version."
              />
            ) : (
              deploys.map((d) => {
                const ec = ENV_CONFIG[d.environment as keyof typeof ENV_CONFIG];
                return (
                  <div
                    key={d.id}
                    className="flex flex-col gap-2 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{pname(d.product_id)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {ec?.icon} {d.environment}
                        </span>
                        <span className="mx-1.5 text-border">·</span>
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">v{d.version}</code>
                        <span className="mx-1.5 text-border">·</span>
                        {fmtDateTime(d.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={d.status || ''} className="shrink-0 self-start sm:self-center" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardTitle>Top priority products</CardTitle>
            </div>
            <CardDescription>Ranked by composite priority score</CardDescription>
          </CardHeader>
          <CardContent>
            {(s.top_products || []).length === 0 ? (
              <SplmEmptyState
                icon={Package}
                title="No products yet"
                description="Add products to see how they rank by priority."
              />
            ) : (
              <div className="space-y-0">
                {(s.top_products || []).map((p: any) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-2 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.current_version ? `v${p.current_version}` : 'No version'}
                        <span className="mx-1.5">·</span>
                        {p.customer_count || 0} customers
                      </p>
                    </div>
                    <PriorityBar score={Number(p.priority_score || 0)} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {(priorityData.length > 0 || taskDistribution.length > 0) && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Charts">
          {priorityData.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <CardTitle>Priority scores</CardTitle>
                </div>
                <CardDescription>Relative emphasis across top products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {taskDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <CardTitle>Task distribution</CardTitle>
                </div>
                <CardDescription>Open work by workflow state</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={taskDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={88}
                        dataKey="value"
                        label={({ name, value }) => `${name} (${value})`}
                        labelLine={false}
                      >
                        {taskDistribution.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {activeSprints.length > 0 && (
        <section aria-label="Active sprints">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" aria-hidden />
                <CardTitle>Active sprints</CardTitle>
              </div>
              <CardDescription>In progress or planning — task and timeline progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                        'rounded-xl border p-4 transition-colors',
                        isOverdue ? 'border-destructive/35 bg-destructive/[0.06]' : 'border-border/80 bg-muted/15',
                      )}
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug text-foreground">{sp.name}</p>
                          {sp.goal ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{sp.goal}</p>
                          ) : null}
                        </div>
                        <StatusBadge status={sp.status || 'planning'} className="shrink-0" />
                      </div>

                      {total > 0 && (
                        <div className="mb-3">
                          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                            <span>
                              Tasks: {done}/{total}
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-success transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {start && end && (
                        <div>
                          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                            <span>{fmtDate(start)}</span>
                            <span className={isOverdue ? 'font-semibold text-destructive' : ''}>{fmtDate(end)}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('h-full rounded-full', isOverdue ? 'bg-destructive' : 'bg-primary/45')}
                              style={{ width: `${datePct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {developers.length > 0 && (
        <section aria-label="Team workload">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                <CardTitle>Team workload</CardTitle>
              </div>
              <CardDescription>Active developers by hours vs weekly capacity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {developers
                .filter((d) => d.active)
                .sort((a, b) => {
                  const pctA = (Number(a.current_load_hours) || 0) / (a.capacity_hours_week || 40);
                  const pctB = (Number(b.current_load_hours) || 0) / (b.capacity_hours_week || 40);
                  return pctB - pctA;
                })
                .map((d) => {
                  const load = Number(d.current_load_hours) || 0;
                  const cap = d.capacity_hours_week || 40;
                  const pct = Math.min(100, Math.round((load / cap) * 100));
                  const barColor = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-success';
                  const textColor = pct >= 90 ? 'text-destructive' : pct >= 70 ? 'text-warning' : 'text-success';
                  return (
                    <div key={d.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <div className="w-full min-w-0 sm:w-40">
                        <p className="truncate text-sm font-semibold leading-tight">{d.name}</p>
                        <p className="text-[11px] capitalize text-muted-foreground">
                          {d.role} · {d.office_location}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div
                        className={cn(
                          'shrink-0 text-right text-xs font-semibold tabular-nums sm:w-28',
                          textColor,
                        )}
                      >
                        {load}h / {cap}h
                        <span className="ml-1 font-normal text-muted-foreground">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-label="Summary metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Avg priority score', value: Math.round(s.avg_priority || 0), suffix: '/100' },
            { label: 'Overdue tasks', value: s.overdue_tasks || 0, suffix: 'tasks' },
            { label: 'Developers active', value: s.developers || 0, suffix: 'engineers' },
          ].map((m) => (
            <Card key={m.label} className="transition-shadow hover:shadow-splm-md">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{m.label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {m.value}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">{m.suffix}</span>
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
