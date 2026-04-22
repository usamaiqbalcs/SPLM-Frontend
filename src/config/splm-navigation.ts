/**
 * SPLM — single source of truth: sidebar ↔ URL segment ↔ permission key
 * =============================================================================
 * - `tabId`: stable id used in layout state / `pathToTab` (see `lib/splm-routes.ts` for URL aliases).
 * - `routeSegment`: first path segment in `App.tsx` routes (what `PanelRoute` receives).
 * - `permission`: SplmPermissions string required to show the nav item and to open the route (deep-link safe).
 *
 * Grouped permissions:
 * - **View data (`read`)** — Overview, read-only modules (Feedback, Wiki, Deployments list, Releases list, KPI, …).
 * - **Edit content (`edit`)** — Product Management writes, AI-SDLC pipeline, Sign-offs, Prompt Library.
 * - **Environments (`config`)** — Environments page.
 * - **Team roster (`users`)** — Team page (developers), not JWT account admin.
 * - **Audit Logs (`audit.read`)** — audit trail UI/API.
 * - **Users & roles (`identity.manage`)** — app accounts + RBAC matrix.
 *
 * When adding a panel: add an entry here, add a Lucide icon in `splm-nav-icons.ts`, add `<Route>` in `App.tsx`,
 * and add any `tabToRouteSegment` alias in `splm-routes.ts` if the tab id differs from the URL.
 */
import { SplmPermissions } from '@/constants/splm-rbac';

export type SplmNavItemDef = {
  tabId: string;
  /** Must match `<Route path="...">` in App.tsx */
  routeSegment: string;
  label: string;
  permission: string;
};

export type SplmNavSectionDef = {
  section: string;
  items: SplmNavItemDef[];
};

export const SPLM_NAV_SECTIONS: SplmNavSectionDef[] = [
  {
    section: 'Overview',
    items: [
      { tabId: 'dashboard', routeSegment: 'dashboard', label: 'Dashboard', permission: SplmPermissions.Read },
      { tabId: 'queue', routeSegment: 'queue', label: 'My Queue', permission: SplmPermissions.Read },
    ],
  },
  {
    section: 'Product Management',
    items: [
      { tabId: 'products', routeSegment: 'products', label: 'Products', permission: SplmPermissions.Edit },
      { tabId: 'tasks', routeSegment: 'tasks', label: 'Tasks', permission: SplmPermissions.Edit },
      { tabId: 'sprints', routeSegment: 'sprints', label: 'Sprints', permission: SplmPermissions.Edit },
      { tabId: 'versions', routeSegment: 'versions', label: 'Versions', permission: SplmPermissions.Read },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { tabId: 'feedback', routeSegment: 'feedback', label: 'Feedback', permission: SplmPermissions.Read },
      { tabId: 'research', routeSegment: 'research', label: 'Research', permission: SplmPermissions.Edit },
      { tabId: 'wiki', routeSegment: 'wiki', label: 'Wiki', permission: SplmPermissions.Read },
    ],
  },
  {
    section: 'Operations',
    items: [
      { tabId: 'deployments', routeSegment: 'deployments', label: 'Deployments', permission: SplmPermissions.Read },
      { tabId: 'environments', routeSegment: 'environments', label: 'Environments', permission: SplmPermissions.Config },
      { tabId: 'releases', routeSegment: 'releases', label: 'Releases', permission: SplmPermissions.Read },
    ],
  },
  {
    section: 'AI-SDLC Pipeline',
    items: [
      { tabId: 'ai-overview', routeSegment: 'ai-overview', label: 'AI-SDLC Overview', permission: SplmPermissions.Edit },
      { tabId: 'workflow', routeSegment: 'workflow', label: 'Workflow Pipeline', permission: SplmPermissions.Edit },
      { tabId: 'qa-cycles', routeSegment: 'qa-cycles', label: 'QA Cycles', permission: SplmPermissions.Edit },
      { tabId: 'ai-analyzer', routeSegment: 'ai-analyzer', label: 'AI Analyzer', permission: SplmPermissions.Edit },
      { tabId: 'fix-review', routeSegment: 'fix-review', label: 'Fix Review', permission: SplmPermissions.Edit },
      { tabId: 'canary', routeSegment: 'canary', label: 'Canary Deployments', permission: SplmPermissions.Edit },
    ],
  },
  {
    section: 'Sign-Offs & Approvals',
    items: [
      { tabId: 'pm-signoff', routeSegment: 'pm-signoff', label: 'PM Sign-Off', permission: SplmPermissions.Edit },
      { tabId: 'pdm-signoff', routeSegment: 'pdm-acceptance', label: 'PDM Acceptance', permission: SplmPermissions.Edit },
    ],
  },
  {
    section: 'Insights',
    items: [
      { tabId: 'prompt-library', routeSegment: 'prompts', label: 'Prompt Library', permission: SplmPermissions.Edit },
      { tabId: 'kpi-dashboard', routeSegment: 'kpi', label: 'KPI Dashboard', permission: SplmPermissions.Read },
    ],
  },
  {
    section: 'Administration',
    items: [
      { tabId: 'team', routeSegment: 'team', label: 'Team', permission: SplmPermissions.Users },
      { tabId: 'user-management', routeSegment: 'user-management', label: 'Users & roles', permission: SplmPermissions.IdentityManage },
      { tabId: 'rbac', routeSegment: 'rbac', label: 'Role permissions', permission: SplmPermissions.IdentityManage },
      { tabId: 'audit-logs', routeSegment: 'audit-logs', label: 'Audit Logs', permission: SplmPermissions.AuditRead },
    ],
  },
];

