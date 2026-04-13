import { useEffect, useState } from 'react';
import { listTasksPage, saveTask, deleteTask, listProductsPage, listDevelopersPage, updateTaskStatus } from '@/lib/api';
import { listSprints } from '@/lib/api-sprints';
import { DEFAULT_LIST_PAGE_SIZE, ListPageSearchInput, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtDate } from '@/lib/splm-utils';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { toast } from 'sonner';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import KanbanBoard from '@/components/panels/KanbanBoard';
import TaskDetailDrawer from '@/components/panels/TaskDetailDrawer';

/** Board loads one large page so columns are useful; list view stays at DEFAULT_LIST_PAGE_SIZE. */
const KANBAN_TASK_FETCH_SIZE = 200;

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
  const [taskTotalCount, setTaskTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => (localStorage.getItem('splm-task-view') as any) || 'list');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [searchQ, setSearchQ] = useState('');
  const debouncedTaskSearch = useListPageSearchDebounce(searchQ);

  const loadMeta = async () => {
    try {
      const [pRes, dRes, s] = await Promise.all([
        listProductsPage({ page: 1, pageSize: 100, sortBy: 'updated_at', sortDir: 'desc' }),
        listDevelopersPage({ page: 1, pageSize: 100, sortBy: 'name', sortDir: 'asc' }),
        listSprints(),
      ]);
      setProducts(pRes.items);
      setDevelopers(dRes.items);
      setSprints(s);
    } catch (e: any) {
      toast.error('Failed to load references: ' + e.message);
    }
  };

  /** Returns the fresh tasks array for the current page/filters (avoids stale closure in drawer). */
  const loadTasks = async (): Promise<any[]> => {
    setLoading(true);
    try {
      const isKanban = viewMode === 'kanban';
      const pageSize = isKanban ? KANBAN_TASK_FETCH_SIZE : DEFAULT_LIST_PAGE_SIZE;
      const page = isKanban ? 1 : taskPage;
      const r = await listTasksPage({
        page,
        pageSize,
        status: fS || undefined,
        product_id: fP || undefined,
        search: debouncedTaskSearch || undefined,
      });
      setTasks(r.items);
      setTaskTotalCount(r.total_count ?? r.items.length);
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
  }, [fS, fP, debouncedTaskSearch]);

  const listTotalPages = Math.max(1, Math.ceil(taskTotalCount / DEFAULT_LIST_PAGE_SIZE));

  useEffect(() => {
    if (viewMode === 'list' && taskTotalCount > 0) {
      const maxPage = Math.max(1, Math.ceil(taskTotalCount / DEFAULT_LIST_PAGE_SIZE));
      if (taskPage > maxPage) {
        setTaskPage(maxPage);
        return;
      }
    }
    void loadTasks();
  }, [taskPage, fS, fP, debouncedTaskSearch, viewMode]);

  const toggleView = (mode: 'list' | 'kanban') => {
    setViewMode(mode);
    localStorage.setItem('splm-task-view', mode);
  };

  const blank = { title: '', description: '', type: 'feature', priority: 'medium', status: 'backlog', product_id: '', due_date: '', estimated_hours: 4, story_points: 0, sprint_id: '', source: 'manual' };
  const pname = (id: string) => products.find(p => p.id === id)?.name || '—';
  const dname = (id: string) => developers.find(d => d.id === id)?.name || 'Unassigned';

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
        <div><Label>Product *</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.product_id || ''} onChange={e => setForm((f: any) => ({ ...f, product_id: e.target.value }))}><option value="">Select…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><Label>Type</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))}>{['bug_fix', 'feature', 'api_update', 'security', 'research', 'maintenance'].map(o => <option key={o}>{o}</option>)}</select></div>
        <div><Label>Priority</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.priority} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))}>{['critical', 'high', 'medium', 'low'].map(o => <option key={o}>{o}</option>)}</select></div>
        <div><Label>Status</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>{['backlog', 'assigned', 'in_progress', 'review', 'done', 'cancelled'].map(o => <option key={o}>{o}</option>)}</select></div>
        <div><Label>Due Date</Label><Input type="date" value={form.due_date || ''} onChange={e => setForm((f: any) => ({ ...f, due_date: e.target.value }))} /></div>
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
        <div><Label>Sprint</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.sprint_id || ''} onChange={e => setForm((f: any) => ({ ...f, sprint_id: e.target.value || null }))}><option value="">No Sprint</option>{sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><Label>Assign To</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.assigned_to || ''} onChange={e => setForm((f: any) => ({ ...f, assigned_to: e.target.value || null }))}><option value="">Unassigned</option>{developers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="md:col-span-2"><Label>Description</Label><textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] bg-background" value={form.description || ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
      </div>
      <div className="flex gap-2"><Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          products={products}
          developers={developers}
          onClose={() => setSelectedTask(null)}
          onRefresh={async () => {
            // load() returns fresh tasks — avoids the stale closure bug
            const freshTasks = await loadTasks();
            const updated = freshTasks.find((t: any) => t.id === selectedTask.id);
            if (updated) setSelectedTask(updated);
          }}
        />
      )}
      <div className="bg-card rounded-lg border p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-primary">
            ✅ Tasks
            <span className="text-muted-foreground font-normal text-sm ml-2">
              ({tasks.length} of {taskTotalCount.toLocaleString()})
            </span>
          </h3>
          <div className="flex gap-2 flex-wrap items-center">
            {/* View toggle */}
            <div className="flex border rounded-md overflow-hidden">
              <button onClick={() => toggleView('list')}
                className={cn('px-2.5 py-1.5 text-xs flex items-center gap-1 cursor-pointer transition-colors',
                  viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}>
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button onClick={() => toggleView('kanban')}
                className={cn('px-2.5 py-1.5 text-xs flex items-center gap-1 cursor-pointer transition-colors',
                  viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}>
                <LayoutGrid className="w-3.5 h-3.5" /> Board
              </button>
            </div>
            <ListPageSearchInput value={searchQ} onChange={setSearchQ} className="w-36 sm:w-44" />
            <select className="border rounded-md px-3 py-2 text-sm bg-background" value={fS} onChange={e => setFS(e.target.value)}><option value="">All Statuses</option>{['backlog', 'assigned', 'in_progress', 'review', 'done', 'cancelled'].map(o => <option key={o}>{o}</option>)}</select>
            <select className="border rounded-md px-3 py-2 text-sm bg-background" value={fP} onChange={e => setFP(e.target.value)}><option value="">All Products</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {can('edit') && <Button onClick={() => setForm({ ...blank })}>+ New Task</Button>}
          </div>
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
              onTaskClick={setSelectedTask}
            />
          ) : (
            <div className="space-y-2">
              {tasks.map(t => (
                <div
                  key={t.id}
                  className="bg-muted/30 border rounded-lg p-4 flex justify-between items-start gap-4 hover:bg-muted/50 transition-colors group cursor-pointer"
                  onClick={() => setSelectedTask(t)}
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
                      <select className="border rounded text-xs px-2 py-1 bg-background" value={t.status || 'backlog'} onChange={e => doStatusChange(t.id, e.target.value)}>
                        {['backlog', 'assigned', 'in_progress', 'review', 'done', 'cancelled'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    )}
                    {can('edit') && <Button size="sm" variant="outline" onClick={() => setForm(t)}>Edit</Button>}
                  </div>
                </div>
              ))}
            </div>
          )
        }
        {!loading && viewMode === 'list' && listTotalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm">
            <span className="text-muted-foreground">
              Page {taskPage} of {listTotalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={taskPage <= 1} onClick={() => setTaskPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={taskPage >= listTotalPages} onClick={() => setTaskPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
        {!loading && viewMode === 'list' && taskTotalCount > DEFAULT_LIST_PAGE_SIZE && (
          <p className="text-xs text-muted-foreground mt-2">
            List shows {DEFAULT_LIST_PAGE_SIZE} tasks per page. Use filters to narrow results.
          </p>
        )}
        {!loading && viewMode === 'kanban' && taskTotalCount > tasks.length && (
          <p className="text-xs text-muted-foreground mt-2">
            Board loads up to {KANBAN_TASK_FETCH_SIZE} tasks per filter ({tasks.length} shown, {taskTotalCount.toLocaleString()} total). Narrow with search or filters to see specific tasks.
          </p>
        )}
      </div>
    </div>
  );
}
