import { useEffect, useState, useMemo } from 'react';
import { listResearch, saveResearch, deleteResearch, listProducts } from '@/lib/api';
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
import { FlaskConical, ExternalLink, Clock, Zap, AlertTriangle, BookOpen } from 'lucide-react';

const URGENCY_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  low:            { label: 'Low',          color: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground' },
  medium:         { label: 'Medium',       color: 'text-primary',          badge: 'bg-primary/10 text-primary' },
  within_30_days: { label: 'Within 30d',   color: 'text-warning',          badge: 'bg-warning/10 text-warning' },
  immediate:      { label: 'Immediate',    color: 'text-destructive',      badge: 'bg-destructive/10 text-destructive' },
};

const URGENCY_LEVELS = ['low', 'medium', 'within_30_days', 'immediate'] as const;

export default function ResearchPanel() {
  const { can, user } = useAuth();
  const [items, setItems]       = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filters
  const [urgF, setUrgF]     = useState('');
  const [pF, setPF]         = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([listResearch(), listProducts()])
      .then(([r, p]) => { setItems(r); setProducts(p); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

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

  // Stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = { low: 0, medium: 0, within_30_days: 0, immediate: 0 };
    items.forEach(r => { if (counts[r.urgency] !== undefined) counts[r.urgency]++; });
    return { ...counts, total: items.length };
  }, [items]);

  // Filtered list
  const filtered = useMemo(() => items.filter(r => {
    const q = search.toLowerCase();
    const affectedProductIds = (r.affected_products || '').split(',').map((s: string) => s.trim());
    return (
      (!urgF || r.urgency === urgF) &&
      (!pF || affectedProductIds.includes(pF)) &&
      (!q || (r.topic || '').toLowerCase().includes(q) || (r.ai_analysis || '').toLowerCase().includes(q))
    );
  }), [items, urgF, pF, search]);

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
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
            value={form.urgency}
            onChange={e => setForm((f: any) => ({ ...f, urgency: e.target.value }))}
          >
            {URGENCY_LEVELS.map(o => (
              <option key={o} value={o}>{URGENCY_CONFIG[o].label}</option>
            ))}
          </select>
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
        <div className="md:col-span-2">
          <Label>Affected Products</Label>
          <div className="mt-1 flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[40px]">
            {products.map(p => {
              const ids: string[] = (form.affected_products || '').split(',').map((s: string) => s.trim()).filter(Boolean);
              const checked = ids.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const next = checked ? ids.filter(id => id !== p.id) : [...ids, p.id];
                    setForm((f: any) => ({ ...f, affected_products: next.join(',') }));
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                    checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Click to toggle which products this research affects</p>
        </div>
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
    <div className="animate-fade-in space-y-4">
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={o => !o && setDeleteId(null)}
        title="Delete Research"
        description="This will permanently delete this research entry."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={doDelete}
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

      {/* ── Filters + list ── */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-48 h-9 text-sm"
              placeholder="Search topics…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="border rounded-md px-3 py-2 text-sm bg-background h-9" value={pF} onChange={e => setPF(e.target.value)}>
              <option value="">All Products</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="border rounded-md px-3 py-2 text-sm bg-background h-9" value={urgF} onChange={e => setUrgF(e.target.value)}>
              <option value="">All Urgencies</option>
              {URGENCY_LEVELS.map(o => <option key={o} value={o}>{URGENCY_CONFIG[o].label}</option>)}
            </select>
            {(urgF || pF || search) && (
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
          filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FlaskConical className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="font-medium">No research found</p>
              <p className="text-xs mt-1">Log market research to track competitive intelligence</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => {
                const cfg = URGENCY_CONFIG[r.urgency] ?? URGENCY_CONFIG.low;
                const affectedIds: string[] = (r.affected_products || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                const affectedNames = affectedIds.map(id => pname(id)).filter(Boolean);
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
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', cfg.badge)}>
                            {cfg.label}
                          </span>
                          {affectedNames.map((n, i) => (
                            <span key={i} className="bg-secondary text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full">{n}</span>
                          ))}
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
      </div>
    </div>
  );
}
