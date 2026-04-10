/**
 * TaskDetailDrawer.tsx
 *
 * Supabase has been removed:
 *  - real-time channel subscription → dropped (no equivalent in .NET)
 *  - profiles table lookup → comments now carry author_name / author_email from .NET
 *  - updateTaskStatus via Supabase → uses tasksApi.update
 *
 * api-comments.ts function signatures changed:
 *  - deleteComment(taskId, commentId)   (was deleteComment(commentId))
 *  - toggleSubtask(taskId, id, completed)  (was toggleSubtask(id, completed))
 *  - deleteSubtask(taskId, id)           (was deleteSubtask(id))
 */

import { useEffect, useState, useRef } from 'react';
import {
  listComments, addComment, deleteComment,
  listSubtasks, addSubtask, toggleSubtask, deleteSubtask,
} from '@/lib/api-comments';
import { updateTaskStoryPoints } from '@/lib/api-sprints';
import { tasksApi } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtDate, fmtDateTime } from '@/lib/splm-utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  X, Send, Trash2, CheckSquare, Square, Plus,
  MessageSquare, ListChecks, Clock, User, Package,
} from 'lucide-react';

interface TaskDetailDrawerProps {
  task: any;
  products: any[];
  developers: any[];
  onClose: () => void;
  onRefresh: () => void;
}

