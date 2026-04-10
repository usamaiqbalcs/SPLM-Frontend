import { useState, useEffect, useCallback } from 'react';
import { tasksApi, productsApi, developersApi, wikiApi } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { Search, Package, CheckSquare, BookOpen, X, Users } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'task' | 'product' | 'wiki' | 'developer';
  title: string;
  subtitle?: string;
  tab: string;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

const TYPE_CONFIG = {
  task:      { icon: CheckSquare, label: 'Task',      tab: 'tasks' },
  product:   { icon: Package,     label: 'Product',   tab: 'products' },
  wiki:      { icon: BookOpen,    label: 'Wiki',      tab: 'wiki' },
  developer: { icon: Users,       label: 'Developer', tab: 'team' },
};

/** Case-insensitive substring check. */
const matches = (text: string | undefined, q: string) =>
  (text ?? '').toLowerCase().includes(q.toLowerCase());

export default function SearchModal({ open, onClose, onNavigate }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      // Tasks — backend supports ?search=q
      const [taskPage, allProducts, allDevs, allSpaces] = await Promise.all([
        tasksApi.getAll({ search: q, pageSize: 5 }),
        productsApi.getAll().catch(() => [] as any[]),
        developersApi.getAll().catch(() => [] as any[]),
        wikiApi.getSpaces().catch(() => [] as any[]),
      ]);

      // Fetch wiki pages for all spaces (up to 3 spaces to keep it fast)
      const wikiPages: any[] = [];
      await Promise.all(
        (allSpaces as any[]).slice(0, 3).map(async (s: any) => {
          const pages = await wikiApi.getPages(s.id).catch(() => [] as any[]);
          wikiPages.push(...(pages as any[]).filter((p: any) => matches(p.title, q)));
        }),
      );

      const r: SearchResult[] = [
        ...taskPage.map(t => ({
          id: t.id, type: 'task' as const,
          title: t.title,
          subtitle: `${t.priority} · ${(t.status || '').replace(/_/g, ' ')}`,
          tab: 'tasks',
        })),
        ...(allProducts as any[])
          .filter((p: any) => matches(p.name, q) || matches(p.description, q))
          .slice(0, 5)
          .map((p: any) => ({
            id: p.id, type: 'product' as const,
            title: p.name,
            subtitle: p.status,
            tab: 'products',
          })),
        ...wikiPages.slice(0, 4).map((w: any) => ({
          id: w.id, type: 'wiki' as const,
          title: w.title,
          subtitle: 'Wiki page',
          tab: 'wiki',
        })),
        ...(allDevs as any[])
          .filter((d: any) => matches(d.name, q) || matches(d.email, q))
          .slice(0, 3)
          .map((d: any) => ({
            id: d.id, type: 'developer' as const,
            title: d.name,
            subtitle: d.role,
            tab: 'team',
          })),
      ];

      setResults(r);
      setSelectedIdx(0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => search(query), 280);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setSelectedIdx(0); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[selectedIdx]) { onNavigate(results[selectedIdx].tab); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, selectedIdx, onClose, onNavigate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-card rounded-xl shadow-2xl border w-full max-w-[560px] overflow-hidden animate-scale-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, products, wiki, team..."
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border hidden sm:inline">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[380px] overflow-y-auto">
          {loading && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <span className="inline-block animate-spin mr-2">⚙</span>Searching...
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No results for <strong>"{query}"</strong></p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try a different keyword</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-1.5">
              {(['task', 'product', 'wiki', 'developer'] as const).map(type => {
                const group = results.filter(r => r.type === type);
                if (group.length === 0) return null;
                const cfg = TYPE_CONFIG[type];
                return (
                  <div key={type}>
                    <div className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {cfg.label}s
                    </div>
                    {group.map(r => {
                      const idx = results.indexOf(r);
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={r.id}
                          onClick={() => { onNavigate(r.tab); onClose(); }}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer',
                            idx === selectedIdx ? 'bg-muted' : 'hover:bg-muted/50'
                          )}
                        >
                          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{r.title}</div>
                            {r.subtitle && (
                              <div className="text-[11px] text-muted-foreground capitalize">{r.subtitle}</div>
                            )}
                          </div>
                          {idx === selectedIdx && (
                            <kbd className="text-[10px] bg-muted border px-1.5 py-0.5 rounded hidden sm:inline">↵</kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !query && (
            <div className="px-4 py-8 text-center">
              <Search className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Global Search</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Type at least 2 characters to search</p>
              <div className="flex justify-center gap-3 mt-4 text-[11px] text-muted-foreground">
                <span><kbd className="bg-muted border px-1.5 py-0.5 rounded">↑↓</kbd> Navigate</span>
                <span><kbd className="bg-muted border px-1.5 py-0.5 rounded">↵</kbd> Open</span>
                <span><kbd className="bg-muted border px-1.5 py-0.5 rounded">Esc</kbd> Close</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
