import { useEffect, useState } from 'react';
import { getAnalytics, listDeployments, listProducts, listDevelopers } from '@/lib/api';
import { listSprints } from '@/lib/api-sprints';
import { StatusBadge, PriorityBar } from '@/components/StatusBadge';
import { fmtDateTime, fmtDate, ENV_CONFIG } from '@/lib/splm-utils';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const PIE_COLORS = ['hsl(var(--navy))', 'hsl(var(--teal))', 'hsl(var(--amber))', 'hsl(var(--green))', 'hsl(var(--red))'];

export default function DashboardPanel() {
  const [stats, setStats]         = useState<any>(null);
  const [deploys, setDeploys]     = useState<any[]>([]);
  const [products, setProducts]   = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [sprints, setSprints]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      getAnalytics(),
      listDeployments(),
      listProducts(),
      listDevelopers(),
      listSprints(),
    ])
      .then(([s, d, p, devs, sp]) => {
        setStats(s);
        setDeploys(d.slice(0, 6));
        setProducts(p);
        setDevelopers(devs);
        setSprints(sp);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const s = stats || {};
  const pname = (id: string) => products.find(p => p.id === id)?.name || id?.slice(0, 8) || '—';

  const tiles = [
    { label: 'Total Products',    value: s.products,      sub: `${s.active_products} active`,     icon: '📦' },
    { label: 'Open Tasks',        value: s.open_tasks,    sub: `${s.critical_tasks} critical`,    icon: '✅' },
    { label: 'Versions Tracked',  value: s.total_versions, sub: 'across all products',           icon: '🏷️' },
    { label: 'Deployments Today', value: s.deploys_today, sub: `${s.failed_deploys} failed`,     icon: '🚀' },
  ];

  // Task distribution for pie chart
  const taskDistribution = [
    { name: 'Backlog',     value: s.task_by_status?.backlog     || 0 },
    { name: 'Assigned',   value: s.task_by_status?.assigned    || 0 },
    { name: 'In Progress', value: s.task_by_status?.in_progress || 0 },
    { name: 'Review',     value: s.task_by_status?.review      || 0 },
    { name: 'Done',       value: s.task_by_status?.done        || 0 },
  ].filter(d => d.value > 0);

  // Priority bar chart
  const priorityData = (s.top_products || []).map((p: any) => ({
    name: p.name?.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
    score: Number(p.priority_score || 0),
  }));

  // Active sprints with progress
  const TODAY = new Date().toISOString().split('T')[0];
  const activeSprints = sprints
    .filter(sp => sp.status === 'active' || sp.status === 'planning')
    .slice(0, 4);

  return (
    <div className="animate-fade-in space-y-5">

      {/* ── KPI Tiles ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t, i) => (
          <div key={i} className="bg-card rounded-lg border p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t.label}</div>
                <div className="text-3xl font-extrabold text-primary mt-1">{t.value ?? 0}</div>
                <div className="text-xs text-muted-foreground">{t.sub}</div>
              </div>
              <span className="text-2xl">{t.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Recent Deployments + Top Products ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-bold text-primary mb-3 text-sm">🚀 Recent Deployments</h3>
          {deploys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <span className="text-3xl mb-2">🚀</span>
              <p className="text-sm">No deployments yet</p>
              <p className="text-xs">Queue your first deployment to see it here</p>
            </div>
          ) : deploys.map(d => {
            const ec = ENV_CONFIG[d.environment as keyof typeof ENV_CONFIG];
            return (
              <div key={d.id} className="flex justify-between items-center py-2 border-b border-muted last:border-0 hover:bg-muted/30 rounded px-2 -mx-2 transition-colors">
                <div>
                  <div className="font-semibold text-sm">{pname(d.product_id)}</div>
                  <div className="text-xs text-muted-foreground">{ec?.icon} {d.environment} · <code>v{d.version}</code> · {fmtDateTime(d.created_at)}</div>
                </div>
                <StatusBadge status={d.status || ''} />
              </div>
            );
          })}
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-bold text-primary mb-3 text-sm">🔥 Top Priority Products</h3>
          {(s.top_products || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <span className="text-3xl mb-2">📦</span>
              <p className="text-sm">No products yet</p>
              <p className="text-xs">Add products to see priority rankings</p>
            </div>
          ) : (s.top_products || []).map((p: any) => (
            <div key={p.id} className="flex justify-between items-center py-2 border-b border-muted last:border-0 hover:bg-muted/30 rounded px-2 -mx-2 transition-colors">
              <div>
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.current_version ? `v${p.current_version}` : 'no version'} · {p.customer_count || 0} customers
                </div>
              </div>
              <PriorityBar score={Number(p.priority_score || 0)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts ── */}
      {priorityData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-card rounded-lg border p-5">
            <h3 className="font-bold text-primary mb-4 text-sm">📊 Priority Scores</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="score" fill="hsl(var(--navy))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {taskDistribution.length > 0 && (
            <div className="bg-card rounded-lg border p-5">
              <h3 className="font-bold text-primary mb-4 text-sm">📋 Task Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={taskDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={false}
                  >
                    {taskDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Active Sprints ── */}
      {activeSprints.length > 0 && (
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-bold text-primary mb-4 text-sm">⚡ Active Sprints</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeSprints.map(sp => {
              const sprintTasks = (sp.tasks || []);
              const done = sprintTasks.filter((t: any) => t.status === 'done').length;
              const total = sprintTasks.length;
              const pct = total ? Math.round((done / total) * 100) : 0;

              // Date progress
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
                <div key={sp.id} className={cn(
                  'border rounded-lg p-4',
                  isOverdue ? 'border-destructive/30 bg-destructive/5' : 'bg-muted/20'
                )}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-sm">{sp.name}</div>
                      {sp.goal && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{sp.goal}</div>}
                    </div>
                    <StatusBadge status={sp.status || 'planning'} />
                  </div>

                  {/* Task progress */}
                  {total > 0 && (
                    <div className="mb-2">
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Tasks: {done}/{total}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Date progress */}
                  {start && end && (
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>{fmtDate(start)}</span>
                        <span className={isOverdue ? 'text-destructive font-semibold' : ''}>{fmtDate(end)}</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', isOverdue ? 'bg-destructive' : 'bg-primary/40')}
                          style={{ width: `${datePct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Team Workload ── */}
      {developers.length > 0 && (
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-bold text-primary mb-4 text-sm">👩‍💻 Team Workload</h3>
          <div className="space-y-3">
            {developers
              .filter(d => d.active)
              .sort((a, b) => {
                const pctA = (Number(a.current_load_hours) || 0) / (a.capacity_hours_week || 40);
                const pctB = (Number(b.current_load_hours) || 0) / (b.capacity_hours_week || 40);
                return pctB - pctA;
              })
              .map(d => {
                const load = Number(d.current_load_hours) || 0;
                const cap = d.capacity_hours_week || 40;
                const pct = Math.min(100, Math.round((load / cap) * 100));
                const barColor = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-success';
                const textColor = pct >= 90 ? 'text-destructive' : pct >= 70 ? 'text-warning' : 'text-success';
                return (
                  <div key={d.id} className="flex items-center gap-3">
                    <div className="w-32 flex-shrink-0">
                      <div className="text-sm font-semibold text-foreground leading-tight">{d.name}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">{d.role} · {d.office_location}</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className={cn('text-xs font-bold w-24 text-right flex-shrink-0', textColor)}>
                      {load}h / {cap}h
                      <span className="text-muted-foreground font-normal ml-1">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Bottom metric tiles ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Avg Priority Score', value: Math.round(s.avg_priority || 0), suffix: '/100' },
          { label: 'Overdue Tasks',      value: s.overdue_tasks || 0,            suffix: 'tasks' },
          { label: 'Developers Active',  value: s.developers || 0,               suffix: 'engineers' },
        ].map((m, i) => (
          <div key={i} className="bg-card rounded-lg border p-5 hover:shadow-md transition-shadow">
            <div className="text-[11px] text-muted-foreground font-semibold uppercase mb-2">{m.label}</div>
            <div className="text-3xl font-extrabold text-primary">
              {m.value}
              <span className="text-sm font-normal text-muted-foreground ml-1">{m.suffix}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
