/**
 * Application RBAC — mirrors backend `SplmRoles`, `SplmPermissions`, and `RolePermissionMatrix`.
 * `profiles.role` (JWT claim `user_role` after hydration) drives these permissions.
 * Do not confuse with roster `developers.role` (job title on the Team screen).
 */

export const SplmRoles = {
  Admin: 'admin',
  Manager: 'manager',
  Developer: 'developer',
  Viewer: 'viewer',
} as const;

export type SplmRole = (typeof SplmRoles)[keyof typeof SplmRoles];

export const SplmPermissions = {
  Read: 'read',
  Edit: 'edit',
  Config: 'config',
  Users: 'users',
  Reports: 'reports',
  Assign: 'assign',
  Override: 'override',
  Deploy: 'deploy',
  Release: 'release',
  AuditRead: 'audit.read',
  IdentityManage: 'identity.manage',
} as const;

const KNOWN = new Set<string>(Object.values(SplmRoles));

/** Canonical lower-case role for comparisons and permission lookup. */
export function normalizeRole(role: string | null | undefined): SplmRole {
  if (role == null || role.trim() === '') return SplmRoles.Viewer;
  const t = role.trim().toLowerCase();
  return (KNOWN.has(t) ? t : SplmRoles.Viewer) as SplmRole;
}

const MATRIX: Record<SplmRole, readonly string[]> = {
  [SplmRoles.Admin]: [
    SplmPermissions.Read,
    SplmPermissions.Edit,
    SplmPermissions.Config,
    SplmPermissions.Users,
    SplmPermissions.Reports,
    SplmPermissions.Assign,
    SplmPermissions.Override,
    SplmPermissions.Deploy,
    SplmPermissions.Release,
    SplmPermissions.AuditRead,
    SplmPermissions.IdentityManage,
  ],
  [SplmRoles.Manager]: [
    SplmPermissions.Read,
    SplmPermissions.Edit,
    SplmPermissions.Config,
    SplmPermissions.Users,
    SplmPermissions.Reports,
    SplmPermissions.Assign,
    SplmPermissions.Override,
    SplmPermissions.Deploy,
    SplmPermissions.Release,
  ],
  [SplmRoles.Developer]: [SplmPermissions.Read, SplmPermissions.Reports, SplmPermissions.Deploy],
  [SplmRoles.Viewer]: [SplmPermissions.Read],
};

export function permissionsForRole(role: string | null | undefined): ReadonlySet<string> {
  return new Set(MATRIX[normalizeRole(role)]);
}

export function roleHasPermission(role: string | null | undefined, permission: string): boolean {
  if (!permission) return false;
  return permissionsForRole(role).has(permission);
}
