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
 *  - updateComment(taskId, commentId, content)  (PUT /tasks/.../comments/...)
 *  - toggleSubtask(taskId, id, completed)  (was toggleSubtask(id, completed))
 *  - deleteSubtask(taskId, id)           (was deleteSubtask(id))
 */

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  listComments, addComment, updateComment, deleteComment,
  listSubtasks, addSubtask, toggleSubtask, deleteSubtask,
} from '@/lib/api-comments';
import { updateTaskStoryPoints } from '@/lib/api-sprints';
import { saveTask } from '@/lib/api';
import { tasksApi } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { SplmPermissions } from '@/constants/splm-rbac';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtDate, fmtDateTime, toHtmlDateInputValue } from '@/lib/splm-utils';
import { DateField } from '@/components/ui/date-field';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  X, Send, Trash2, Pencil, CheckSquare, Square, Plus,
  MessageSquare, ListChecks, Clock, User, Package, Sparkles,
} from 'lucide-react';
import { qaCyclesApi, taskAiApi, type QaCycleDto } from '@/lib/api-aisdlc';
import { SearchableSelect, optionsFromStrings } from '@/components/forms/SearchableSelect';

const DRAWER_TASK_STATUSES = ['backlog', 'assigned', 'in_progress', 'review', 'done', 'cancelled'] as const;
const EDIT_TASK_TYPES = ['bug_fix', 'feature', 'api_update', 'security', 'research', 'maintenance'] as const;
const EDIT_TASK_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

