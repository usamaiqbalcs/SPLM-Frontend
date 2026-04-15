import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminRbacApi,
  type RbacMatrixDto,
  type RbacPermissionRowDto,
  type RbacRoleRowDto,
} from '@/lib/apiClient';
import { SplmPermissions } from '@/constants/splm-rbac';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

/** Rows = permissions, columns = roles — matches backend matrix DTO. */
export default function AdminRbacPanel() {
  const { can, refreshProfile } = useAuth();
  const [matrix, setMatrix] = useState<RbacMatrixDto | null>(null);
  const [draft, setDraft] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = useMemo(
    () => (matrix?.roles ?? []).filter((r) => r.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [matrix],
  );
  const permissions = useMemo(
    () =>
      (matrix?.permissions ?? [])
        .filter((p) => p.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [matrix],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await adminRbacApi.getMatrix();
      setMatrix(m);
      const next: Record<string, Set<string>> = {};
      for (const r of m.roles.filter((x) => x.is_active)) {
        const list = m.role_permissions[r.name] ?? [];
        next[r.name] = new Set(list);
      }
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load RBAC matrix.');
      setMatrix(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (roleName: string, permName: string, checked: boolean) => {
    setDraft((prev) => {
      const copy: Record<string, Set<string>> = {};
      for (const k of Object.keys(prev)) copy[k] = new Set(prev[k]);
      if (!copy[roleName]) copy[roleName] = new Set();
      const s = new Set(copy[roleName]);
      if (checked) s.add(permName);
      else s.delete(permName);
      copy[roleName] = s;
      return copy;
    });
  };

  const dirty = useMemo(() => {
    if (!matrix) return false;
    for (const r of roles) {
      const orig = new Set(matrix.role_permissions[r.name] ?? []);
      const cur = draft[r.name] ?? new Set();
      if (orig.size !== cur.size) return true;
      for (const p of cur) if (!orig.has(p)) return true;
      for (const p of orig) if (!cur.has(p)) return true;
    }
    return false;
  }, [matrix, roles, draft]);

  const saveAll = async () => {
    if (!matrix) return;
    setSaving(true);
    try {
      for (const r of roles) {
        const names = Array.from(draft[r.name] ?? []).sort();
        await adminRbacApi.updateRolePermissions(r.name, names);
      }
      toast.success('RBAC matrix saved. Permission cache was cleared on the server.');
      await load();
      await refreshProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!can(SplmPermissions.IdentityManage)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading RBAC matrix…</div>;
  }

  if (error || !matrix) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-destructive">{error ?? 'No data.'}</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
        <p className="text-sm text-muted-foreground">
          Ensure SQL script <code className="rounded bg-muted px-1">Backend/scripts/20260419_rbac_normalized.sql</code>{' '}
          has been applied to this database.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Role permissions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Edit which permissions each application role has. Only administrators may save changes. The server remains
          authoritative for API access.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" onClick={() => void saveAll()} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={saving}>
          Reload
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px] sticky left-0 bg-background z-[1]">Permission</TableHead>
              {roles.map((r: RbacRoleRowDto) => (
                <TableHead key={r.name} className="text-center min-w-[100px] capitalize">
                  {r.display_name ?? r.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((p: RbacPermissionRowDto) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium sticky left-0 bg-background z-[1]">
                  <div>{p.name}</div>
                  {p.description ? (
                    <div className="text-xs text-muted-foreground font-normal">{p.description}</div>
                  ) : null}
                </TableCell>
                {roles.map((r: RbacRoleRowDto) => {
                  const set = draft[r.name] ?? new Set();
                  const checked = set.has(p.name);
                  return (
                    <TableCell key={`${r.name}-${p.name}`} className="text-center">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggle(r.name, p.name, v === true)}
                        aria-label={`${r.name} ${p.name}`}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
