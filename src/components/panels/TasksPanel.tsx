import { useEffect, useState, useMemo } from 'react';
import { listTasksPage, saveTask, deleteTask, listProductsPage, listDevelopers, updateTaskStatus } from '@/lib/api';
import { listSprints } from '@/lib/api-sprints';
import { DEFAULT_LIST_PAGE_SIZE, ListPageSearchInput, ListPaginationBar, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtDate, toHtmlDateInputValue, readTasksViewModeForSession, writeTasksViewModeForSession } from '@/lib/splm-utils';
import { DateField } from '@/components/ui/date-field';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { toast } from 'sonner';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import KanbanBoard from '@/components/panels/KanbanBoard';
import TaskDetailDrawer from '@/components/panels/TaskDetailDrawer';
import { SearchableSelect, optionsFromStrings } from '@/components/forms/SearchableSelect';

/** Board uses a larger page than list so each swimlane has enough cards; both views paginate server-side. */
const BOARD_PAGE_SIZE = 50;

const TASK_STATUSES = ['backlog', 'assigned', 'in_progress', 'review', 'done', 'cancelled'] as const;
const TASK_TYPES = ['bug_fix', 'feature', 'api_update', 'security', 'research', 'maintenance'] as const;
const TASK_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export default function TasksPanel() {
  const { can } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [fS, setFS] = useState('');
  const [fP, setFP] = useState('');
  const [taskPage, setTaskPage] = useState(1);
  const [boardPage, setBoardPage] = useState(1);
  const [taskTotalCount, setTaskTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(readTasksViewModeForSession);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [searchQ, setSearchQ] = useState('');
  const debouncedTaskSearch = useListPageSearchDebounce(searchQ);

  const loadMeta = async () => {
    try {
      const [pRes, devs, s] = await Promise.all([
        listProductsPage({ page: 1, pageSize: 100, sortBy: 'updated_at', sortDir: 'desc' }),
        listDevelopers(),
        listSprints(),
      ]);
      setProducts(pRes.items);
      setDevelopers(devs);
      setSprints(s);
    } catch (e: any) {
      toast.error('Failed to load references: ' + e.message);
    }
  };

  /** Products / developers / sprints load async on mount — avoid opening the task form before they arrive (empty Assign To). */
  const refreshMetaThen = async (fn: () => void) => {
    await loadMeta();
    fn();
  };

  /** Returns the fresh tasks array for the current page/filters (avoids stale closure in drawer). */
  const loadTasks = async (): Promise<any[]> => {
    setLoading(true);
    try {
      const isKanban = viewMode === 'kanban';
      const pageSize = isKanban ? BOARD_PAGE_SIZE : DEFAULT_LIST_PAGE_SIZE;
      const page = isKanban ? boardPage : taskPage;
      const r = await listTasksPage({
        page,
        pageSize,
        status: fS || undefined,
        product_id: fP || undefined,
        search: debouncedTaskSearch || undefined,
      });
      setTasks(r.items);
      const total = Number(r.total_count) || 0;
      setTaskTotalCount(total);
      return r.items;
    } catch (e: any) {
      toast.error('Failed to load tasks: ' + e.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    setTaskPage(1);
    setBoardPage(1);
  }, [fS, fP, debouncedTaskSearch]);

  const listTotalPages = Math.max(1, Math.ceil(taskTotalCount / DEFAULT_LIST_PAGE_SIZE));
  const boardTotalPages = Math.max(1, Math.ceil(taskTotalCount / BOARD_PAGE_SIZE));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const isKanban = viewMode === 'kanban';
        const pageSize = isKanban ? BOARD_PAGE_SIZE : DEFAULT_LIST_PAGE_SIZE;
        const page = isKanban ? boardPage : taskPage;
        const r = await listTasksPage({
          page,
          pageSize,
          status: fS || undefined,
          product_id: fP || undefined,
          search: debouncedTaskSearch || undefined,
        });
        if (cancelled) return;
        const total = Number(r.total_count) || 0;
        if (viewMode === 'list' && total > 0) {
          const maxPage = Math.max(1, Math.ceil(total / DEFAULT_LIST_PAGE_SIZE));
          if (taskPage > maxPage) {
            setTaskPage(maxPage);
            return;
          }
        }
        if (viewMode === 'kanban' && total > 0) {
          const maxBoard = Math.max(1, Math.ceil(total / BOARD_PAGE_SIZE));
          if (boardPage > maxBoard) {
            setBoardPage(maxBoard);
            return;
          }
        }
        setTasks(r.items);
        setTaskTotalCount(total);
      } catch (e: any) {
        if (!cancelled) toast.error('Failed to load tasks: ' + e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [taskPage, boardPage, fS, fP, debouncedTaskSearch, viewMode]);

  const toggleView = (mode: 'list' | 'kanban') => {
    setViewMode(mode);
    writeTasksViewModeForSession(mode);
  };

  const blank = { title: '', description: '', type: 'feature', priority: 'medium', status: 'backlog', product_id: '', due_date: '', estimated_hours: 4, story_points: 0, sprint_id: '', source: 'manual' };
  const pname = (id: string) => products.find(p => p.id === id)?.name || '—';
  const dname = (id: string) => developers.find(d => d.id === id)?.name || 'Unassigned';

  const taskStatusOptions = useMemo(
    () => [{ value: '', label: 'All Statuses' }, ...optionsFromStrings([...TASK_STATUSES])],
    [],
  );
  const taskStatusFormOptions = useMemo(() => optionsFromStrings([...TASK_STATUSES]), []);
  const taskTypeOptions = useMemo(() => optionsFromStrings([...TASK_TYPES]), []);
  const taskPriorityOptions = useMemo(() => optionsFromStrings([...TASK_PRIORITIES]), []);
  const filterProductOptions = useMemo(
    () => [{ value: '', label: 'All Products' }, ...products.map((p: any) => ({ value: p.id, label: p.name }))],
    [products],
  );
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

  const doSave = async () => {
    if (!form.title || !form.product_id) return toast.error('Title and product are required');
    setSaving(true);
    const toSave = { ...form };
    if (!toSave.sprint_id) toSave.sprint_id = null;
    try { await saveTask(toSave); toast.success(form.id ? 'Task updated' : 'Task created'); await loadTasks(); setForm(null); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const doStatusChange = async (id: string, status: string) => {
    try { await updateTaskStatus(id, status); toast.success(`Status updated to ${status.replace(/_/g, ' ')}`); await loadTasks(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (form) return (
    <div className="bg-card rounded-lg border p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-primary">{form.id ? 'Edit Task' : 'New Task'}</h3>
        <Button variant="outline" onClick={() => setForm(null)}>← Back</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="md:col-span-2"><Label>Title *</Label><Input value={form.title || ''} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} /></div>
        <div><Label>Product *</Label><div className="mt-1"><SearchableSelect options={formProductOptions} value={form.product_id || ''} onValueChange={(v) => setForm((f: any) => ({ ...f, product_id: v }))} placeholder="Select…" searchPlaceholder="Search products…" contentWidth="wide" /></div></div>
        <div><Label>Type</Label><div className="mt-1"><SearchableSelect options={taskTypeOptions} value={form.type} onValueChange={(v) => setForm((f: any) => ({ ...f, type: v }))} searchPlaceholder="Search types…" /></div></div>
        <div><Label>Priority</Label><div className="mt-1"><SearchableSelect options={taskPriorityOptions} value={form.priority} onValueChange={(v) => setForm((f: any) => ({ ...f, priority: v }))} searchPlaceholder="Search priority…" /></div></div>
        <div><Label>Status</Label><div className="mt-1"><SearchableSelect options={taskStatusFormOptions} value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))} searchPlaceholder="Search status…" /></div></div>
        <DateField
          label="Due Date"
          value={toHtmlDateInputValue(form.due_date)}
          onChange={(v) => setForm((f: any) => ({ ...f, due_date: v }))}
          helperText="Optional. Leave empty for no due date."
        />
        <div><Label>Estimated Hours</Label><Input type="number" min={1} value={form.estimated_hours || 4} onChange={e => setForm((f: any) => ({ ...f, estimated_hours: parseInt(e.target.value) || 4 }))} /></div>
        <div><Label>Story Points</Label>
          <div className="flex gap-1 mt-1">
            {[0, 1, 2, 3, 5, 8, 13].map(sp => (
              <button key={sp} onClick={() => setForm((f: any) => ({ ...f, story_points: sp }))}
                className={cn('w-8 h-8 rounded-md text-xs font-bold transition-all cursor-pointer',
                  form.story_points === sp ? 'bg-primary text-primary-foreground' : 'bg-muted border text-foreground hover:bg-muted/80')}>
                {sp}
              </button>
            ))}
          </div>
        </div>
        <div><Label>Sprint</Label><div className="mt-1"><SearchableSelect options={sprintOptions} value={form.sprint_id || ''} onValueChange={(v) => setForm((f: any) => ({ ...f, sprint_id: v || null }))} placeholder="No Sprint" searchPlaceholder="Search sprints…" contentWidth="wide" /></div></div>
        <div><Label>Assign To</Label><div className="mt-1"><SearchableSelect options={assignOptions} value={form.assigned_to || ''} onValueChange={(v) => setForm((f: any) => ({ ...f, assigned_to: v || null }))} placeholder="Unassigned" searchPlaceholder="Search people…" contentWidth="wide" /></div></div>
        <div className="md:col-span-2"><Label>Description</Label><textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] bg-background" value={form.description || ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
      </div>
      <div className="flex gap-2"><Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
    </div>
  );

  return (
    <div className="animate-fade-in min-h-0 min-w-0 space-y-0">
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          products={products}
          developers={developers}
          sprints={sprints}
          onClose={() => setSelectedTask(null)}
          onRefresh={async () => {
            // load() returns fresh tasks — avoids the stale closure bug
            const freshTasks = await loadTasks();
            const updated = freshTasks.find((t: any) => t.id === selectedTask.id);
            if (updated) setSelectedTask(updated);
          }}
        />
      )}
      <SplmPageHeader
        title="Tasks"
        subtitle="Triage work in list or board view. Filter by status, product, and search."
        actions={
          <>
            <div className="flex border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggleView('kanban')}
                className={cn(
                  'px-2.5 py-1.5 text-xs flex items-center gap-1 cursor-pointer transition-colors',
                  viewMode === 'kanban'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Board
              </button>
              <button
                type="button"
                onClick={() => toggleView('list')}
                className={cn(
                  'px-2.5 py-1.5 text-xs flex items-center gap-1 cursor-pointer transition-colors',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
            </div>
            {can('edit') && (
              <Button onClick={() => refreshMetaThen(() => setForm({ ...blank }))}>+ New Task</Button>
            )}
          </>
        }
      />
      {/* Single listing card: filters + content + footer share width so pagination aligns with rows (inset bar). */}
      <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ListPageSearchInput value={searchQ} onChange={setSearchQ} className="w-36 sm:w-44" />
          <SearchableSelect
            className="min-w-[10rem] max-w-[12rem]"
            size="sm"
            triggerClassName="w-full"
            options={taskStatusOptions}
            value={fS}
            onValueChange={setFS}
            placeholder="All Statuses"
            searchPlaceholder="Search status…"
          />
          <SearchableSelect
            className="min-w-[10rem] max-w-[14rem]"
            size="sm"
            triggerClassName="w-full"
            options={filterProductOptions}
            value={fP}
            onValueChange={setFP}
            placeholder="All Products"
            searchPlaceholder="Search products…"
            contentWidth="wide"
          />
          {!loading && taskTotalCount > 0 && (
            <span className="text-xs text-muted-foreground sm:ml-auto tabular-nums">
              {tasks.length} of {taskTotalCount.toLocaleString()} on this page
            </span>
          )}
        </div>
        {loading ? <TableSkeleton /> :
          tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <span className="text-4xl mb-3">✅</span>
              <p className="font-medium">No tasks found</p>
              <p className="text-xs mt-1">Create tasks to track work items</p>
            </div>
          ) : viewMode === 'kanban' ? (
            <KanbanBoard
              tasks={tasks}
              products={products}
              developers={developers}
              onRefresh={loadTasks}
              onTaskClick={(t) => refreshMetaThen(() => setSelectedTask(t))}
            />
          ) : (
            <div className="space-y-2">
              {tasks.map(t => (
                <div
                  key={t.id}
                  className="bg-muted/30 border rounded-lg p-4 flex justify-between items-start gap-4 hover:bg-muted/50 transition-colors group cursor-pointer"
                  onClick={() => refreshMetaThen(() => setSelectedTask(t))}
                >
                  <div className="flex-1">
                    <div className="flex gap-2 items-center flex-wrap mb-1">
                      <span className="font-semibold text-sm">{t.title}</span>
                      <StatusBadge status={t.priority} />
                      <StatusBadge status={t.status || 'backlog'} />
                      {t.story_points > 0 && (
                        <span className="bg-secondary text-primary text-[10px] font-bold px-1.5 py-0.5 rounded">{t.story_points} SP</span>
                      )}
                      {Number(t.ai_priority_score) > 0 && (
                        <span className="bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded border border-primary/30" title="AI priority score">
                          AI {Number(t.ai_priority_score).toFixed(0)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pname(t.product_id)} · {dname(t.assigned_to)} · {t.estimated_hours}h · Due {fmtDate(t.due_date)}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {t.status !== 'done' && (
                      <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} className="min-w-[9rem] max-w-[11rem]">
                        <SearchableSelect
                          size="xs"
                          triggerClassName="h-8 text-xs"
                          options={taskStatusFormOptions}
                          value={t.status || 'backlog'}
                          onValueChange={(v) => doStatusChange(t.id, v)}
                          searchPlaceholder="Status…"
                          aria-label="Change task status"
                        />
                      </div>
                    )}
                    {can('edit') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          refreshMetaThen(() =>
                            setForm({
                              ...t,
                              due_date: toHtmlDateInputValue(t.due_date),
                            })
                          )
                        }
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }
        {!loading && viewMode === 'list' && taskTotalCount > 0 && (
          <ListPaginationBar
            variant="inset"
            page={taskPage}
            totalPages={listTotalPages}
            totalItems={taskTotalCount}
            pageSize={DEFAULT_LIST_PAGE_SIZE}
            onPageChange={setTaskPage}
            disabled={loading}
          />
        )}
        {!loading && viewMode === 'list' && taskTotalCount > DEFAULT_LIST_PAGE_SIZE && (
          <p className="border-t border-border/80 bg-muted/10 px-4 py-2 text-xs text-muted-foreground">
            List shows {DEFAULT_LIST_PAGE_SIZE} tasks per page. Use filters to narrow results.
          </p>
        )}
        {!loading && viewMode === 'kanban' && taskTotalCount > 0 && (
          <ListPaginationBar
            variant="inset"
            page={boardPage}
            totalPages={boardTotalPages}
            totalItems={taskTotalCount}
            pageSize={BOARD_PAGE_SIZE}
            onPageChange={setBoardPage}
            disabled={loading}
          />
        )}
        {!loading && viewMode === 'kanban' && taskTotalCount > BOARD_PAGE_SIZE && (
          <p className="border-t border-border/80 bg-muted/10 px-4 py-2 text-xs text-muted-foreground">
            Board shows {BOARD_PAGE_SIZE} tasks per page across all columns. Use pagination or filters to see the rest.
          </p>
        )}
      </div>
    </div>
  );
}
