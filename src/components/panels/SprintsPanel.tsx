import { useEffect, useMemo, useState } from 'react';
import { listSprints, saveSprint, deleteSprint, assignTaskToSprint } from '@/lib/api-sprints';
import { listTasks, listProductsForDropdown, listDevelopers } from '@/lib/api';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DEFAULT_LIST_PAGE_SIZE,
  ListPageSearchInput,
  ListPaginationBar,
  rowMatchesListSearch,
  useListPageSearchDebounce,
} from '@/components/listing/listPageSearch';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtDate, toHtmlDateInputValue } from '@/lib/splm-utils';
import { DateField } from '@/components/ui/date-field';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { SearchableSelect, optionsFromStrings } from '@/components/forms/SearchableSelect';

const SPRINT_STATUSES = ['planning', 'active', 'completed', 'cancelled'] as const;
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Target, Zap, Sparkles } from 'lucide-react';
import { taskAiApi } from '@/lib/api-aisdlc';
import { Progress } from '@/components/ui/progress';

export default function SprintsPanel() {
  const { can, user } = useAuth();
  const [sprints, setSprints] = useState<any[]>([]);
  const [sprintPage, setSprintPage] = useState(1);
  const [tasks, setTasks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBlockedId, setDeleteBlockedId] = useState<string | null>(null);
  const [expandedSprint, setExpandedSprint] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [bulkAi, setBulkAi] = useState<{
    sprintId: string;
    current: number;
    total: number;
    lines: string[];
  } | null>(null);
  const [sprintScoreBusy, setSprintScoreBusy] = useState<string | null>(null);
  const debouncedListSearch = useListPageSearchDebounce(listSearch);

  const load = () => {
    setLoading(true);
    Promise.all([listSprints(), listTasks(), listProductsForDropdown(), listDevelopers()])
      .then(([s, t, p, d]) => { setSprints(s); setTasks(t); setProducts(p); setDevelopers(d); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filteredSprints = useMemo(() => {
    if (!debouncedListSearch) return sprints;
    return sprints.filter((s: any) =>
      rowMatchesListSearch(debouncedListSearch, [s.name, s.goal, s.status]),
    );
  }, [sprints, debouncedListSearch]);

  const sprintTotalPages = Math.max(1, Math.ceil(filteredSprints.length / DEFAULT_LIST_PAGE_SIZE));
  const pagedSprints = useMemo(() => {
    const start = (sprintPage - 1) * DEFAULT_LIST_PAGE_SIZE;
    return filteredSprints.slice(start, start + DEFAULT_LIST_PAGE_SIZE);
  }, [filteredSprints, sprintPage]);

  useEffect(() => {
    setSprintPage((p) => Math.min(Math.max(1, p), sprintTotalPages));
  }, [sprintTotalPages]);

  useEffect(() => {
    setSprintPage(1);
  }, [debouncedListSearch]);

  const blank = { name: '', goal: '', status: 'planning', start_date: '', end_date: '' };

  const doSave = async () => {
    if (!form.name) return toast.error('Sprint name is required');
    if (!String(form.start_date || '').trim()) return toast.error('Start date is required.');
    if (!String(form.end_date || '').trim()) return toast.error('End date is required.');
    if (String(form.start_date) > String(form.end_date)) {
      return toast.error('End date must be on or after the start date.');
    }
    setSaving(true);
    try {
      await saveSprint({ ...form, created_by: form.created_by || user?.id });
      toast.success(form.id ? 'Sprint updated' : 'Sprint created');
      load();
      setForm(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try { await deleteSprint(deleteId); toast.success('Sprint deleted'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setDeleteId(null); }
  };

  const doAssignTask = async (taskId: string, sprintId: string) => {
    try { await assignTaskToSprint(taskId, sprintId); toast.success('Task assigned to sprint'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const doRemoveTask = async (taskId: string) => {
    try { await assignTaskToSprint(taskId, null); toast.success('Task removed from sprint'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const sprintTasks = (sprintId: string) => tasks.filter(t => t.sprint_id === sprintId);
  const backlogTasks = tasks.filter(t => !t.sprint_id && t.status !== 'done' && t.status !== 'cancelled');
  const pname = (id: string) => products.find(p => p.id === id)?.name || '—';
  const dname = (id: string) => developers.find(d => d.id === id)?.name || '';

  const getVelocityData = () => {
    return sprints
      .filter(s => s.status === 'completed')
      .slice(0, 6)
      .reverse()
      .map(s => {
        const sTasks = sprintTasks(s.id);
        const completed = sTasks.filter(t => t.status === 'done');
        return {
          name: s.name.length > 10 ? s.name.slice(0, 10) + '…' : s.name,
          planned: sTasks.reduce((sum: number, t: any) => sum + (t.story_points || 0), 0),
          completed: completed.reduce((sum: number, t: any) => sum + (t.story_points || 0), 0),
        };
      });
  };

  const velocityData = getVelocityData();

  const sprintStatusOptions = useMemo(() => optionsFromStrings([...SPRINT_STATUSES]), []);

  const runBulkTaskAnalyze = async (sprintId: string, sTasks: any[]) => {
    if (!sTasks.length) {
      toast.error('No tasks in this sprint');
      return;
    }
    const lines: string[] = [];
    setBulkAi({ sprintId, current: 0, total: sTasks.length, lines: [] });
    for (let i = 0; i < sTasks.length; i++) {
      const t = sTasks[i];
      try {
        await taskAiApi.analyzeTask(t.id);
        lines.push(`✓ ${t.title}`);
      } catch (e: any) {
        lines.push(`✗ ${t.title}: ${e.message || 'failed'}`);
      }
      setBulkAi({ sprintId, current: i + 1, total: sTasks.length, lines: [...lines] });
    }
    toast.success('Bulk task analysis finished');
    setBulkAi(null);
    load();
  };

  const runSprintScoreAll = async (sprintId: string) => {
    try {
      setSprintScoreBusy(sprintId);
      const n = await taskAiApi.scoreSprintPriorities(sprintId);
      toast.success(n > 0 ? `Scored ${n} tasks` : 'No tasks to score');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Scoring failed');
    } finally {
      setSprintScoreBusy(null);
    }
  };

  if (form) return (
    <div className="bg-card rounded-lg border p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-primary">{form.id ? 'Edit Sprint' : 'New Sprint'}</h3>
        <Button variant="outline" onClick={() => setForm(null)}>← Back</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="md:col-span-2"><Label>Sprint Name *</Label><Input value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Sprint 14 — Q2 Hardening" /></div>
        <div className="md:col-span-2"><Label>Sprint Goal</Label><textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[60px] bg-background" value={form.goal || ''} onChange={e => setForm((f: any) => ({ ...f, goal: e.target.value }))} placeholder="Stabilize auth flow, close 5 critical bugs" /></div>
        <div><Label>Status</Label><div className="mt-1"><SearchableSelect options={sprintStatusOptions} value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))} searchPlaceholder="Search status…" /></div></div>
        <div />
        <DateField
          label="Start Date"
          required
          value={toHtmlDateInputValue(form.start_date)}
          onChange={(v) => setForm((f: any) => ({ ...f, start_date: v }))}
          max={toHtmlDateInputValue(form.end_date) || undefined}
          helperText="First day of the sprint window."
        />
        <DateField
          label="End Date"
          required
          value={toHtmlDateInputValue(form.end_date)}
          onChange={(v) => setForm((f: any) => ({ ...f, end_date: v }))}
          min={toHtmlDateInputValue(form.start_date) || undefined}
          helperText="Must be on or after the start date."
        />
      </div>
      <div className="flex gap-2"><Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
    </div>
  );

  return (
    <div className="animate-fade-in min-h-0 min-w-0 space-y-5">
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete Sprint"
        description="This will permanently remove the sprint. Are you sure you want to continue?"
        confirmLabel="Delete Sprint"
        variant="destructive"
        onConfirm={doDelete}
      />

      {/* Blocked-delete dialog: shown when the sprint has assigned tasks */}
      {deleteBlockedId && (() => {
        const count = sprintTasks(deleteBlockedId).length;
        return (
          <AlertDialog open onOpenChange={(o) => !o && setDeleteBlockedId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cannot Delete Sprint</AlertDialogTitle>
                <AlertDialogDescription>
                  {`Cannot delete sprint because ${count} task${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} assigned to it. Please remove or reassign all tasks first.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteBlockedId(null)}>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      {/* Velocity chart */}
      {velocityData.length > 0 && (
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-bold text-primary mb-4 text-sm flex items-center gap-2"><Zap className="w-4 h-4" /> Sprint Velocity</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={velocityData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="planned" fill="hsl(var(--muted-foreground))" name="Planned SP" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" fill="hsl(var(--success))" name="Completed SP" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <SplmPageHeader
        title="Sprints"
        subtitle="Plan iterations, assign backlog work, and review velocity across the team."
      />

      <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {debouncedListSearch ? `${filteredSprints.length} of ${sprints.length} match` : `${sprints.length} sprint${sprints.length === 1 ? '' : 's'}`}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <ListPageSearchInput value={listSearch} onChange={setListSearch} className="w-36 sm:w-44" />
            {can('edit') && <Button onClick={() => setForm({ ...blank })}>+ New Sprint</Button>}
          </div>
        </div>
        {loading ? <TableSkeleton /> :
          sprints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <span className="text-4xl mb-3">🏃</span>
              <p className="font-medium">No sprints</p>
              <p className="text-xs mt-1">Create a sprint to organize work into iterations</p>
            </div>
          ) : filteredSprints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <span className="text-4xl mb-3">🔎</span>
              <p className="font-medium">No sprints match your search</p>
            </div>
          ) :
            <div className="space-y-3">
              {pagedSprints.map(s => {
                const sTasks = sprintTasks(s.id);
                const totalSP = sTasks.reduce((sum: number, t: any) => sum + (t.story_points || 0), 0);
                const doneSP = sTasks.filter(t => t.status === 'done').reduce((sum: number, t: any) => sum + (t.story_points || 0), 0);
                const isExpanded = expandedSprint === s.id;
                const doneCount = sTasks.filter(t => t.status === 'done').length;
                const progress = sTasks.length > 0 ? Math.round((doneCount / sTasks.length) * 100) : 0;

                return (
                  <div key={s.id} className={cn('border rounded-lg overflow-hidden transition-shadow', s.status === 'active' ? 'border-primary/50' : '')}>
                    <div
                      className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedSprint(isExpanded ? null : s.id)}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex gap-2 items-center flex-wrap">
                            <span className="font-bold text-sm text-foreground">{s.name}</span>
                            <StatusBadge status={s.status} />
                          </div>
                          {s.goal && <p className="text-xs text-muted-foreground mt-0.5">{s.goal}</p>}
                        </div>
                        <div className="flex gap-1">
                          {can('edit') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setForm({
                                  ...s,
                                  start_date: toHtmlDateInputValue(s.start_date),
                                  end_date: toHtmlDateInputValue(s.end_date),
                                });
                              }}
                            >
                              Edit
                            </Button>
                          )}
                          {can('edit') && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                const assignedCount = sprintTasks(s.id).length;
                                if (assignedCount > 0) {
                                  setDeleteBlockedId(s.id);
                                } else {
                                  setDeleteId(s.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(s.start_date)} → {fmtDate(s.end_date)}</span>
                        <span className="flex items-center gap-1"><Target className="w-3 h-3" />{sTasks.length} tasks · {totalSP} SP</span>
                        <span className="font-semibold text-success">{doneSP}/{totalSP} SP done</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t px-4 py-3 bg-muted/20">
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-2">
                          <span className="text-xs font-bold text-muted-foreground uppercase">Sprint Tasks</span>
                          {can('edit') && sTasks.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1 text-[10px] h-7"
                                disabled={!!bulkAi || sprintScoreBusy === s.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void runBulkTaskAnalyze(s.id, sTasks);
                                }}
                              >
                                <Sparkles className="w-3 h-3" />
                                {bulkAi?.sprintId === s.id ? 'AI analyze…' : 'AI analyze all tasks'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="text-[10px] h-7"
                                disabled={!!bulkAi || sprintScoreBusy === s.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void runSprintScoreAll(s.id);
                                }}
                              >
                                {sprintScoreBusy === s.id ? 'Scoring…' : 'Score all priorities'}
                              </Button>
                            </div>
                          )}
                        </div>
                        {bulkAi?.sprintId === s.id && (
                          <div className="mb-3 rounded-md border bg-background p-2 text-[10px] space-y-1">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Sequential task analysis</span>
                              <span>{bulkAi.current}/{bulkAi.total}</span>
                            </div>
                            <Progress value={bulkAi.total ? (bulkAi.current / bulkAi.total) * 100 : 0} className="h-1.5" />
                            <div className="max-h-24 overflow-y-auto font-mono text-[10px] text-foreground/90">
                              {bulkAi.lines.map((ln, i) => (
                                <div key={i}>{ln}</div>
                              ))}
                            </div>
                          </div>
                        )}
                        {sTasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No tasks assigned. Drag tasks from backlog below.</p>
                        ) : (
                          <div className="space-y-1.5 mb-3">
                            {sTasks.map(t => (
                              <div key={t.id} className="flex items-center gap-2 py-1.5 px-2 bg-card rounded border hover:shadow-sm transition-shadow">
                                <span className="text-xs font-medium flex-1 text-foreground">{t.title}</span>
                                <StatusBadge status={t.priority} />
                                <StatusBadge status={t.status || 'backlog'} />
                                {t.story_points > 0 && <span className="bg-secondary text-primary text-[10px] font-bold px-1.5 py-0.5 rounded">{t.story_points} SP</span>}
                                {can('edit') && (
                                  <Button size="sm" variant="ghost" className="text-[10px] h-6 px-1.5" onClick={() => doRemoveTask(t.id)}>Remove</Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Backlog tasks to add */}
                        {can('edit') && backlogTasks.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 block">Add from backlog</span>
                            <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin">
                              {backlogTasks.slice(0, 15).map(t => (
                                <div key={t.id} className="flex items-center gap-2 py-1 px-2 rounded border border-dashed hover:border-primary/50 hover:bg-primary/5 transition-colors">
                                  <span className="text-xs text-foreground flex-1">{t.title}</span>
                                  <span className="text-[10px] text-muted-foreground">{pname(t.product_id)}</span>
                                  <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => doAssignTask(t.id, s.id)}>+ Add</Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
        }
        {!loading && filteredSprints.length > 0 && (
          <ListPaginationBar
            variant="inset"
            page={sprintPage}
            totalPages={sprintTotalPages}
            totalItems={filteredSprints.length}
            pageSize={DEFAULT_LIST_PAGE_SIZE}
            onPageChange={setSprintPage}
            disabled={loading}
          />
        )}
      </div>
    </div>
  );
}
