import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  auditLogsApi,
  type AuditLogDto,
  type AuditLogQueryParams,
} from '@/lib/apiClient';
import { fmtDateTime } from '@/lib/splm-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AuditLogUserSelect } from '@/components/forms/AuditLogUserSelect';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';
import { Card } from '@/components/ui/card';
import { ListPaginationBar } from '@/components/listing/listPageSearch';

const MODULE_PRESETS = [
  '',
  'products',
  'tasks',
  'sprints',
  'releases',
  'versions',
  'environments',
  'deployments',
  'developers',
  'research',
  'feedback',
  'wiki',
  'notifications',
  'workflow_pipeline',
  'pm_signoff',
  'pdm_signoff',
  'qa_cycles',
  'qa_issues',
  'ai_prompts',
  'auth',
  'identity',
];

const ACTION_PRESETS = [
  '',
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'ASSIGN',
  'UNASSIGN',
  'MARK_READ',
  'MARK_ALL_READ',
  'LOGIN',
  'REGISTER',
  'LOGOUT',
  'APPROVE',
  'REJECT',
  'ROLE_CHANGE',
  'ACTIVE_CHANGE',
  'REFRESH',
  'SESSION_REVOKE_ALL',
  'PASSWORD_RESET_LINK_SENT',
  'PASSWORD_RESET_COMPLETED',
];

const AUDIT_MODULE_SELECT_OPTIONS = MODULE_PRESETS.map((m) => ({ value: m, label: m || 'Any' }));
const AUDIT_ACTION_SELECT_OPTIONS = ACTION_PRESETS.map((a) => ({ value: a, label: a || 'Any' }));
const AUDIT_SORT_SELECT_OPTIONS = [
  { value: 'created_at', label: 'Date / time' },
  { value: 'module_name', label: 'Module' },
  { value: 'action', label: 'Action' },
  { value: 'record_id', label: 'Record ID' },
];

function actionBadgeClass(action: string): string {
  const a = action.toUpperCase();
  if (a === 'CREATE' || a === 'LOGIN' || a === 'REGISTER' || a === 'APPROVE') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
  }
  if (a === 'DELETE' || a === 'REJECT' || a === 'LOGOUT' || a === 'SESSION_REVOKE_ALL') {
    return 'bg-destructive/15 text-destructive border-destructive/25';
  }
  if (a === 'UPDATE' || a === 'MARK_READ') {
    return 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/25';
  }
  if (a === 'STATUS_CHANGE' || a === 'ASSIGN' || a === 'UNASSIGN' || a === 'MARK_ALL_READ') {
    return 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/25';
  }
  if (a === 'PASSWORD_RESET_LINK_SENT' || a === 'PASSWORD_RESET_COMPLETED') {
    return 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/25';
  }
  return 'bg-muted text-muted-foreground border-border';
}

