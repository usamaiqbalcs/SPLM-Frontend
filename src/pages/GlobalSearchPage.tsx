import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { globalSearchApi } from '@/lib/apiClient';
import { mergeClientSearchAugments } from '@/lib/global-search-merge';
import type { GlobalSearchResponse } from '@/lib/global-search-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';

const FULL_LIMIT = 200;
const DEBOUNCE_MS = 400;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQ = params.get('q') ?? '';

  const [q, setQ] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GlobalSearchResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const qTrim = useMemo(() => q.trim(), [q]);
  const debouncedQTrim = useDebouncedValue(qTrim, DEBOUNCE_MS);
  const typingPending = qTrim.length >= 1 && debouncedQTrim !== qTrim;

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  useEffect(() => {
    if (debouncedQTrim.length < 1) {
      setData(null);
      setErr(null);
      setLoading(false);
      return;
    }
    let c = false;
    setLoading(true);
    setErr(null);
    globalSearchApi
      .search(debouncedQTrim, FULL_LIMIT)
      .then((r) => {
        if (!c) setData(mergeClientSearchAugments(r, debouncedQTrim));
      })
      .catch((e: unknown) => {
        if (!c) setErr(e instanceof Error ? e.message : 'Search failed');
      })
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [debouncedQTrim]);

  const runSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(qTrim ? { q: qTrim } : {});
  };

  return (
    <div className="min-w-0 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Search
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Results across all linked SPLM modules</p>
      </div>

      <form onSubmit={runSubmit} className="flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="min-w-0 flex-1" />
        <Button type="submit" className="w-full shrink-0 sm:w-auto" disabled={loading || typingPending}>
          {loading || typingPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </form>

      {qTrim.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
          Enter a term above to search products, tasks, wiki, releases, and more.
        </div>
      )}

      {qTrim.length >= 1 && (typingPending || loading) && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground text-sm">
          <Loader2 className="w-8 h-8 animate-spin" />
          {typingPending ? 'Waiting for you to finish typing…' : 'Loading results…'}
        </div>
      )}

      {qTrim.length >= 1 && !typingPending && !loading && err && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {qTrim.length >= 1 && !typingPending && !loading && !err && data && data.groups.length === 0 && (
        <div className="rounded-lg border p-12 text-center text-muted-foreground text-sm">
          No results for &quot;{debouncedQTrim}&quot;
        </div>
      )}

      {qTrim.length >= 1 && !typingPending && !loading && !err && data && data.groups.length > 0 && (
        <div className="space-y-8">
          <p className="text-xs text-muted-foreground">{data.total_count} result(s)</p>
          {data.groups.map((g) => (
            <section key={g.module_id}>
              <h2 className="text-sm font-bold text-primary mb-2 border-b pb-1">{g.module_label}</h2>
              <ul className="divide-y rounded-lg border bg-card">
                {g.items.map((hit) => (
                  <li key={`${g.module_id}-${hit.id}`}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors"
                      onClick={() => navigate(hit.path.startsWith('/') ? hit.path : `/${hit.path}`)}
                    >
                      <div className="font-medium text-foreground">{hit.title}</div>
                      {hit.secondary ? (
                        <div className="text-xs text-muted-foreground mt-0.5">{hit.secondary}</div>
                      ) : null}
                      <div className="text-[10px] text-muted-foreground/80 mt-1 font-mono">{hit.path}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
