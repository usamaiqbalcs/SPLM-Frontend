import { useEffect, useState, useRef } from 'react';
import { tasksApi, deploymentsApi } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/splm-utils';
import { Bell, AlertTriangle, Rocket, Zap, X, CheckCheck } from 'lucide-react';

interface Notification {
  id: string;
  type: 'overdue' | 'failed_deploy' | 'critical_task';
  title: string;
  subtitle: string;
  time: string;
}

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

const TYPE_CONFIG = {
  overdue:       { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', tab: 'tasks',       label: 'Overdue Task' },
  failed_deploy: { icon: Rocket,        color: 'text-warning',     bg: 'bg-warning-bg',     tab: 'deployments', label: 'Failed Deploy' },
  critical_task: { icon: Zap,           color: 'text-danger',      bg: 'bg-danger-bg',      tab: 'tasks',       label: 'Critical' },
};

export default function NotificationsPanel({ open, onClose, onNavigate }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    loadNotifications();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [open, onClose]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const [overdueTasks, allDeployments, criticalTasks] = await Promise.all([
        tasksApi.getAll({ isOverdue: true, pageSize: 5 }),
        deploymentsApi.getAll().catch(() => [] as any[]),
        tasksApi.getAll({ priority: 'critical', pageSize: 5 }),
      ]);

      const failedDeploys = (allDeployments as any[])
        .filter((d: any) => d.status === 'failed')
        .slice(0, 5);

      const notifs: Notification[] = [
        ...overdueTasks.map(t => ({
          id: `overdue-${t.id}`,
          type: 'overdue' as const,
          title: t.title,
          subtitle: `Was due ${t.due_date}`,
          time: t.due_date || '',
        })),
        ...failedDeploys.map((d: any) => ({
          id: `deploy-${d.id}`,
          type: 'failed_deploy' as const,
          title: 'Deployment failed',
          subtitle: `${d.environment} environment · ${fmtDateTime(d.created_at)}`,
          time: d.created_at || '',
        })),
        ...criticalTasks
          .filter(t => !t.is_overdue) // already in overdue list if so
          .map(t => ({
            id: `critical-${t.id}`,
            type: 'critical_task' as const,
            title: t.title,
            subtitle: 'Critical priority · needs attention',
            time: t.created_at || '',
          })),
      ]
        .sort((a, b) => b.time.localeCompare(a.time))
        .slice(0, 12);

      setNotifications(notifs);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const markRead = (id: string) => setReadIds(prev => new Set([...prev, id]));
  const markAllRead = () => setReadIds(new Set(notifications.map(n => n.id)));

  const unread = notifications.filter(n => !readIds.has(n.id)).length;

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-2 top-[52px] z-50 w-[360px] bg-card rounded-xl shadow-2xl border overflow-hidden animate-scale-in"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-foreground" />
          <span className="font-bold text-sm text-foreground">Notifications</span>
          {unread > 0 && (
            <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            <span className="inline-block animate-spin mr-2">⚙</span>Loading...
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="px-4 py-10 text-center">
            <Bell className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">All clear!</p>
            <p className="text-xs text-muted-foreground/60 mt-1">No overdue tasks or failed deployments.</p>
          </div>
        )}

        {!loading && notifications.map(n => {
          const cfg = TYPE_CONFIG[n.type];
          const Icon = cfg.icon;
          const isRead = readIds.has(n.id);
          return (
            <div
              key={n.id}
              onClick={() => { markRead(n.id); onNavigate(cfg.tab); onClose(); }}
              className={cn(
                'flex gap-3 px-4 py-3 border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/40',
                isRead && 'opacity-50'
              )}
            >
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                <Icon className={cn('w-4 h-4', cfg.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground leading-tight line-clamp-1">{n.title}</span>
                  {!isRead && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{n.subtitle}</div>
                <div className={cn('text-[10px] font-semibold mt-1 uppercase tracking-wide', cfg.color)}>
                  {cfg.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t bg-muted/30 flex justify-between items-center">
          <span className="text-[11px] text-muted-foreground">{notifications.length} total alerts</span>
          <button
            onClick={() => { onNavigate('tasks'); onClose(); }}
            className="text-[11px] text-primary hover:underline cursor-pointer"
          >
            Go to Tasks →
          </button>
        </div>
      )}
    </div>
  );
}
