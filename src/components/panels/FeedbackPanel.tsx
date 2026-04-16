import { useEffect, useState, useMemo } from 'react';
import { listFeedbackPage, saveFeedback, deleteFeedback, listProductsForDropdown } from '@/lib/api';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { MessageSquare, TrendingUp, AlertTriangle, Smile, Frown, Meh, Flame } from 'lucide-react';

const SENTIMENT_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; border: string }> = {
  positive: { icon: <Smile className="w-4 h-4" />,       label: 'Positive', color: 'text-success',     border: 'border-l-success' },
  neutral:  { icon: <Meh className="w-4 h-4" />,         label: 'Neutral',  color: 'text-muted-foreground', border: 'border-l-border' },
  negative: { icon: <Frown className="w-4 h-4" />,       label: 'Negative', color: 'text-warning',     border: 'border-l-warning' },
  critical: { icon: <Flame className="w-4 h-4" />,       label: 'Critical', color: 'text-destructive', border: 'border-l-destructive' },
};

const CHANNELS = ['support_ticket', 'error_log', 'usage_metric', 'sales_call', 'market_research', 'manual'];

export default function FeedbackPanel() {
  const { user, can } = useAuth();
  const [items, setItems]     = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState<any>(null);
  const [saving, setSaving]   = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [serverStats, setServerStats] = useState({
    total: 0, positive: 0, neutral: 0, negative: 0, critical: 0, avg_urgency: 0,
  });
  const pageSize = 10;

  // Filters
  const [chF, setChF]     = useState('');
  const [pF, setPF]       = useState('');
  const [sentF, setSentF] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useListPageSearchDebounce(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, chF, pF, sentF]);

  const load = () => {
    setLoading(true);
    Promise.all([
      listFeedbackPage({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        product_id: pF || undefined,
        channel: chF || undefined,
        sentiment: sentF || undefined,
      }),
      listProductsForDropdown(),
    ])
      .then(([fb, p]) => {
        setItems(fb.items);
        setProducts(p);
        setTotalPages(Math.max(1, fb.total_pages));
        setTotalCount(fb.total_count);
        const st = fb.stats as typeof serverStats;
        setServerStats({
          total: st?.total ?? 0,
          positive: st?.positive ?? 0,
          neutral: st?.neutral ?? 0,
          negative: st?.negative ?? 0,
          critical: st?.critical ?? 0,
          avg_urgency: Number(st?.avg_urgency ?? 0),
        });
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [page, debouncedSearch, chF, pF, sentF]);

  const blank = { product_id: '', channel: 'manual', raw_content: '', sentiment: 'neutral', urgency_score: 5 };
  const pname = (id: string) => products.find(p => p.id === id)?.name || '—';

  const doSave = async () => {
    if (!form.product_id || !form.raw_content) return toast.error('Product and content are required');
    setSaving(true);
    try {
      await saveFeedback({ ...form, submitted_by: user?.id });
      toast.success(form.id ? 'Feedback updated' : 'Feedback logged');
      load();
      setForm(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try { await deleteFeedback(deleteId); toast.success('Feedback deleted'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setDeleteId(null); }
  };

  const stats = useMemo(() => ({
    positive: serverStats.positive,
    neutral: serverStats.neutral,
    negative: serverStats.negative,
    critical: serverStats.critical,
    total: serverStats.total,
    avgUrgency: serverStats.total ? serverStats.avg_urgency.toFixed(1) : '0',
  }), [serverStats]);

  const feedbackProductFormOptions = useMemo(
    () => [{ value: '', label: 'Select product…' }, ...products.map((p: any) => ({ value: p.id, label: p.name }))],
    [products],
  );
  const feedbackChannelOptions = useMemo(
    () => CHANNELS.map((o) => ({ value: o, label: o.replace(/_/g, ' ') })),
    [],
  );
  const feedbackSentimentOptions = useMemo(
    () => Object.keys(SENTIMENT_CONFIG).map((o) => ({ value: o, label: SENTIMENT_CONFIG[o].label })),
    [],
  );
  const feedbackProductFilterOptions = useMemo(
    () => [{ value: '', label: 'All Products' }, ...products.map((p: any) => ({ value: p.id, label: p.name }))],
    [products],
  );
  const feedbackChannelFilterOptions = useMemo(
    () => [{ value: '', label: 'All Channels' }, ...CHANNELS.map((o) => ({ value: o, label: o.replace(/_/g, ' ') }))],
    [],
  );
  const feedbackSentimentFilterOptions = useMemo(
    () => [{ value: '', label: 'All Sentiments' }, ...Object.keys(SENTIMENT_CONFIG).map((o) => ({ value: o, label: o }))],
    [],
  );

  // ── Form view ──────────────────────────────────────────────────────────────
  if (form) return (
    <div className="bg-card rounded-lg border p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-primary">{form.id ? 'Edit Feedback' : 'Log Feedback'}</h3>
        <Button variant="outline" onClick={() => setForm(null)}>← Back</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Product *</Label>
          <div className="mt-1">
            <SearchableSelect options={feedbackProductFormOptions} value={form.product_id || ''} onValueChange={(v) => setForm((f: any) => ({ ...f, product_id: v }))} placeholder="Select product…" searchPlaceholder="Search products…" contentWidth="wide" />
          </div>
        </div>
        <div>
          <Label>Channel</Label>
          <div className="mt-1">
            <SearchableSelect options={feedbackChannelOptions} value={form.channel} onValueChange={(v) => setForm((f: any) => ({ ...f, channel: v }))} searchPlaceholder="Search channel…" />
          </div>
        </div>
        <div>
          <Label>Sentiment</Label>
          <div className="mt-1">
            <SearchableSelect options={feedbackSentimentOptions} value={form.sentiment} onValueChange={(v) => setForm((f: any) => ({ ...f, sentiment: v }))} searchPlaceholder="Search sentiment…" />
          </div>
        </div>
        <div>
          <Label>Urgency Score (1–10)</Label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="range" min={1} max={10}
              value={form.urgency_score || 5}
              onChange={e => setForm((f: any) => ({ ...f, urgency_score: parseInt(e.target.value) }))}
              className="flex-1"
            />
            <span className={cn(
              'text-lg font-extrabold w-8 text-center',
              form.urgency_score >= 8 ? 'text-destructive' : form.urgency_score >= 5 ? 'text-warning' : 'text-success'
            )}>
              {form.urgency_score || 5}
            </span>
          </div>
        </div>
        <div className="md:col-span-2">
          <Label>Content *</Label>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm min-h-[120px] bg-background mt-1"
            value={form.raw_content || ''}
            onChange={e => setForm((f: any) => ({ ...f, raw_content: e.target.value }))}
            placeholder="Describe the feedback in detail…"
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
        title="Delete Feedback"
        description="This will permanently delete this feedback entry."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={doDelete}
      />

      <SplmPageHeader
        title="Feedback"
        subtitle="Signals from support, logs, sales, and research — filtered by product, channel, and sentiment."
        actions={<Button onClick={() => setForm({ ...blank })}>+ Log feedback</Button>}
      />

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: stats.total,    icon: <MessageSquare className="w-4 h-4" />, color: 'text-primary' },
          { label: 'Critical', value: stats.critical, icon: <Flame className="w-4 h-4" />,         color: 'text-destructive' },
          { label: 'Negative', value: stats.negative, icon: <Frown className="w-4 h-4" />,         color: 'text-warning' },
          { label: 'Positive', value: stats.positive, icon: <Smile className="w-4 h-4" />,         color: 'text-success' },
          { label: 'Avg Urgency', value: stats.avgUrgency, icon: <TrendingUp className="w-4 h-4" />, color: 'text-muted-foreground' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-lg border p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">{s.label}</span>
              <span className={s.color}>{s.icon}</span>
            </div>
            <div className={cn('text-2xl font-extrabold', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Sentiment distribution bar ── */}
      {stats.total > 0 && (
        <div className="bg-card rounded-lg border px-5 py-3">
          <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden">
            {(['positive', 'neutral', 'negative', 'critical'] as const).map(s => {
              const pct = (stats[s] / stats.total) * 100;
              if (pct === 0) return null;
              const colors: Record<string, string> = { positive: 'bg-success', neutral: 'bg-muted-foreground/30', negative: 'bg-warning', critical: 'bg-destructive' };
              return <div key={s} className={cn('h-full transition-all', colors[s])} style={{ width: `${pct}%` }} title={`${s}: ${stats[s]}`} />;
            })}
          </div>
          <div className="flex gap-4 mt-2">
            {Object.entries(SENTIMENT_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className={cfg.color}>{cfg.icon}</span>
                {cfg.label}: {(stats as any)[key]}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters + list (inset pagination matches card width). ── */}
      <div className="rounded-lg border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <ListPageSearchInput
              className="w-44 h-9 text-sm"
              placeholder="Search content…"
              value={search}
              onChange={setSearch}
              aria-label="Search feedback"
            />
            <SearchableSelect className="min-w-[10rem]" size="sm" triggerClassName="h-9 w-full" options={feedbackProductFilterOptions} value={pF} onValueChange={setPF} placeholder="All Products" searchPlaceholder="Search products…" contentWidth="wide" />
            <SearchableSelect className="min-w-[10rem]" size="sm" triggerClassName="h-9 w-full" options={feedbackChannelFilterOptions} value={chF} onValueChange={setChF} placeholder="All Channels" searchPlaceholder="Search channel…" />
            <SearchableSelect className="min-w-[10rem]" size="sm" triggerClassName="h-9 w-full" options={feedbackSentimentFilterOptions} value={sentF} onValueChange={setSentF} placeholder="All Sentiments" searchPlaceholder="Search sentiment…" />
            {(chF || pF || sentF || search) && (
              <Button variant="ghost" size="sm" onClick={() => { setChF(''); setPF(''); setSentF(''); setSearch(''); }}>
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* ── List ── */}
        <div className="mt-4">
          {loading ? <TableSkeleton /> :
            items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="w-10 h-10 text-muted-foreground/20 mb-3" />
                <p className="font-medium">No feedback found</p>
                <p className="text-xs mt-1">Try adjusting filters or log new feedback</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(f => {
                  const sc = SENTIMENT_CONFIG[f.sentiment] ?? SENTIMENT_CONFIG.neutral;
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        'bg-muted/30 border border-l-4 rounded-lg p-4 hover:bg-muted/50 transition-colors group',
                        sc.border
                      )}
                    >
                      <div className="flex justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('flex items-center gap-1', sc.color)}>
                            {sc.icon}
                            <span className="text-xs font-semibold capitalize">{f.sentiment}</span>
                          </span>
                          <StatusBadge status={f.channel || 'manual'} />
                          <span className="text-xs font-semibold text-foreground">{pname(f.product_id)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                            <span className={cn(
                              'text-xs font-bold',
                              f.urgency_score >= 8 ? 'text-destructive' : f.urgency_score >= 5 ? 'text-warning' : 'text-success'
                            )}>
                              {f.urgency_score}/10
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{fmtDateTime(f.created_at)}</span>
                        </div>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{f.raw_content}</p>
                      {can('edit') && (
                        <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="outline" onClick={() => setForm(f)}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleteId(f.id)}>Delete</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
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
