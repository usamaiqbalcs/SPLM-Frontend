/**
 * Human-readable labels and descriptions for SplmPermissions keys.
 * Canonical keys stay stable (JWT claims, API policies, dbo.permissions.name) — this file is the
 * product-language layer for the Role permissions matrix and tooltips.
 *
 * Keep in sync with:
 * - Backend `SplmPermissions` / `dbo.permissions`
 * - `splm-navigation.ts` (which permission gates which sidebar route)
 */
import { SplmPermissions } from '@/constants/splm-rbac';

export type SplmPermissionUi = {
  /** Short title shown in the RBAC matrix (friendly name). */
  title: string;
  /** What this permission allows, including sidebar / module hints where helpful. */
  description: string;
};

export const SPLM_PERMISSION_UI: Record<string, SplmPermissionUi> = {
  [SplmPermissions.Read]: {
    title: 'View data',
    description:
      'Baseline access: Dashboard, My Queue, Version Control (view), Feedback, Wiki (view), Deployments, Releases, KPI Dashboard, and Global Search.',
  },
  [SplmPermissions.Edit]: {
    title: 'Edit content',
    description:
      'Create/update/delete in Products, Tasks, Sprints, Research, AI-SDLC pipeline, Sign-offs, Prompt Library, and version bumps where applicable.',
  },
  [SplmPermissions.Config]: {
    title: 'Environments & settings',
    description: 'Sidebar: Environments — server configuration and related admin settings.',
  },
  [SplmPermissions.Users]: {
    title: 'Team roster',
    description: 'Sidebar: Team — developer directory (roster), not app login accounts.',
  },
  [SplmPermissions.Reports]: {
    title: 'Reports & analytics',
    description: 'Analytics-style reporting APIs (broader than KPI UI).',
  },
  [SplmPermissions.Assign]: {
    title: 'Assignment overrides',
    description: 'Task/workflow assignment overrides beyond normal edit.',
  },
  [SplmPermissions.Override]: {
    title: 'Workflow overrides',
    description: 'Elevated workflow actions where enforced by the API.',
  },
  [SplmPermissions.Deploy]: {
    title: 'Deployments (actions)',
    description: 'Create/promote deployments; the Deployments page is visible with View data.',
  },
  [SplmPermissions.Release]: {
    title: 'Releases (actions)',
    description: 'Create/manage release records; the Releases page is visible with View data.',
  },
  [SplmPermissions.AuditRead]: {
    title: 'Audit Logs',
    description: 'Sidebar: Audit Logs — read application audit trail (admin activity).',
  },
  [SplmPermissions.IdentityManage]: {
    title: 'Users & roles (accounts)',
    description: 'Sidebar: Users & roles and Role permissions — manage app accounts and RBAC matrix.',
  },
};

export function splmPermissionTitle(key: string): string {
  return SPLM_PERMISSION_UI[key]?.title ?? key;
}

export function splmPermissionDescription(key: string, serverFallback?: string | null): string {
  const local = SPLM_PERMISSION_UI[key]?.description;
  if (local) return local;
  if (serverFallback && serverFallback.trim()) return serverFallback.trim();
  return '';
}