/** Page header titles (keys are tab ids). */
export const SPLM_PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'System overview & metrics' },
  queue: { title: 'My Queue', subtitle: 'Your assigned work items' },
  profile: { title: 'Profile', subtitle: 'Your account and application role' },
  products: { title: 'Products', subtitle: 'Manage software products' },
  tasks: { title: 'Tasks', subtitle: 'Task management & tracking' },
  sprints: { title: 'Sprints', subtitle: 'Sprint planning & velocity' },
  versions: { title: 'Version Control', subtitle: 'MAJOR.MINOR.CYCLE versioning' },
  feedback: { title: 'Feedback', subtitle: 'Customer & stakeholder feedback' },
  research: { title: 'Research', subtitle: 'Market & technology research' },
  wiki: { title: 'Wiki', subtitle: 'Knowledge base & documentation' },
  deployments: { title: 'Deployments', subtitle: 'Deployment pipeline & history' },
  environments: { title: 'Environments', subtitle: 'Server configuration' },
  releases: { title: 'Releases', subtitle: 'Release planning & checklists' },
  team: { title: 'Team', subtitle: 'Developer management' },
  'audit-logs': { title: 'Audit Logs', subtitle: 'Admin activity trail across modules' },
  'user-management': { title: 'User management', subtitle: 'Accounts, app roles (profiles.role), and activation' },
  rbac: { title: 'Role permissions', subtitle: 'Database-backed RBAC matrix (roles ↔ permissions)' },
  'ai-overview': { title: 'AI-SDLC Overview', subtitle: 'Unified pipeline health, QA, analyzer activity, and KPI trend' },
  workflow: { title: 'Workflow Pipeline', subtitle: 'PM Build → Dev Handoff → QA Cycle → Acceptance → Production' },
  'qa-cycles': { title: 'QA Cycles', subtitle: 'AI-assisted quality assurance cycle tracking' },
  'ai-analyzer': { title: 'AI Analyzer', subtitle: 'Backend AI analyzer reports & git diff analysis' },
  'fix-review': { title: 'Fix Review', subtitle: 'Developer Accept / Modify / Reject queue' },
  'pm-signoff': { title: 'PM Sign-Off', subtitle: 'Product Manager build completion checklist' },
  'pdm-signoff': { title: 'PDM Acceptance', subtitle: 'Business acceptance sign-off & production gate' },
  'prompt-library': { title: 'Prompt Library', subtitle: 'Versioned AI prompt repository' },
  'kpi-dashboard': { title: 'KPI Dashboard', subtitle: 'AI-SDLC performance metrics & analytics' },
  canary: { title: 'Canary Deployments', subtitle: 'Gradual rollout management with monitoring windows' },
  search: { title: 'Search', subtitle: 'All modules' },
};

/**
 * URL segment → permission for `PanelRoute` / `RequirePermission`.
 * Includes routes not in the sidebar (e.g. global search).
 */
export function buildRoutePermissionMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const g of SPLM_NAV_SECTIONS) {
    for (const item of g.items) {
      m[item.routeSegment] = item.permission;
    }
  }
  m.search = SplmPermissions.Read;
  /** Profile is opened from the header account menu only (not listed in the sidebar). */
  m.profile = SplmPermissions.Read;
  return m;
}

export const SPLM_ROUTE_PERMISSIONS: Record<string, string> = buildRoutePermissionMap();

/**
 * Tab ids (`tabId` in nav) whose main content should span the full width beside the sidebar.
 * Other panels stay capped at `--splm-page-max` for comfortable reading width; dashboards are
 * dense grids/charts and looked like a narrow “document column” when forced into 1200px + `mx-auto`.
 */
export const SPLM_WIDE_CONTENT_TAB_IDS = new Set<string>(['dashboard', 'kpi-dashboard']);