interface TaskDetailDrawerProps {
  task: any;
  products: any[];
  developers: any[];
  sprints: any[];
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
  task, products, developers, sprints, onClose, onRefresh,
}: TaskDetailDrawerProps) {
  const { user, can } = useAuth();
  const canEdit = can(SplmPermissions.Edit);

  const [comments, setComments]     = useState<any[]>([]);
  const [subtasks, setSubtasks]     = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [storyPoints, setStoryPoints] = useState(task.story_points || 0);
  const [sending, setSending]       = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft]   = useState('');
  const [activeTab, setActiveTab]   = useState<'details' | 'subtasks' | 'ai'>('details');
  const [saving, setSaving]         = useState(false);
  const [editDraft, setEditDraft]   = useState({
    title: task.title,
    description: task.description || '',
    product_id: task.product_id || '',
    type: task.type || 'feature',
    priority: task.priority || 'medium',
    status: (task.status || 'backlog') as string,
    due_date: toHtmlDateInputValue(task.due_date) as string,
    estimated_hours: task.estimated_hours ?? 4,
    story_points: task.story_points ?? 0,
    sprint_id: (task.sprint_id as string) || '',
    assigned_to: (task.assigned_to as string) || '',
  });
  const commentsEndRef              = useRef<HTMLDivElement>(null);
  const [qaCycles, setQaCycles]    = useState<QaCycleDto[]>([]);
  const [qaCycleId, setQaCycleId]   = useState<string>('');
  const [aiBusy, setAiBusy]         = useState<'analyze' | 'score' | null>(null);

  // Helpers that look up names from the passed-in props
  const pname = (id: string) => products.find(p => p.id === id)?.name || '—';
  const dname = (id: string) => developers.find(d => d.id === id)?.name || 'Unassigned';

  // ── Load comments + subtasks on mount / task change ──────────────────────────
  useEffect(() => {
    setEditingCommentId(null);
    setEditCommentDraft('');
    loadComments();
    loadSubtasks();
  }, [task.id]);

  useEffect(() => {
    setActiveTab('details');
    setStoryPoints(task.story_points || 0);
    setEditDraft({
      title: task.title,
      description: task.description || '',
      product_id: task.product_id || '',
      type: task.type || 'feature',
      priority: task.priority || 'medium',
      status: (task.status || 'backlog') as string,
      due_date: toHtmlDateInputValue(task.due_date) as string,
      estimated_hours: task.estimated_hours ?? 4,
      story_points: task.story_points ?? 0,
      sprint_id: (task.sprint_id as string) || '',
      assigned_to: (task.assigned_to as string) || '',
    });
  }, [task.id, task.updated_at]);

  useEffect(() => {
    if (!task.product_id) {
      setQaCycles([]);
      setQaCycleId('');
      return;
    }
    qaCyclesApi.getAll(task.product_id)
      .then((list) => {
        setQaCycles(list);
        const open = list.find((c) => c.status === 'open' || c.status === 'in_review');
        setQaCycleId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev;
          return open?.id ?? '';
        });
      })
      .catch(() => setQaCycles([]));
  }, [task.product_id]);

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

  const doUpdateComment = async (commentId: string) => {
    const t = editCommentDraft.trim();
    if (!t) return;
    try {
      await updateComment(task.id, commentId, t);
      setEditingCommentId(null);
      setEditCommentDraft('');
      await loadComments();
    } catch (e: any) { toast.error(e.message); }
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

  const drawerStatusOptions = useMemo(() => optionsFromStrings([...DRAWER_TASK_STATUSES]), []);
  const editTypeOptions = useMemo(() => optionsFromStrings([...EDIT_TASK_TYPES]), []);
  const editPriorityOptions = useMemo(() => optionsFromStrings([...EDIT_TASK_PRIORITIES]), []);
  const formProductOptions = useMemo(
    () => [{ value: '', label: 'Select…' }, ...products.map((p: any) => ({ value: p.id, label: p.name }))],
    [products],
  );
  const sprintOptions = useMemo(
    () => [{ value: '', label: 'No Sprint' }, ...sprints.map((s: any) => ({ value: s.id, label: s.name }))],
    [sprints],
  );
  const assignOptions = useMemo(
    () => [{ value: '', label: 'Unassigned' }, ...developers.map((d: any) => ({ value: d.id, label: d.name }))],
    [developers],
  );
  const drawerQaCycleOptions = useMemo(
    () => [
      { value: '', label: 'Auto-select open cycle' },
      ...qaCycles.map((c) => ({
        value: c.id,
        label: `${c.product_name} · v${c.version_label} (#${c.cycle_number}) — ${c.status}`,
      })),
    ],
    [qaCycles],
  );

  const isEditDirty = useMemo(() => {
    if (!canEdit) return false;
    const base = {
      title: (task.title || '').trim(),
      description: task.description || '',
      product_id: task.product_id || '',
      type: task.type || 'feature',
      priority: task.priority || 'medium',
      status: (task.status || 'backlog') as string,
      due_date: toHtmlDateInputValue(task.due_date) as string,
      estimated_hours: task.estimated_hours ?? 4,
      story_points: task.story_points ?? 0,
      sprint_id: (task.sprint_id as string) || '',
      assigned_to: (task.assigned_to as string) || '',
    };
    return (
      (editDraft.title || '').trim() !== base.title
      || (editDraft.description || '') !== base.description
      || editDraft.product_id !== base.product_id
      || editDraft.type !== base.type
      || editDraft.priority !== base.priority
      || editDraft.status !== base.status
      || (editDraft.due_date || '') !== (base.due_date || '')
      || Number(editDraft.estimated_hours) !== Number(base.estimated_hours)
      || Number(editDraft.story_points) !== Number(base.story_points)
      || (editDraft.sprint_id || '') !== base.sprint_id
      || (editDraft.assigned_to || '') !== base.assigned_to
    );
  }, [canEdit, task, editDraft]);

  const doSaveTask = useCallback(async () => {
    if (!editDraft.title?.trim() || !editDraft.product_id) {
      toast.error('Title and product are required');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        id: task.id,
        title: editDraft.title.trim(),
        description: editDraft.description || '',
        product_id: editDraft.product_id,
        type: editDraft.type,
        priority: editDraft.priority,
        status: editDraft.status,
        due_date: editDraft.due_date || null,
        estimated_hours: editDraft.estimated_hours,
        story_points: editDraft.story_points,
        sprint_id: editDraft.sprint_id || null,
        assigned_to: editDraft.assigned_to || null,
      };
      await saveTask(payload);
      toast.success('Task updated');
      await onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [task.id, editDraft, onRefresh]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full max-h-[100dvh] w-full min-w-0 max-w-full flex-col overflow-hidden border-l border-border bg-card shadow-2xl animate-slide-in-right sm:max-w-[560px]">

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
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b bg-muted/30 px-5 py-3 sm:gap-4">
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
          <div className="min-w-[9rem] max-w-[11rem]">
            <SearchableSelect
              size="xs"
              triggerClassName="h-8 text-xs font-semibold"
              options={drawerStatusOptions}
              value={task.status || 'backlog'}
              onValueChange={doStatusChange}
              searchPlaceholder="Status…"
              aria-label="Change task status"
            />
          </div>
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
        <div className="flex min-w-0 flex-shrink-0 gap-0 overflow-x-auto border-b px-5 scrollbar-thin">
          {[
            { id: 'details' as const,  label: 'Details',  icon: Package,       count: 0 },
            { id: 'subtasks' as const, label: 'Subtasks', icon: ListChecks,   count: subtasks.length },
            { id: 'ai' as const,       label: 'AI',       icon: Sparkles,     count: 0 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
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
          {activeTab === 'details' && (
            <div className="p-5">
              {canEdit ? (
                <div className="space-y-3 border-b border-border/80 pb-5">
                  <div>
                    <Label className="text-xs">Title *</Label>
                    <Input
                      className="mt-1.5"
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Product *</Label>
                      <div className="mt-1.5">
                        <SearchableSelect
                          options={formProductOptions}
                          value={editDraft.product_id}
                          onValueChange={(v) => setEditDraft((d) => ({ ...d, product_id: v }))}
                          placeholder="Select…"
                          searchPlaceholder="Search products…"
                          contentWidth="wide"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <div className="mt-1.5">
                        <SearchableSelect
                          options={editTypeOptions}
                          value={editDraft.type}
                          onValueChange={(v) => setEditDraft((d) => ({ ...d, type: v }))}
                          searchPlaceholder="Types…"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Priority</Label>
                      <div className="mt-1.5">
                        <SearchableSelect
                          options={editPriorityOptions}
                          value={editDraft.priority}
                          onValueChange={(v) => setEditDraft((d) => ({ ...d, priority: v }))}
                          searchPlaceholder="Priority…"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <div className="mt-1.5">
                        <SearchableSelect
                          options={drawerStatusOptions}
                          value={editDraft.status}
                          onValueChange={(v) => setEditDraft((d) => ({ ...d, status: v }))}
                          searchPlaceholder="Status…"
                        />
                      </div>
                    </div>
                    <DateField
                      label="Due date"
                      value={editDraft.due_date}
                      onChange={(v) => setEditDraft((d) => ({ ...d, due_date: v }))}
                    />
                    <div>
                      <Label className="text-xs">Estimated hours</Label>
                      <Input
                        type="number"
                        className="mt-1.5"
                        min={1}
                        value={editDraft.estimated_hours}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, estimated_hours: parseInt(e.target.value, 10) || 0 }))
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Story points</Label>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {[0, 1, 2, 3, 5, 8, 13].map((sp) => (
                          <button
                            key={sp}
                            type="button"
                            onClick={() => setEditDraft((d) => ({ ...d, story_points: sp }))}
                            className={cn(
                              'h-8 w-8 rounded-md text-xs font-bold transition-all',
                              editDraft.story_points === sp
                                ? 'bg-primary text-primary-foreground'
                                : 'border border-border bg-card text-foreground hover:bg-muted',
                            )}
                          >
                            {sp}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Sprint</Label>
                      <div className="mt-1.5">
                        <SearchableSelect
                          options={sprintOptions}
                          value={editDraft.sprint_id}
                          onValueChange={(v) => setEditDraft((d) => ({ ...d, sprint_id: v || '' }))}
                          placeholder="No sprint"
                          searchPlaceholder="Sprints…"
                          contentWidth="wide"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Assign to</Label>
                      <div className="mt-1.5">
                        <SearchableSelect
                          options={assignOptions}
                          value={editDraft.assigned_to}
                          onValueChange={(v) => setEditDraft((d) => ({ ...d, assigned_to: v || '' }))}
                          placeholder="Unassigned"
                          searchPlaceholder="People…"
                          contentWidth="wide"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      className="mt-1.5 min-h-[88px]"
                      value={editDraft.description}
                      onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" onClick={doSaveTask} disabled={saving || !isEditDirty} size="sm">
                      {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditDraft({
                          title: task.title,
                          description: task.description || '',
                          product_id: task.product_id || '',
                          type: task.type || 'feature',
                          priority: task.priority || 'medium',
                          status: (task.status || 'backlog') as string,
                          due_date: toHtmlDateInputValue(task.due_date) as string,
                          estimated_hours: task.estimated_hours ?? 4,
                          story_points: task.story_points ?? 0,
                          sprint_id: (task.sprint_id as string) || '',
                          assigned_to: (task.assigned_to as string) || '',
                        });
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 border-b border-border/80 pb-5">
                  {task.description && (
                    <div>
                      <Label className="text-[11px] text-muted-foreground font-semibold mb-1 block">Description</Label>
                      <p className="text-sm text-foreground leading-relaxed">{task.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { label: 'Type', value: task.type },
                      { label: 'Priority', value: task.priority },
                      { label: 'Story points', value: task.story_points || 0 },
                      { label: 'AI priority', value: Number(task.ai_priority_score ?? 0).toFixed(1) },
                      { label: 'Assignee', value: task.assignee_name || dname(task.assigned_to) },
                      { label: 'Product', value: task.product_name || pname(task.product_id) },
                      { label: 'Created', value: fmtDateTime(task.created_at) },
                    ].map((item, i) => (
                      <div key={i} className="bg-muted/30 rounded-md p-2.5">
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-0.5">
                          {item.label}
                        </div>
                        <div className="text-sm font-medium text-foreground">{String(item.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Comments</h3>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{comments.length}</span>
                </div>
                {comments.length === 0 && (
                  <div className="mb-4 flex flex-col items-center py-6 text-muted-foreground">
                    <MessageSquare className="mb-2 h-7 w-7 opacity-40" />
                    <p className="text-sm font-medium">No comments yet</p>
                    <p className="text-xs">Scroll to add a comment below</p>
                  </div>
                )}
                <div className="space-y-3">
                  {comments.map((c) => {
                    const authorName = c.author_name || c.author_email || 'Unknown';
                    const isOwn = c.user_id?.toLowerCase() === user?.id?.toLowerCase();
                    return (
                      <div key={c.id} className={cn('flex gap-2.5', isOwn && 'flex-row-reverse')}>
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                          {initials(authorName)}
                        </div>
                        <div className={cn('max-w-[80%] flex-1', isOwn && 'text-right')}>
                          <div
                            className="mb-0.5 flex items-center gap-2"
                            style={{ justifyContent: isOwn ? 'flex-end' : 'flex-start' }}
                          >
                            <span className="text-[11px] font-semibold text-foreground">{authorName}</span>
                            <span className="text-[10px] text-muted-foreground">{fmtDateTime(c.created_at)}</span>
                          </div>
                          {isOwn && editingCommentId === c.id ? (
                            <div className="space-y-2 text-left">
                              <Textarea
                                value={editCommentDraft}
                                onChange={(e) => setEditCommentDraft(e.target.value)}
                                className="min-h-[72px] text-sm"
                                rows={3}
                              />
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setEditingCommentId(null); setEditCommentDraft(''); }}
                                  className="text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Cancel
                                </button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={!editCommentDraft.trim()}
                                  onClick={() => doUpdateComment(c.id)}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div
                                className={cn(
                                  'inline-block rounded-lg px-3 py-2 text-left text-sm whitespace-pre-wrap',
                                  isOwn ? 'bg-primary/10 text-foreground' : 'bg-muted text-foreground',
                                )}
                              >
                                {c.content}
                              </div>
                              {isOwn && (
                                <div
                                  className="mt-0.5 flex items-center gap-3"
                                  style={{ justifyContent: isOwn ? 'flex-end' : 'flex-start' }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => { setEditingCommentId(c.id); setEditCommentDraft(c.content || ''); }}
                                    className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => doDeleteComment(c.id)}
                                    className="text-[10px] text-muted-foreground hover:text-destructive"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div ref={commentsEndRef} />
                <div className="mt-4 flex gap-2 border-t border-border/60 pt-4">
                  <Input
                    placeholder="Write a comment…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && doAddComment()}
                    className="text-sm"
                  />
                  <Button onClick={doAddComment} disabled={sending || !newComment.trim()} size="sm" type="button">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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

          {activeTab === 'ai' && (
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Run task-scoped analysis (saved as an analyzer report for the selected QA cycle) or refresh the AI priority score using the same rules as sprint bulk scoring.
              </p>
              <div>
                <Label className="text-xs">QA cycle (optional — defaults to latest open cycle)</Label>
                <div className="mt-1">
                  <SearchableSelect
                    options={drawerQaCycleOptions}
                    value={qaCycleId}
                    onValueChange={setQaCycleId}
                    placeholder="Auto-select open cycle"
                    searchPlaceholder="Search QA cycles…"
                    contentWidth="wide"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!!aiBusy}
                  onClick={async () => {
                    setAiBusy('analyze');
                    try {
                      const body = qaCycleId ? { qa_cycle_id: qaCycleId } : undefined;
                      await taskAiApi.analyzeTask(task.id, body);
                      toast.success('Task analysis completed');
                      onRefresh();
                    } catch (e: any) {
                      toast.error(e.message || 'Analysis failed');
                    } finally {
                      setAiBusy(null);
                    }
                  }}
                >
                  {aiBusy === 'analyze' ? 'Analyzing…' : 'Run AI analysis'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!aiBusy}
                  onClick={async () => {
                    setAiBusy('score');
                    try {
                      await taskAiApi.scoreTaskPriority(task.id);
                      toast.success('Priority score updated');
                      onRefresh();
                    } catch (e: any) {
                      toast.error(e.message || 'Scoring failed');
                    } finally {
                      setAiBusy(null);
                    }
                  }}
                >
                  {aiBusy === 'score' ? 'Scoring…' : 'Score priority'}
                </Button>
              </div>
              <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">Current AI score:</span>{' '}
                  <span className="font-semibold">{Number(task.ai_priority_score ?? 0).toFixed(1)}</span> / 100
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