function formatJsonBlock(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '—';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function truncate(s: string | null | undefined, max: number): string {
  if (s == null || s === '') return '—';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

type AppliedTextFilters = {
  performedBy: string;
  recordId: string;
  recordNameContains: string;
  search: string;
  fromUtc: string;
  toUtc: string;
};

const emptyApplied: AppliedTextFilters = {
  performedBy: '',
  recordId: '',
  recordNameContains: '',
  search: '',
  fromUtc: '',
  toUtc: '',
};

export default function AuditLogsPanel() {
  const { can } = useAuth();
  const [items, setItems] = useState<AuditLogDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moduleName, setModuleName] = useState('');
  const [action, setAction] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDescending, setSortDescending] = useState(true);

  const [draft, setDraft] = useState<AppliedTextFilters>(emptyApplied);
  const [applied, setApplied] = useState<AppliedTextFilters>(emptyApplied);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<AuditLogDto | null>(null);

  const queryParams = useMemo((): AuditLogQueryParams => {
    const p: AuditLogQueryParams = {
      page,
      pageSize,
      sortBy,
      sortDescending,
    };
    if (moduleName.trim()) p.module = moduleName.trim();
    if (action.trim()) p.action = action.trim();
    if (applied.performedBy.trim()) p.performedBy = applied.performedBy.trim();
    if (applied.recordId.trim()) p.recordId = applied.recordId.trim();
    if (applied.recordNameContains.trim()) p.recordNameContains = applied.recordNameContains.trim();
    if (applied.search.trim()) p.search = applied.search.trim();
    if (applied.fromUtc) p.fromUtc = new Date(`${applied.fromUtc}T00:00:00.000Z`).toISOString();
    if (applied.toUtc) p.toUtc = new Date(`${applied.toUtc}T23:59:59.999Z`).toISOString();
    return p;
  }, [page, pageSize, sortBy, sortDescending, moduleName, action, applied]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditLogsApi.getPage(queryParams);
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit logs.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const resetFilters = () => {
    setModuleName('');
    setAction('');
    setSortBy('created_at');
    setSortDescending(true);
    setDraft(emptyApplied);
    setApplied(emptyApplied);
    setPage(1);
  };

  const applyTextFilters = () => {
    setApplied({ ...draft });
    setPage(1);
  };

  const openDetail = async (row: AuditLogDto) => {
    setDetailOpen(true);
    setDetail(row);
    try {
      const fresh = await auditLogsApi.getById(row.id);
      setDetail(fresh);
    } catch {
      /* keep row snapshot */
    }
  };

  if (!can('audit.read')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col space-y-6">
      <SplmPageHeader
        title="Audit logs"
        subtitle="Administrative actions across modules. Apply filters, then scroll the table — pagination stays aligned with the grid below."
      />

      {/*
        Root cause of awkward scroll: sticky filters + table each in their own overflow stacks fought the shell.
        Filters stay in a normal flow card (no sticky) so only the main area scrolls; table + pager share one card.
      */}
      <div className="splm-filter-shell space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
        {/* Row 1 */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Module</label>
            <SearchableSelect
              size="sm"
              triggerClassName="h-9 w-[140px]"
              options={AUDIT_MODULE_SELECT_OPTIONS}
              value={moduleName}
              onValueChange={(v) => { setModuleName(v); setPage(1); }}
              searchPlaceholder="Search module…"
              contentWidth="wide"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Action</label>
            <SearchableSelect
              size="sm"
              triggerClassName="h-9 w-[140px]"
              options={AUDIT_ACTION_SELECT_OPTIONS}
              value={action}
              onValueChange={(v) => { setAction(v); setPage(1); }}
              searchPlaceholder="Search action…"
              contentWidth="wide"
            />
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Search</label>
            <Input
              className="h-9"
              placeholder="Free text…"
              value={draft.search}
              onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') applyTextFilters(); }}
            />
          </div>
          <Button type="button" size="sm" className="h-9" onClick={applyTextFilters}>Apply</Button>
          <Button type="button" size="sm" className="h-9" variant="outline" onClick={resetFilters}>Reset</Button>
        </div>

        {/* Row 2a: 12-col grid — User(5) | Record ID(3) | Record name contains(4) */}
        <div className="grid grid-cols-12 items-end gap-3 border-t border-border/60 pt-4">
          <div className="col-span-5 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="audit-filter-user">User</label>
            <AuditLogUserSelect
              id="audit-filter-user"
              aria-label="Filter by user"
              value={draft.performedBy}
              onValueChange={(userId) => setDraft(d => ({ ...d, performedBy: userId }))}
              placeholder="Any user"
              searchPlaceholder="Search user by name or email"
              triggerClassName="h-9 w-full"
              contentWidth="wide"
            />
          </div>
          <div className="col-span-3 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Record ID</label>
            <Input className="h-9 w-full" value={draft.recordId} onChange={e => setDraft(d => ({ ...d, recordId: e.target.value }))} placeholder="Exact" />
          </div>
          <div className="col-span-4 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Record name contains</label>
            <Input className="h-9 w-full" value={draft.recordNameContains} onChange={e => setDraft(d => ({ ...d, recordNameContains: e.target.value }))} />
          </div>
        </div>

        {/* Row 2b: From | To | Sort | Descending | Apply filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">From (UTC)</label>
            <Input className="h-9 w-[150px]" type="date" value={draft.fromUtc} onChange={e => setDraft(d => ({ ...d, fromUtc: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">To (UTC)</label>
            <Input className="h-9 w-[150px]" type="date" value={draft.toUtc} onChange={e => setDraft(d => ({ ...d, toUtc: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sort</label>
            <SearchableSelect
              size="sm"
              triggerClassName="h-9 w-[150px]"
              options={AUDIT_SORT_SELECT_OPTIONS}
              value={sortBy}
              onValueChange={(v) => { setSortBy(v); setPage(1); }}
              searchPlaceholder="Search sort field…"
            />
          </div>
          <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={sortDescending}
              onChange={e => { setSortDescending(e.target.checked); setPage(1); }}
            />
            Descending
          </label>
          <Button type="button" size="sm" className="h-9" variant="secondary" onClick={applyTextFilters}>
            Apply filters
          </Button>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
          Loading audit logs…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          No audit entries match your filters.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <Card className="flex min-w-0 flex-col overflow-hidden border-border/80 shadow-splm">
          <Table wrapperClassName="overflow-x-auto overflow-y-visible">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">When (UTC)</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
                <TableHead className="min-w-[140px]">Summary</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(row => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmtDateTime(row.created_at)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium text-foreground">{row.performed_by_name || '—'}</div>
                    <div className="text-muted-foreground truncate max-w-[180px]">{row.performed_by_email || ''}</div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{row.module_name}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        actionBadgeClass(row.action),
                      )}
                    >
                      {row.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px]">
                    <div className="truncate font-medium" title={row.record_name ?? ''}>
                      {row.record_name || '—'}
                    </div>
                    <div className="truncate font-mono text-muted-foreground" title={row.record_id}>
                      {truncate(row.record_id, 24)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                    {truncate(row.description, 80)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="sm" variant="secondary" onClick={() => void openDetail(row)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ListPaginationBar
            variant="inset"
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            disabled={loading}
          />
        </Card>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Audit log #{detail?.id ?? ''}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Module</span><div className="font-mono">{detail.module_name}</div></div>
                <div><span className="text-muted-foreground">Action</span><div><span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase', actionBadgeClass(detail.action))}>{detail.action}</span></div></div>
                <div><span className="text-muted-foreground">Record ID</span><div className="font-mono break-all">{detail.record_id}</div></div>
                <div><span className="text-muted-foreground">Record name</span><div>{detail.record_name || '—'}</div></div>
                <div className="col-span-2"><span className="text-muted-foreground">When</span><div>{fmtDateTime(detail.created_at)}</div></div>
                <div><span className="text-muted-foreground">User</span><div>{detail.performed_by_name || '—'}</div></div>
                <div><span className="text-muted-foreground">Email</span><div>{detail.performed_by_email || '—'}</div></div>
                <div className="col-span-2"><span className="text-muted-foreground">Description</span><div className="mt-0.5 whitespace-pre-wrap">{detail.description || '—'}</div></div>
                <div className="col-span-2"><span className="text-muted-foreground">IP</span><div className="font-mono text-xs">{detail.ip_address || '—'}</div></div>
                <div className="col-span-2"><span className="text-muted-foreground">User agent</span><div className="text-xs break-all text-muted-foreground">{detail.user_agent || '—'}</div></div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Old value</div>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed">{formatJsonBlock(detail.old_value)}</pre>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">New value</div>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed">{formatJsonBlock(detail.new_value)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