/** Derive initials from a display name, e.g. "Jane Doe" → "JD". */
function initials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function TaskDetailDrawer({
  task, products, developers, onClose, onRefresh,
}: TaskDetailDrawerProps) {
  const { user } = useAuth();

  const [comments, setComments]     = useState<any[]>([]);
  const [subtasks, setSubtasks]     = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [storyPoints, setStoryPoints] = useState(task.story_points || 0);
  const [sending, setSending]       = useState(false);
  const [activeTab, setActiveTab]   = useState<'comments' | 'subtasks' | 'details'>('comments');
  const commentsEndRef              = useRef<HTMLDivElement>(null);

  // Helpers that look up names from the passed-in props
  const pname = (id: string) => products.find(p => p.id === id)?.name || '—';
  const dname = (id: string) => developers.find(d => d.id === id)?.name || 'Unassigned';

  // ── Load comments + subtasks on mount / task change ──────────────────────────
  useEffect(() => {
    loadComments();
    loadSubtasks();
  }, [task.id]);

  const loadComments = async () => {
    try { setComments(await listComments(task.id)); } catch {}
  };
  const loadSubtasks = async () => {
    try { setSubtasks(await listSubtasks(task.id)); } catch {}
  };

  // ── Comment actions ───────────────────────────────────────────────────────────
  const doAddComment = async () => {
    if (!newComment.trim() || !user) return;
    setSending(true);
    try {
      // addComment ignores userId param — backend reads it from the JWT
      await addComment(task.id, user.id, newComment.trim());
      setNewComment('');
      await loadComments();
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const doDeleteComment = async (commentId: string) => {
    try { await deleteComment(task.id, commentId); await loadComments(); }
    catch (e: any) { toast.error(e.message); }
  };

  // ── Subtask actions ───────────────────────────────────────────────────────────
  const doAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    try {
      await addSubtask(task.id, newSubtask.trim());
      setNewSubtask('');
      await loadSubtasks();
    } catch (e: any) { toast.error(e.message); }
  };

  const doToggleSubtask = async (subtaskId: string, completed: boolean) => {
    try { await toggleSubtask(task.id, subtaskId, !completed); await loadSubtasks(); }
    catch (e: any) { toast.error(e.message); }
  };

  const doDeleteSubtask = async (subtaskId: string) => {
    try { await deleteSubtask(task.id, subtaskId); await loadSubtasks(); }
    catch (e: any) { toast.error(e.message); }
  };

  // ── Task-level actions ────────────────────────────────────────────────────────
  const doUpdateStoryPoints = async () => {
    try {
      await updateTaskStoryPoints(task.id, storyPoints);
      toast.success('Story points updated');
      onRefresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const doStatusChange = async (status: string) => {
    try {
      await tasksApi.update(task.id, { status });
      toast.success(`Status changed to ${status.replace(/_/g, ' ')}`);
      onRefresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const subtaskProgress   = subtasks.length > 0
    ? Math.round((completedSubtasks / subtasks.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-card w-full max-w-[560px] h-full shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">

        {/* ── Header ── */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3 bg-card flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <StatusBadge status={task.priority} />
              <StatusBadge status={task.status || 'backlog'} />
              {task.type && <StatusBadge status={task.type} />}
            </div>
            <h2 className="text-base font-bold text-foreground leading-tight">{task.title}</h2>
            <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                {pname(task.product_id)}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {task.assignee_name || dname(task.assigned_to)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Due {fmtDate(task.due_date)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Story Points & Status ── */}
        <div className="px-5 py-3 border-b flex items-center gap-4 flex-shrink-0 bg-muted/30">
          <div className="flex items-center gap-2">
            <Label className="text-[11px] text-muted-foreground font-semibold">Story Points</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 5, 8, 13].map(sp => (
                <button
                  key={sp}
                  onClick={() => setStoryPoints(sp)}
                  className={cn(
                    'w-7 h-7 rounded-md text-xs font-bold transition-all cursor-pointer',
                    storyPoints === sp
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border hover:bg-muted text-foreground',
                  )}
                >
                  {sp}
                </button>
              ))}
            </div>
            {storyPoints !== (task.story_points || 0) && (
              <Button size="sm" variant="outline" onClick={doUpdateStoryPoints} className="text-[10px] h-7">
                Save
              </Button>
            )}
          </div>
          <div className="flex-1" />
          <select
            className="border rounded-md px-2 py-1.5 text-xs bg-background font-semibold"
            value={task.status || 'backlog'}
            onChange={e => doStatusChange(e.target.value)}
          >
            {['backlog', 'assigned', 'in_progress', 'review', 'done', 'cancelled'].map(o => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>

        {/* ── Subtask progress bar ── */}
        {subtasks.length > 0 && (
          <div className="px-5 py-2 border-b bg-muted/20 flex-shrink-0">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span className="font-semibold">Subtasks</span>
              <span>{completedSubtasks}/{subtasks.length} ({subtaskProgress}%)</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all" style={{ width: `${subtaskProgress}%` }} />
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="px-5 border-b flex gap-0 flex-shrink-0">
          {[
            { id: 'comments' as const,  label: 'Comments', icon: MessageSquare, count: comments.length },
            { id: 'subtasks' as const,  label: 'Subtasks', icon: ListChecks,    count: subtasks.length },
            { id: 'details' as const,   label: 'Details',  icon: Package,       count: 0 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span className="bg-muted text-muted-foreground text-[10px] px-1.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">

          {/* Comments tab */}
          {activeTab === 'comments' && (
            <div className="p-5 space-y-3">
              {comments.length === 0 && (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm font-medium">No comments yet</p>
                  <p className="text-xs">Start the conversation</p>
                </div>
              )}

              {comments.map(c => {
                // .NET returns author_name and user_id (UUID string)
                const authorName = c.author_name || c.author_email || 'Unknown';
                const isOwn = c.user_id?.toLowerCase() === user?.id?.toLowerCase();

                return (
                  <div key={c.id} className={cn('flex gap-2.5', isOwn && 'flex-row-reverse')}>
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold text-accent-foreground flex-shrink-0">
                      {initials(authorName)}
                    </div>

                    <div className={cn('flex-1 max-w-[80%]', isOwn && 'text-right')}>
                      <div
                        className="flex items-center gap-2 mb-0.5"
                        style={{ justifyContent: isOwn ? 'flex-end' : 'flex-start' }}
                      >
                        <span className="text-[11px] font-semibold text-foreground">{authorName}</span>
                        <span className="text-[10px] text-muted-foreground">{fmtDateTime(c.created_at)}</span>
                      </div>
                      <div className={cn(
                        'rounded-lg px-3 py-2 text-sm inline-block text-left',
                        isOwn ? 'bg-primary/10 text-foreground' : 'bg-muted text-foreground',
                      )}>
                        {c.content}
                      </div>
                      {isOwn && (
                        <button
                          onClick={() => doDeleteComment(c.id)}
                          className="text-[10px] text-muted-foreground hover:text-destructive mt-0.5 cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={commentsEndRef} />
            </div>
          )}

          {/* Subtasks tab */}
          {activeTab === 'subtasks' && (
            <div className="p-5 space-y-1.5">
              {subtasks.length === 0 && (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <ListChecks className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm font-medium">No subtasks</p>
                  <p className="text-xs">Break this task into smaller items</p>
                </div>
              )}

              {subtasks.map(s => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group"
                >
                  <button
                    onClick={() => doToggleSubtask(s.id, s.completed)}
                    className="cursor-pointer text-foreground"
                  >
                    {s.completed
                      ? <CheckSquare className="w-4 h-4 text-success" />
                      : <Square className="w-4 h-4 text-muted-foreground" />
                    }
                  </button>
                  <span className={cn('flex-1 text-sm', s.completed && 'line-through text-muted-foreground')}>
                    {s.title}
                  </span>
                  <button
                    onClick={() => doDeleteSubtask(s.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="Add subtask..."
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doAddSubtask()}
                  className="text-sm"
                />
                <Button size="sm" variant="outline" onClick={doAddSubtask} disabled={!newSubtask.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Details tab */}
          {activeTab === 'details' && (
            <div className="p-5 space-y-4">
              {task.description && (
                <div>
                  <Label className="text-[11px] text-muted-foreground font-semibold mb-1 block">Description</Label>
                  <p className="text-sm text-foreground leading-relaxed">{task.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Type',            value: task.type },
                  { label: 'Priority',        value: task.priority },
                  { label: 'Story Points',    value: task.story_points || 0 },
                  { label: 'Assignee',        value: task.assignee_name || dname(task.assigned_to) },
                  { label: 'Product',         value: task.product_name || pname(task.product_id) },
                  { label: 'Created',         value: fmtDateTime(task.created_at) },
                ].map((item, i) => (
                  <div key={i} className="bg-muted/30 rounded-md p-2.5">
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-0.5">
                      {item.label}
                    </div>
                    <div className="text-sm font-medium text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Comment input ── */}
        {activeTab === 'comments' && (
          <div className="px-5 py-3 border-t bg-card flex gap-2 flex-shrink-0">
            <Input
              placeholder="Write a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && doAddComment()}
              className="text-sm"
            />
            <Button onClick={doAddComment} disabled={sending || !newComment.trim()} size="sm">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
