import { useEffect, useState, useMemo } from 'react';
import { tasksApi, productsApi, developersApi } from '@/lib/apiClient';
import { ListPageSearchInput, rowMatchesListSearch, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDate } from '@/lib/splm-utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import TaskDetailDrawer from '@/components/panels/TaskDetailDrawer';
import {
  Clock, CheckCircle2, AlertTriangle, Zap, Package,
  CalendarDays, ListChecks, ChevronDown, ChevronRight,
  UserX, RefreshCw, Bug,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Task = Record<string, any>;

interface Section {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  tasks: Task[];
  defaultOpen?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];

const dateLabel = (due: string | null) => {
  if (!due) return null;
  const d = due.split('T')[0]; // handle ISO datetime or date-only
  if (d < TODAY)  return { text: `Overdue · ${fmtDate(d)}`, cls: 'text-destructive font-semibold' };
  if (d === TODAY) return { text: 'Due today',               cls: 'text-warning font-semibold' };
  return { text: `Due ${fmtDate(d)}`,                       cls: 'text-muted-foreground' };
};

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const sortByPriority = (a: Task, b: Task) =>
  (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({
  task, productName, onStatusChange, onClick,
}: {
  task: Task; productName: string;
  onStatusChange: (id: string, status: string) => void;
  onClick: (task: Task) => void;
}) {
  const dueRaw = task.due_date;
  const dl = dateLabel(dueRaw);
  const duePart = dueRaw ? dueRaw.split('T')[0] : null;
  const isOverdue = duePart && duePart < TODAY && task.status !== 'done';
  const isDoneOrCancelled = ['done', 'cancelled'].includes(task.status);

  return (
    <div
      onClick={() => onClick(task)}
      className={cn(
        'group flex items-start gap-3 p-3.5 rounded-lg border transition-all cursor-pointer',
        isOverdue
          ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
          : 'border-border bg-muted/20 hover:bg-muted/50 hover:shadow-sm',
        isDoneOrCancelled && 'opacity-60'
      )}
    >
      {/* Priority strip */}
      <div className={cn(
        'w-1 self-stretch rounded-full flex-shrink-0',
        task.priority === 'critical' ? 'bg-destructive' :
        task.priority === 'high'     ? 'bg-warning' :
        task.priority === 'medium'   ? 'bg-primary' :
                                       'bg-muted-foreground/30'
      )} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className={cn(
            'font-semibold text-sm leading-tight',
            isDoneOrCancelled && 'line-through text-muted-foreground'
          )}>
            {task.title}
          </span>

          <select
            className="border rounded text-xs px-2 py-1 bg-background flex-shrink-0 ml-2 cursor-pointer"
            value={task.status}
            onClick={e => e.stopPropagation()}
            onChange={e => { e.stopPropagation(); onStatusChange(task.id, e.target.value); }}
          >
            {['backlog', 'assigned', 'in_progress', 'review', 'done', 'cancelled'].map(o => (
              <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <StatusBadge status={task.priority} size="sm" />
          <StatusBadge status={task.type || 'feature'} size="sm" />
          {task.story_points > 0 && (
            <span className="bg-secondary text-primary text-[10px] font-bold px-1.5 py-0.5 rounded">
              {task.story_points} SP
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap">
          {productName && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Package className="w-3 h-3" />
              {productName}
            </span>
          )}
          {dl && (
            <span className={cn('flex items-center gap-1', dl.cls)}>
              <CalendarDays className="w-3 h-3" />
              {dl.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
function QueueSection({ section, productName, onStatusChange, onTaskClick }: {
  section: Section;
  productName: (id: string) => string;
  onStatusChange: (id: string, status: string) => void;
  onTaskClick: (task: Task) => void;
}) {
  const [open, setOpen] = useState(section.defaultOpen ?? true);

  if (section.tasks.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <span className={section.color}>{section.icon}</span>
          <span className="font-bold text-sm text-foreground">{section.label}</span>
          <span className="bg-muted text-muted-foreground text-[11px] font-bold px-2 py-0.5 rounded-full">
            {section.tasks.length}
          </span>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t">
          <div className="pt-3 space-y-2">
            {section.tasks.map(t => (
              <TaskCard
                key={t.id}
                task={t}
                productName={productName(t.product_id)}
                onStatusChange={onStatusChange}
                onClick={onTaskClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MyQueuePanel() {
  const { profile, user } = useAuth();

  const [tasks, setTasks]         = useState<Task[]>([]);
  const [products, setProducts]   = useState<Task[]>([]);
  const [developer, setDeveloper] = useState<Task | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, any> | null>(null);
  const [listSearch, setListSearch] = useState('');
  const debouncedListSearch = useListPageSearchDebounce(listSearch);

  const load = async (quiet = false) => {
    const email = profile?.email?.trim() || user?.email?.trim() || '';
    if (!email) return;
    quiet ? setRefreshing(true) : setLoading(true);

    try {
      // 1. Look up developer by email
      const devData = await developersApi.getByEmail(email).catch(() => null);

      // 2. Fetch products in parallel; tasks only once we have devData.id
      const allProducts = await productsApi.getAll().catch(() => [] as any[]);

      const dbg = {
        resolvedEmail: email,
        profileEmail: profile?.email,
        authEmail: user?.email,
        devFound: !!devData,
        devId: devData?.id ?? null,
      };
      console.log('[MyQueue debug]', dbg);
      setDebugInfo(dbg);
      setDeveloper(devData ?? null);
      setProducts(allProducts);

      if (devData?.id) {
        // Use the my-queue endpoint for efficient server-side filtering
        const myTasks = await tasksApi.getMyQueue(devData.id).catch(() => [] as any[]);
        setTasks(myTasks);
      } else {
        setTasks([]);
      }
    } catch (e: any) {
      toast.error('Failed to load your queue: ' + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [profile, user]);

  const doStatusChange = async (id: string, status: string) => {
    try {
      await tasksApi.update(id, { status });
      toast.success(`Moved to ${status.replace(/_/g, ' ')}`);
      await load(true);
      if (selectedTask?.id === id) setSelectedTask(t => t ? { ...t, status } : t);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const productName = (id: string) => products.find(p => p.id === id)?.name ?? '—';

  const filteredTasks = useMemo(() => {
    const q = debouncedListSearch;
    if (!q.trim()) return tasks;
    return tasks.filter(t =>
      rowMatchesListSearch(q, [
        t.title,
        t.description,
        productName(t.product_id),
        t.status,
        t.type,
        t.priority,
      ]),
    );
  }, [tasks, debouncedListSearch, products]);

  // ── Derived groups ──────────────────────────────────────────────────────────
  const { overdue, inProgress, dueToday, upcoming, backlog, done } = useMemo(() => {
    const active = filteredTasks.filter(t => !['done', 'cancelled'].includes(t.status));
    return {
      overdue:    active.filter(t => t.is_overdue).sort(sortByPriority),
      inProgress: active.filter(t => t.status === 'in_progress').sort(sortByPriority),
      dueToday:   active.filter(t => {
        const d = (t.due_date || '').split('T')[0];
        return d === TODAY && t.status !== 'in_progress' && !t.is_overdue;
      }).sort(sortByPriority),
      upcoming:   active.filter(t => {
        const d = (t.due_date || '').split('T')[0];
        return d > TODAY && t.status !== 'in_progress';
      }).sort(sortByPriority),
      backlog:    active.filter(t => !t.due_date && ['backlog', 'assigned'].includes(t.status)).sort(sortByPriority),
      done:       filteredTasks.filter(t => t.status === 'done').slice(0, 10),
    };
  }, [filteredTasks]);

  const stats = useMemo(() => {
    const active = filteredTasks.filter(t => !['done', 'cancelled'].includes(t.status));
    const totalSP = filteredTasks.reduce((s, t) => s + (t.story_points || 0), 0);
    const doneSP  = done.reduce((s, t) => s + (t.story_points || 0), 0);
    return {
      total:      filteredTasks.length,
      active:     active.length,
      overdue:    overdue.length,
      inProgress: inProgress.length,
      doneCount:  done.length,
      completion: filteredTasks.length ? Math.round((done.length / filteredTasks.length) * 100) : 0,
      totalSP,
      doneSP,
    };
  }, [filteredTasks, overdue, inProgress, done]);

  const sections: Section[] = [
    { id: 'overdue',     label: 'Overdue',       icon: <AlertTriangle className="w-4 h-4" />, color: 'text-destructive',      tasks: overdue,    defaultOpen: true },
    { id: 'in_progress', label: 'In Progress',    icon: <Zap className="w-4 h-4" />,           color: 'text-primary',          tasks: inProgress, defaultOpen: true },
    { id: 'due_today',   label: 'Due Today',      icon: <Clock className="w-4 h-4" />,          color: 'text-warning',          tasks: dueToday,   defaultOpen: true },
    { id: 'upcoming',    label: 'Upcoming',       icon: <CalendarDays className="w-4 h-4" />,   color: 'text-muted-foreground', tasks: upcoming,   defaultOpen: true },
    { id: 'backlog',     label: 'Backlog',        icon: <ListChecks className="w-4 h-4" />,     color: 'text-muted-foreground', tasks: backlog,    defaultOpen: false },
    { id: 'done',        label: 'Recently Done',  icon: <CheckCircle2 className="w-4 h-4" />,   color: 'text-success',          tasks: done,       defaultOpen: false },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) return (
    <div className="animate-fade-in space-y-4">
      <div className="bg-card rounded-lg border p-5 space-y-2">
        <div className="h-6 bg-muted rounded w-48 animate-pulse" />
        <div className="h-4 bg-muted rounded w-72 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-card rounded-lg border p-4 space-y-2">
            <div className="h-3 bg-muted rounded w-16 animate-pulse" />
            <div className="h-7 bg-muted rounded w-10 animate-pulse" />
          </div>
        ))}
      </div>
      {[1,2,3].map(i => (
        <div key={i} className="bg-card rounded-lg border p-5 space-y-3">
          <div className="h-4 bg-muted rounded w-32 animate-pulse" />
          <div className="h-16 bg-muted/50 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );

  if (!developer) return (
    <div className="animate-fade-in space-y-4">
      <div className="bg-card rounded-lg border p-6 text-center">
        <UserX className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="font-bold text-foreground text-lg mb-1">{greeting}, {profile?.name?.split(' ')[0] ?? 'there'}!</h3>
        <p className="text-sm text-muted-foreground">
          No developer profile was found for email&nbsp;
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
            {debugInfo?.resolvedEmail || '(unknown)'}
          </code>
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Go to the <strong>Team</strong> module and make sure a developer exists with exactly that email address.
        </p>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="mt-4 flex items-center gap-1.5 mx-auto text-xs text-primary hover:underline cursor-pointer"
        >
          <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
          {refreshing ? 'Retrying…' : 'Retry'}
        </button>
      </div>

      {debugInfo && (
        <div className="bg-muted/30 rounded-lg border border-dashed p-4 text-xs font-mono space-y-1 text-muted-foreground">
          <div className="flex items-center gap-1.5 mb-2 font-sans font-semibold text-foreground text-sm">
            <Bug className="w-3.5 h-3.5" />
            Diagnostics
          </div>
          <div><span className="text-foreground/60">Email searched:</span> {debugInfo.resolvedEmail || '❌ empty'}</div>
          <div><span className="text-foreground/60">profile.email:</span> {debugInfo.profileEmail || '(blank)'}</div>
          <div><span className="text-foreground/60">auth user email:</span> {debugInfo.authEmail || '(blank)'}</div>
          <div><span className="text-foreground/60">Developer found:</span> {debugInfo.devFound ? '✅ yes' : '❌ no'}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in space-y-4">
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          products={products}
          developers={developer ? [developer] : []}
          onClose={() => setSelectedTask(null)}
          onRefresh={async () => {
            await load(true);
            const fresh = tasks.find(t => t.id === selectedTask.id);
            if (fresh) setSelectedTask(fresh);
          }}
        />
      )}

      {/* Greeting banner */}
      <div className="bg-card rounded-lg border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-foreground">
            {greeting}, {profile?.name?.split(' ')[0]}! 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.active === 0
              ? "No active tasks — you're all caught up! 🎉"
              : `You have ${stats.active} active task${stats.active !== 1 ? 's' : ''}${overdue.length > 0 ? ` · ${overdue.length} overdue` : ''}`
            }
          </p>
          {stats.total > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[200px]">
                <div
                  className="h-full bg-success rounded-full transition-all duration-500"
                  style={{ width: `${stats.completion}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground">
                {stats.completion}% complete ({stats.doneCount}/{stats.total})
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:items-end gap-2 flex-shrink-0 w-full sm:w-auto">
          <ListPageSearchInput
            value={listSearch}
            onChange={setListSearch}
            className="w-full sm:w-56"
            placeholder="Search your tasks…"
            aria-label="Search tasks in my queue"
          />
          <div className="text-right w-full sm:w-auto">
            <div className="text-xs font-semibold text-foreground">{developer.name}</div>
            <div className="text-[11px] text-muted-foreground capitalize">{developer.role}</div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Tasks',  value: stats.active,     sub: `${stats.total} total`,         icon: <ListChecks className="w-4 h-4" />,   color: 'text-primary' },
          { label: 'In Progress',   value: stats.inProgress, sub: 'working now',                  icon: <Zap className="w-4 h-4" />,          color: 'text-primary' },
          { label: 'Overdue',       value: stats.overdue,    sub: 'need attention',               icon: <AlertTriangle className="w-4 h-4" />, color: stats.overdue > 0 ? 'text-destructive' : 'text-muted-foreground' },
          { label: 'Story Points',  value: stats.totalSP,    sub: `${stats.doneSP} completed`,    icon: <CheckCircle2 className="w-4 h-4" />,  color: 'text-success' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{s.label}</span>
              <span className={s.color}>{s.icon}</span>
            </div>
            <div className={cn('text-2xl font-extrabold', s.color)}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Task sections */}
      {sections.map(section => (
        <QueueSection
          key={section.id}
          section={section}
          productName={productName}
          onStatusChange={doStatusChange}
          onTaskClick={setSelectedTask}
        />
      ))}

      {tasks.length > 0 && filteredTasks.length === 0 && debouncedListSearch.trim() !== '' && (
        <div className="bg-card rounded-lg border p-10 text-center text-muted-foreground">
          <p className="font-medium text-foreground">No tasks match your search</p>
          <p className="text-sm mt-1">Try another term or clear the search box.</p>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="bg-card rounded-lg border p-10 text-center">
          <CheckCircle2 className="w-12 h-12 text-success/30 mx-auto mb-3" />
          <h3 className="font-bold text-foreground mb-1">All clear!</h3>
          <p className="text-sm text-muted-foreground">No tasks are assigned to you right now.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ask a manager to assign tasks to <strong>{developer.name}</strong> in the Tasks module.
          </p>
        </div>
      )}
    </div>
  );
}
