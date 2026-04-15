/**
 * URL path segment (first segment under `/`) → permission required to view the page.
 * Must stay in sync with `AppLayout` nav items that set `permission`.
 * Omitted segments: any authenticated user may open the route (sidebar may still hide links).
 */
import { SplmPermissions } from '@/constants/splm-rbac';

export const routeSegmentRequiresPermission: Partial<Record<string, string>> = {
  products: SplmPermissions.Edit,
  tasks: SplmPermissions.Edit,
  sprints: SplmPermissions.Edit,
  research: SplmPermissions.Edit,
  environments: SplmPermissions.Config,
  'ai-overview': SplmPermissions.Edit,
  workflow: SplmPermissions.Edit,
  'qa-cycles': SplmPermissions.Edit,
  'ai-analyzer': SplmPermissions.Edit,
  'fix-review': SplmPermissions.Edit,
  canary: SplmPermissions.Edit,
  'pm-signoff': SplmPermissions.Edit,
  'pdm-acceptance': SplmPermissions.Edit,
  prompts: SplmPermissions.Edit,
  /** Roster / developer directory — Admin & Manager (`users`), not Developer/Viewer. */
  team: SplmPermissions.Users,
  'user-management': SplmPermissions.IdentityManage,
  rbac: SplmPermissions.IdentityManage,
  'audit-logs': SplmPermissions.AuditRead,
};
