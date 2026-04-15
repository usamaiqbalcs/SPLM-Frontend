/** Shapes returned by <code>GET /api/v1/search</code> (snake_case JSON). */

export interface GlobalSearchHit {
  module_id: string;
  module_label: string;
  id: string;
  title: string;
  secondary: string;
  /** Absolute path within the SPA, e.g. <code>/tasks?highlight=…</code> */
  path: string;
}

export interface GlobalSearchGroup {
  module_id: string;
  module_label: string;
  items: GlobalSearchHit[];
}

export interface GlobalSearchResponse {
  groups: GlobalSearchGroup[];
  total_count: number;
}

/**
 * Optional client-side augmentations (runs after server results merge).
 * Push new entries here to surface non-API data (e.g. static help links) without changing the backend.
 */
export type ClientSearchAugment = (query: string) => GlobalSearchHit[];

export const clientSearchAugments: ClientSearchAugment[] = [
  // Example: (q) => q.length >= 2 && 'help'.includes(q) ? [{ module_id: 'help', ... }] : []
];
