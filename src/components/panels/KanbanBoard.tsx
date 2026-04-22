import { useState, useRef } from 'react';
import { updateTaskStatus } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', icon: '📋' },
  { id: 'assigned', label: 'Assigned', icon: '👤' },
  { id: 'in_progress', label: 'In Progress', icon: '⚡' },
  { id: 'review', label: 'Review', icon: '🔍' },
  { id: 'done', label: 'Done', icon: '✅' },
];

interface KanbanBoardProps {
  tasks: any[];
  products: any[];
  developers: any[];
  onRefresh: () => void;
  onTaskClick: (task: any) => void;
}

export default function KanbanBoard({ tasks, products, developers, onRefresh, onTaskClick }: KanbanBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  /** Mousedown/pointer position — ignore click after a drag when movement is large. */
  const cardPointer0 = useRef<Record<string, { x: number; y: number }>>({});

  const pname = (id: string) => products.find(p => p.id === id)?.name || '—';
  const dname = (id: string) => developers.find(d => d.id === id)?.name || '';
  const initials = (id: string) => {
    const name = dname(id);
    return name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '';
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOver(colId);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOver(null);
    if (!draggedId) return;
    const task = tasks.find(t => t.id === draggedId);
    if (!task || task.status === newStatus) { setDraggedId(null); return; }
    try {
      await updateTaskStatus(draggedId, newStatus);
      toast.success(`Moved to ${newStatus.replace(/_/g, ' ')}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
    setDraggedId(null);
  };

  /** Ignore click when the pointer moved a lot (drag) so we don’t open the drawer after dropping a card. */
  const handleCardClick = (e: React.MouseEvent, t: { id: string }) => {
    const p0 = cardPointer0.current[t.id];
    if (!p0) {
      onTaskClick(t);
      return;
    }
    const d = Math.hypot(e.clientX - p0.x, e.clientY - p0.y);
    delete cardPointer0.current[t.id];
    if (d > 8) return;
    onTaskClick(t);
  };

  const onCardPointerDown = (e: React.PointerEvent, taskId: string) => {
    cardPointer0.current[taskId] = { x: e.clientX, y: e.clientY };
  };

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  /** Map terminal / non-lane statuses into the Done column so every task appears in one of the five lanes. */
  const laneStatus = (t: any): string => {
    const s = (t.status || 'backlog') as string;
    if (s === 'cancelled' || s === 'done') return 'done';
    return s;
  };

  return (
    <div className="-mx-1 flex min-h-[min(500px,70dvh)] gap-3 overflow-x-auto overscroll-x-contain px-1 pb-4 scrollbar-thin sm:mx-0 sm:px-0 lg:overflow-x-visible lg:pb-2">
      {COLUMNS.map(col => {
        const colTasks = tasks
          .filter(t => laneStatus(t) === col.id)
          .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

        return (
          <div
            key={col.id}
            className={cn(
              'flex w-[min(240px,calc(100vw-2.5rem))] flex-shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors sm:w-[240px]',
              'lg:w-0 lg:min-w-0 lg:flex-1 lg:max-w-none',
              dragOver === col.id && 'border-primary bg-primary/5'
            )}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{col.icon}</span>
                <span className="text-xs font-bold text-foreground">{col.label}</span>
              </div>
              <span className="bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin">
              {colTasks.map(t => (
                <div
                  key={t.id}
                  draggable
                  onPointerDown={(e) => onCardPointerDown(e, t.id)}
                  onDragStart={(e) => handleDragStart(e, t.id)}
                  onClick={(e) => handleCardClick(e, t)}
                  className={cn(
                    'bg-card rounded-md border p-3 cursor-pointer hover:shadow-md transition-all group',
                    draggedId === t.id && 'opacity-40 scale-95'
                  )}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className={cn('text-xs font-semibold text-foreground leading-tight line-clamp-2 flex-1', t.status === 'cancelled' && 'line-through opacity-70')}>{t.title}</span>
                    <StatusBadge status={t.priority} size="sm" />
                  </div>
                  {t.status === 'cancelled' && (
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Cancelled</span>
                  )}
                  <div className="text-[10px] text-muted-foreground mb-2">{pname(t.product_id)}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {t.story_points > 0 && (
                        <span className="bg-secondary text-primary text-[10px] font-bold px-1.5 py-0.5 rounded">{t.story_points} SP</span>
                      )}
                      {Number(t.ai_priority_score) > 0 && (
                        <span className="bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded border border-primary/30" title="AI priority score">
                          AI {Number(t.ai_priority_score).toFixed(0)}
                        </span>
                      )}
                      {t.type && (
                        <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded">{t.type}</span>
                      )}
                    </div>
                    {t.assigned_to && initials(t.assigned_to) && (
                      <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[8px] font-bold text-accent-foreground" title={dname(t.assigned_to)}>
                        {initials(t.assigned_to)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {colTasks.length === 0 && (
                <div className="text-center text-muted-foreground text-[11px] py-8">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
