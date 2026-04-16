/**
 * Maps between sidebar “tab” ids (used in nav state) and URL path segments under AppLayout.
 * When adding a new panel: register the tab, segment, and permission in `config/splm-navigation.ts`,
 * add directions here if ids differ, add `<Route>` in App.tsx, and add an icon in `config/splm-nav-icons.ts`.
 */

const TAB_TO_SEGMENT: Record<string, string> = {
  'pdm-signoff': 'pdm-acceptance',
  'prompt-library': 'prompts',
  'kpi-dashboard': 'kpi',
};

const SEGMENT_TO_TAB: Record<string, string> = {
  'pdm-acceptance': 'pdm-signoff',
  prompts: 'prompt-library',
  kpi: 'kpi-dashboard',
};

/** First URL segment → tab id (e.g. <code>pdm-acceptance</code> → <code>pdm-signoff</code>). */
export function segmentToTab(segment: string): string {
  const s = segment.replace(/^\/+|\/+$/g, '').split('/')[0] || 'dashboard';
  return SEGMENT_TO_TAB[s] ?? s;
}

/** Tab id → first URL segment for <code>navigate(`/${tabToRouteSegment(id)}`)</code>. */
export function tabToRouteSegment(tab: string): string {
  return TAB_TO_SEGMENT[tab] ?? tab;
}

export function pathToTab(pathname: string): string {
  const seg = pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || 'dashboard';
  return segmentToTab(seg);
}
