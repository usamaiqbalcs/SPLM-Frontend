import { useEffect, useState, useMemo } from 'react';
import { listResearchPage, saveResearch, deleteResearch, listProductsForDropdown } from '@/lib/api';
import { ListPageSearchInput, ListPaginationBar, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fmtDateTime } from '@/lib/splm-utils';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { SearchableProductMultiSelect } from '@/components/forms/SearchableProductMultiSelect';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { FlaskConical, ExternalLink, Clock, Zap, AlertTriangle, BookOpen, Circle } from 'lucide-react';

const URGENCY_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  low:            { label: 'Low',          color: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground' },
  medium:         { label: 'Medium',       color: 'text-primary',          badge: 'bg-primary/10 text-primary' },
  within_30_days: { label: 'Within 30d',   color: 'text-warning',          badge: 'bg-warning/10 text-warning' },
  immediate:      { label: 'Immediate',    color: 'text-destructive',      badge: 'bg-destructive/10 text-destructive' },
};

const URGENCY_LEVELS = ['low', 'medium', 'within_30_days', 'immediate'] as const;

/** First product visible; “Remaining product(s)” + circle opens hover list of the rest. */
function ResearchAffectedProductsRow({
  productIds,
  resolveName,
}: {
  productIds: string[];
  resolveName: (id: string) => string | null;
}) {
  if (productIds.length === 0) return null;

  const firstId = productIds[0];
  const firstLabel = resolveName(firstId) ?? firstId;
  const restIds = productIds.slice(1);
  const rest = restIds.length;

  return (
    <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-0.5">
      <span
        className="max-w-[11rem] min-w-0 truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-primary"
        title={firstLabel}
      >
        {firstLabel}
      </span>
      {rest > 0 && (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="group flex shrink-0 cursor-help items-center gap-1 rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-left transition-colors hover:bg-muted"
              aria-label={`${rest} remaining affected ${rest === 1 ? 'product' : 'products'}; hover to list`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Circle
                className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                strokeWidth={2}
                aria-hidden
              />
              <span className="text-[10px] font-semibold leading-tight text-muted-foreground transition-colors group-hover:text-foreground">
                {rest === 1 ? 'Remaining product' : 'Remaining products'}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-sm p-0">
            <div className="border-b border-border px-3 py-2">
              <p className="text-[11px] font-semibold text-muted-foreground">
                Other affected products ({rest})
              </p>
            </div>
            <ul className="max-h-52 overflow-y-auto px-3 py-2 text-xs leading-snug">
              {restIds.map((id) => {
                const label = resolveName(id) ?? id;
                return (
                  <li key={id} className="truncate border-b border-border/50 py-1 last:border-b-0" title={label}>
                    {label}
                  </li>
                );
              })}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export default function ResearchPanel() {
  const { can, user } = useAuth();
  const [items, setItems]       = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [serverStats, setServerStats] = useState({
    total: 0, low: 0, medium: 0, within_30_days: 0, immediate: 0,
  });
  const pageSize = 10;

  // Filters
  const [urgF, setUrgF]     = useState('');
  const [pF, setPF]         = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useListPageSearchDebounce(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, urgF, pF]);

  const load = () => {
    setLoading(true);
    Promise.all([
      listResearchPage({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        urgency: urgF || undefined,
        product_id: pF || undefined,
      }),
      listProductsForDropdown(),
    ])
      .then(([data, p]) => {
        setItems(data.items);
        setProducts(p);
        setTotalPages(Math.max(1, data.total_pages));
        setTotalCount(data.total_count);
        const st = data.stats as typeof serverStats & { within30_days?: number };
        setServerStats({
          total: st?.total ?? 0,
          low: st?.low ?? 0,
          medium: st?.medium ?? 0,
          within_30_days: st?.within_30_days ?? st?.within30_days ?? 0,
          immediate: st?.immediate ?? 0,
        });
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [page, debouncedSearch, urgF, pF]);

  const blank = { topic: '', source_url: '', urgency: 'low', affected_products: '', ai_analysis: '' };
  const pname = (id: string) => products.find(p => p.id === id)?.name || null;

  const doSave = async () => {
    if (!form.topic) return toast.error('Topic is required');
    setSaving(true);
    try {
      await saveResearch({ ...form, submitted_by: user?.id });
      toast.success(form.id ? 'Research updated' : 'Research logged');
      load();
      setForm(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try { await deleteResearch(deleteId); toast.success('Research deleted'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setDeleteId(null); }
  };

  const stats = useMemo(() => ({
    low: serverStats.low,
    medium: serverStats.medium,
    within_30_days: serverStats.within_30_days,
    immediate: serverStats.immediate,
    total: serverStats.total,
  }), [serverStats]);

  const researchProductFilterOptions = useMemo(
    () => [{ value: '', label: 'All Products' }, ...products.map((p: any) => ({ value: p.id, label: p.name }))],
    [products],
  );
  const researchUrgencyFilterOptions = useMemo(
    () => [{ value: '', label: 'All Urgencies' }, ...URGENCY_LEVELS.map((o) => ({ value: o, label: URGENCY_CONFIG[o].label }))],
    [],
  );
  const researchUrgencyFormOptions = useMemo(
    () => URGENCY_LEVELS.map((o) => ({ value: o, label: URGENCY_CONFIG[o].label })),
    [],
  );

  // ── Form view ──────────────────────────────────────────────────────────────
  if (form) return (
    <div className="bg-card rounded-lg border p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-primary">{form.id ? 'Edit Research' : 'Log Research'}</h3>
        <Button variant="outline" onClick={() => setForm(null)}>← Back</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="md:col-span-2">
          <Label>Topic *</Label>
          <Input
            className="mt-1"
            value={form.topic || ''}
            onChange={e => setForm((f: any) => ({ ...f, topic: e.target.value }))}
            placeholder="e.g. Competitor feature: real-time collaboration"
          />
        </div>
        <div>
          <Label>Urgency</Label>
          <div className="mt-1">
            <SearchableSelect
              options={researchUrgencyFormOptions}
              value={form.urgency}
              onValueChange={(v) => setForm((f: any) => ({ ...f, urgency: v }))}
              searchPlaceholder="Search urgency…"
            />
          </div>
        </div>
        <div>
          <Label>Source URL</Label>
          <Input
            className="mt-1 font-mono text-sm"
            value={form.source_url || ''}
            onChange={e => setForm((f: any) => ({ ...f, source_url: e.target.value }))}
            placeholder="https://…"
          />
        </div>
        <SearchableProductMultiSelect
          label="Affected Products"
          products={products}
          value={form.affected_products || ''}
          onChange={(csv) => setForm((f: any) => ({ ...f, affected_products: csv }))}
          helpText="Search and select one or more products this research affects."
        />
        <div className="md:col-span-2">
          <Label>Analysis / Notes</Label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm min-h-[120px] bg-background mt-1"
            value={form.ai_analysis || ''}
            onChange={e => setForm((f: any) => ({ ...f, ai_analysis: e.target.value }))}
            placeholder="Key findings, implications, recommended actions…"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</Button>
        <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
      </div>
    </div>
  );

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in min-h-0 min-w-0 space-y-4">
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={o => !o && setDeleteId(null)}
        title="Delete Research"
        description="This will permanently delete this research entry."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={doDelete}
      />

      <SplmPageHeader
        title="Research"
        subtitle="Capture competitive intelligence, sources, and urgency — with optional AI analysis when expanded."
      />

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {URGENCY_LEVELS.map(level => {
          const cfg = URGENCY_CONFIG[level];
          const icons: Record<string, React.ReactNode> = {
            low: <BookOpen className="w-4 h-4" />,
            medium: <Clock className="w-4 h-4" />,
            within_30_days: <AlertTriangle className="w-4 h-4" />,
            immediate: <Zap className="w-4 h-4" />,
          };
          return (
            <button
              key={level}
              onClick={() => setUrgF(urgF === level ? '' : level)}
              className={cn(
                'bg-card rounded-lg border p-3 text-left hover:shadow-sm transition-all cursor-pointer',
                urgF === level && 'ring-2 ring-primary'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">{cfg.label}</span>
                <span className={cfg.color}>{icons[level]}</span>
              </div>
              <div className={cn('text-2xl font-extrabold', cfg.color)}>{(stats as any)[level]}</div>
            </button>
          );
        })}
      </div>

      {/* ── Filters + list (one card: footer bar aligns with list rows via inset pagination). ── */}
      <div className="rounded-lg border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <ListPageSearchInput
              className="w-48 h-9 text-sm"
              placeholder="Search topics…"
              value={search}
              onChange={setSearch}
              aria-label="Search research"
            />
            <SearchableSelect className="min-w-[10rem]" size="sm" triggerClassName="h-9 w-full" options={researchProductFilterOptions} value={pF} onValueChange={setPF} placeholder="All Products" searchPlaceholder="Search products…" contentWidth="wide" />
            <SearchableSelect className="min-w-[10rem]" size="sm" triggerClassName="h-9 w-full" options={researchUrgencyFilterOptions} value={urgF} onValueChange={setUrgF} placeholder="All Urgencies" searchPlaceholder="Search urgency…" />
            {(urgF || pF || debouncedSearch) && (
              <Button variant="ghost" size="sm" onClick={() => { setUrgF(''); setPF(''); setSearch(''); }}>
                Clear
              </Button>
            )}
          </div>
          {can('edit') && (
            <Button onClick={() => setForm({ ...blank })}>+ Log Research</Button>
          )}
        </div>

        {loading ? <TableSkeleton /> :
          items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FlaskConical className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="font-medium">No research found</p>
              <p className="text-xs mt-1">Log market research to track competitive intelligence</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(r => {
                const cfg = URGENCY_CONFIG[r.urgency] ?? URGENCY_CONFIG.low;
                const affectedIds: string[] = (r.affected_products || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                const isExpanded = expanded === r.id;
                return (
                  <div
                    key={r.id}
                    className="bg-muted/30 border rounded-lg overflow-hidden hover:bg-muted/50 transition-colors group"
                  >
                    {/* Header row */}
                    <div
                      className="flex items-start justify-between gap-4 p-4 cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : r.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-start gap-2">
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-bold', cfg.badge)}>
                            {cfg.label}
                          </span>
                          <ResearchAffectedProductsRow productIds={affectedIds} resolveName={pname} />
                        </div>
                        <div className="font-semibold text-sm text-foreground">{r.topic}</div>
                        {r.source_url && (
                          <a
                            href={r.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {r.source_url.length > 60 ? r.source_url.slice(0, 60) + '…' : r.source_url}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-muted-foreground">{fmtDateTime(r.created_at)}</span>
                        <span className="text-muted-foreground text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Expandable analysis */}
                    {isExpanded && r.ai_analysis && (
                      <div className="px-4 pb-4 border-t bg-background/50">
                        <p className="text-sm text-foreground leading-relaxed pt-3 whitespace-pre-wrap">{r.ai_analysis}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {can('edit') && (
                      <div className="flex gap-1 px-4 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="outline" onClick={() => setForm(r)}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleteId(r.id)}>Delete</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
        {!loading && totalCount > 0 && (
          <ListPaginationBar
            variant="inset"
            page={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            disabled={loading}
          />
        )}
      </div>
    </div>
  );
}
