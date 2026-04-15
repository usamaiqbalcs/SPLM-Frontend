import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { globalSearchApi } from '@/lib/apiClient';
import { mergeClientSearchAugments } from '@/lib/global-search-merge';
import type { GlobalSearchResponse } from '@/lib/global-search-types';
import { cn } from '@/lib/utils';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEBOUNCE_MS = 400;
const SUGGEST_LIMIT = 48;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearchBar({ className }: { className?: string }) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GlobalSearchResponse | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  const debouncedQ = useDebouncedValue(q.trim(), DEBOUNCE_MS);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (debouncedQ.length < 1) {
      setData(null);
      setLoading(false);
      setFetchErr(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFetchErr(null);
    globalSearchApi
      .search(debouncedQ, SUGGEST_LIMIT)
      .then((res) => {
        if (!cancelled) setData(mergeClientSearchAugments(res, debouncedQ));
      })
      .catch((e: unknown) => {
        if (!cancelled) setFetchErr(e instanceof Error ? e.message : 'Search failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  const go = useCallback(
    (path: string) => {
      navigate(path.startsWith('/') ? path : `/${path}`);
      setOpen(false);
      setQ('');
      setData(null);
    },
    [navigate],
  );

  const showPanel = open && q.trim().length >= 1;
  const flatCount = data?.total_count ?? 0;
  const hasGroups = (data?.groups?.length ?? 0) > 0;

  return (
    <div ref={rootRef} className={cn('relative flex-1 max-w-md min-w-[140px]', className)}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          id="global-search-input"
          type="search"
          autoComplete="off"
          placeholder="Search everything…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
        <kbd className="hidden sm:inline text-[9px] text-muted-foreground/70 bg-muted px-1 py-0.5 rounded border shrink-0">
          ⌘K
        </kbd>
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] rounded-lg border bg-popover text-popover-foreground shadow-xl max-h-[min(70vh,420px)] overflow-hidden flex flex-col">
          {q.trim().length < 1 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Type to search</div>
          )}

          {q.trim().length >= 1 && loading && !data && (
            <div className="px-3 py-8 flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              Searching…
            </div>
          )}

          {q.trim().length >= 1 && !loading && fetchErr && (
            <div className="px-3 py-6 text-center text-xs text-destructive">{fetchErr}</div>
          )}

          {q.trim().length >= 1 && !loading && !fetchErr && data && !hasGroups && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No matches for &quot;{q.trim()}&quot;
            </div>
          )}

          {q.trim().length >= 1 && data && hasGroups && (
            <>
              <div className="overflow-y-auto flex-1 scrollbar-thin py-1">
                {data.groups.map((g) => (
                  <div key={g.module_id} className="mb-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {g.module_label}
                    </div>
                    {g.items.map((hit) => (
                      <button
                        key={`${g.module_id}-${hit.id}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(hit.path)}
                        className="w-full text-left px-3 py-2 hover:bg-muted/80 transition-colors border-b border-border/40 last:border-0"
                      >
                        <div className="text-sm font-medium text-foreground truncate">{hit.title}</div>
                        {hit.secondary ? (
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">{hit.secondary}</div>
                        ) : null}
                        <div className="text-[10px] text-primary/80 mt-0.5 font-medium">{g.module_label}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="border-t p-2 flex items-center justify-between gap-2 bg-muted/30">
                <span className="text-[10px] text-muted-foreground pl-1">{flatCount} hit(s)</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
                    setOpen(false);
                  }}
                >
                  View all results
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
