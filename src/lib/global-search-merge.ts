import type { GlobalSearchHit, GlobalSearchResponse } from '@/lib/global-search-types';
import { clientSearchAugments } from '@/lib/global-search-types';

/** Merges optional client-side hits into the server response (see <code>clientSearchAugments</code>). */
export function mergeClientSearchAugments(res: GlobalSearchResponse, q: string): GlobalSearchResponse {
  const trimmed = q.trim();
  if (trimmed.length === 0) return res;

  const extra: GlobalSearchHit[] = clientSearchAugments.flatMap((fn) => fn(trimmed));
  if (extra.length === 0) return res;

  const groupMap = new Map<string, { module_id: string; module_label: string; items: GlobalSearchHit[] }>();
  for (const g of res.groups) {
    groupMap.set(g.module_id, { module_id: g.module_id, module_label: g.module_label, items: [...g.items] });
  }
  for (const hit of extra) {
    const cur = groupMap.get(hit.module_id);
    if (cur) cur.items.push(hit);
    else groupMap.set(hit.module_id, { module_id: hit.module_id, module_label: hit.module_label, items: [hit] });
  }

  return {
    groups: Array.from(groupMap.values()),
    total_count: res.total_count + extra.length,
  };
}
