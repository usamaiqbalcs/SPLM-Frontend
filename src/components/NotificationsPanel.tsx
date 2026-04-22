import { useEffect, useState, useRef, useCallback } from 'react';
import { tasksApi, notificationsApi } from '@/lib/apiClient';
import { listDeploymentsPage } from '@/lib/api';
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
  /** Fired whenever the unread count changes (including after mark read / reload). */
  onUnreadCount?: (count: number) => void;
}

const TYPE_CONFIG = {
  overdue:       { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', tab: 'tasks',       label: 'Overdue Task' },
  failed_deploy: { icon: Rocket,        color: 'text-warning',     bg: 'bg-warning-bg',     tab: 'deployments', label: 'Failed Deploy' },
  critical_task: { icon: Zap,           color: 'text-danger',      bg: 'bg-danger-bg',      tab: 'tasks',       label: 'Critical' },
};

export default function NotificationsPanel({ open, onClose, onNavigate, onUnreadCount }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id));
  const unread = visibleNotifications.filter(n => !readIds.has(n.id)).length;

  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, overdueTasks, failedPage, criticalTasks] = await Promise.all([
        notificationsApi.getReadKeys().catch(() => ({ keys: [] as string[] })),
        tasksApi.getAll({ isOverdue: true, pageSize: 5 }),
        listDeploymentsPage({ page: 1, pageSize: 10, status: 'failed' }).catch(() => ({ items: [] as any[] })),
        tasksApi.getAll({ priority: 'critical', pageSize: 5 }),
      ]);

      const failedDeploys = (failedPage.items ?? []).slice(0, 5);

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
          .filter(t => !t.is_overdue)
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
      setDismissedIds((prev) => {
        const ids = new Set(notifs.map((n) => n.id));
        return new Set([...prev].filter((id) => ids.has(id)));
      });
      // Merge server read keys with prior client reads so closing the panel (refresh) does not
      // wipe "read" state when the DB table is missing or POST has not completed yet.
      const currentIds = new Set(notifs.map(n => n.id));
      setReadIds(prev => {
        const fromServer = new Set(keysRes.keys ?? []);
        const next = new Set(fromServer);
        for (const id of prev) {
          if (currentIds.has(id)) next.add(id);
        }
        return next;
      });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  /** Load on mount (header badge) and whenever the panel is opened (fresh list + read keys). */
  useEffect(() => {
    void refreshNotifications();
  }, [open, refreshNotifications]);

  useEffect(() => {
    onUnreadCount?.(unread);
  }, [unread, onUnreadCount]);

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

  const persistRead = async (ids: string[], markAll = false) => {
    if (!ids.length && !markAll) return;
    try {
      await notificationsApi.addReadKeys(ids, { markAll });
    } catch {
      /* table may not exist yet; UI still updates locally */
    }
  };

  const markRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
    void persistRead([id]);
  };

  const markAllRead = () => {
    const all = visibleNotifications.map(n => n.id);
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const id of all) next.add(id);
      return next;
    });
    void persistRead(all, true);
  };

  const dismissOne = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissedIds((prev) => new Set([...prev, id]));
    markRead(id);
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute left-2 right-2 top-[52px] z-50 mx-auto max-h-[min(85dvh,560px)] w-auto max-w-[360px] overflow-hidden rounded-xl border bg-card shadow-2xl animate-scale-in sm:left-auto sm:right-3 sm:mx-0 sm:w-[min(360px,calc(100vw-1.5rem))]"
    >
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
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            <span className="inline-block animate-spin mr-2">⚙</span>Loading...
          </div>
        )}

        {!loading && visibleNotifications.length === 0 && (
          <div className="px-4 py-10 text-center">
            <Bell className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">All clear!</p>
            <p className="text-xs text-muted-foreground/60 mt-1">No overdue tasks or failed deployments.</p>
          </div>
        )}

        {!loading && visibleNotifications.map(n => {
          const cfg = TYPE_CONFIG[n.type];
          const Icon = cfg.icon;
          const isRead = readIds.has(n.id);
          return (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => { markRead(n.id); onNavigate(cfg.tab); onClose(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  markRead(n.id); onNavigate(cfg.tab); onClose();
                }
              }}
              className={cn(
                'group flex gap-2 px-3 py-3 border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/40 sm:gap-3 sm:pl-4 sm:pr-2',
                isRead && 'opacity-50'
              )}
            >
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                <Icon className={cn('w-4 h-4', cfg.color)} />
              </div>
              <div className="min-w-0 flex-1 pr-0.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-1 text-xs font-semibold leading-tight text-foreground">{n.title}</span>
                  {!isRead && <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{n.subtitle}</div>
                <div className={cn('mt-1 text-[10px] font-semibold uppercase tracking-wide', cfg.color)}>
                  {cfg.label}
                </div>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={(e) => dismissOne(e, n.id)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {visibleNotifications.length > 0 && (
        <div className="px-4 py-2.5 border-t bg-muted/30 flex justify-between items-center">
          <span className="text-[11px] text-muted-foreground">{visibleNotifications.length} total alerts</span>
          <button
            type="button"
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
