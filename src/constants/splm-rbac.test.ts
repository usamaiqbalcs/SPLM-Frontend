import { describe, expect, it } from 'vitest';
import {
  normalizeRole,
  permissionsForRole,
  roleHasPermission,
  SplmPermissions,
  SplmRoles,
} from '@/constants/splm-rbac';

describe('splm-rbac', () => {
  it('normalizes casing and unknown to viewer', () => {
    expect(normalizeRole('ADMIN')).toBe(SplmRoles.Admin);
    expect(normalizeRole('  Manager ')).toBe(SplmRoles.Manager);
    expect(normalizeRole('')).toBe(SplmRoles.Viewer);
    expect(normalizeRole('superuser')).toBe(SplmRoles.Viewer);
  });

  it('admin has audit and identity', () => {
    const p = permissionsForRole(SplmRoles.Admin);
    expect(p.has(SplmPermissions.AuditRead)).toBe(true);
    expect(p.has(SplmPermissions.IdentityManage)).toBe(true);
  });

  it('manager has config', () => {
    expect(roleHasPermission(SplmRoles.Manager, SplmPermissions.Config)).toBe(true);
  });

  it('viewer is read-only', () => {
    expect(roleHasPermission(SplmRoles.Viewer, SplmPermissions.Read)).toBe(true);
    expect(roleHasPermission(SplmRoles.Viewer, SplmPermissions.Edit)).toBe(false);
  });
});
