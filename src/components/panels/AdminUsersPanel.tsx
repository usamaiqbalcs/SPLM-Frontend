import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminUsersApi,
  type AdminUserListItemDto,
} from '@/lib/apiClient';
import { SplmRoles } from '@/constants/splm-rbac';
import { fmtDateTime } from '@/lib/splm-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';
import { ListPaginationBar } from '@/components/listing/listPageSearch';

const ROLE_OPTIONS = [SplmRoles.Admin, SplmRoles.Manager, SplmRoles.Developer, SplmRoles.Viewer];
const APP_ROLE_SELECT_OPTIONS = ROLE_OPTIONS.map((r) => ({ value: r, label: r }));

export default function AdminUsersPanel() {
  const { can, user, refreshProfile } = useAuth();
  const [items, setItems] = useState<AdminUserListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState(SplmRoles.Viewer);
  const [createBusy, setCreateBusy] = useState(false);
  const [createFieldErrors, setCreateFieldErrors] = useState<{
    email?: string;
    name?: string;
    password?: string;
  }>({});

  const [resetTarget, setResetTarget] = useState<AdminUserListItemDto | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUsersApi.getPage({ page, pageSize, search: search || undefined });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const onRoleChange = async (row: AdminUserListItemDto, role: string) => {
    try {
      await adminUsersApi.patchRole(row.user_id, role);
      toast.success('Role updated.');
      if (row.user_id === user?.id) await refreshProfile();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update role.');
    }
  };

  const onActiveToggle = async (row: AdminUserListItemDto) => {
    try {
      await adminUsersApi.patchActive(row.user_id, !row.active);
      toast.success(row.active ? 'User deactivated.' : 'User activated.');
      if (row.user_id === user?.id) await refreshProfile();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update status.');
    }
  };

  const onSendPasswordReset = async () => {
    if (!resetTarget) return;
    setResetBusy(true);
    try {
      const res = await adminUsersApi.sendPasswordReset(resetTarget.user_id);
      toast.success(res.message || 'Password reset link sent.');
      setResetTarget(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not send reset link.';
      if (msg.includes('HTTP 429') || msg.toLowerCase().includes('rate')) {
        toast.error('Too many reset requests. Please wait a minute and try again.');
      } else {
        toast.error(msg);
      }
    } finally {
      setResetBusy(false);
    }
  };

  const onCreate = async () => {
    const next: { email?: string; name?: string; password?: string } = {};
    const email = createEmail.trim();
    const name = createName.trim();
    if (!email) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address';
    if (!name) next.name = 'Display name is required';
    if (!createPassword) next.password = 'Password is required';
    else if (createPassword.length < 8) next.password = 'Use at least 8 characters';
    setCreateFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setCreateBusy(true);
    try {
      await adminUsersApi.createUser({
        email,
        name,
        password: createPassword,
        role: createRole,
      });
      toast.success('User created.');
      setCreateOpen(false);
      setCreateEmail('');
      setCreateName('');
      setCreatePassword('');
      setCreateRole(SplmRoles.Viewer);
      setCreateFieldErrors({});
      setPage(1);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create user.');
    } finally {
      setCreateBusy(false);
    }
  };

  if (!can('identity.manage')) {
    return <Navigate to="/dashboard" replace />;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-0 min-w-0 space-y-4">
      <SplmPageHeader
        title="Users"
        subtitle="Search accounts, assign application roles, activate or deactivate access, and send password resets."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            + Create user
          </Button>
        }
      />

      <div className="rounded-lg border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-[200px] gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Search
            </label>
            <Input
              placeholder="Email or name"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applySearch()}
            />
          </div>
          <Button type="button" variant="secondary" onClick={applySearch}>
            Search
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Table + footer in one bordered shell so pagination lines up with columns (same root cause as other admin lists). */}
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
        <Table wrapperClassName="overflow-x-auto overflow-y-visible">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No users match your filters.
                </TableCell>
              </TableRow>
            ) : (
              items.map(row => (
                <TableRow key={row.user_id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>
                    <SearchableSelect
                      className="min-w-[140px]"
                      size="sm"
                      triggerClassName="h-9"
                      options={APP_ROLE_SELECT_OPTIONS}
                      value={row.role}
                      onValueChange={(v) => void onRoleChange(row, v)}
                      searchPlaceholder="Search role…"
                    />
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        row.active
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground line-through'
                      }
                    >
                      {row.active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {fmtDateTime(row.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => setResetTarget(row)}>
                        Send reset link
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={row.active ? 'outline' : 'default'}
                        onClick={() => void onActiveToggle(row)}
                      >
                        {row.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && total > 0 && (
          <ListPaginationBar
            variant="inset"
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            disabled={loading}
          />
        )}
      </div>

      <Dialog open={resetTarget !== null} onOpenChange={open => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send password reset link</DialogTitle>
          </DialogHeader>
          {resetTarget && (
            <p className="text-sm text-muted-foreground py-1">
              Email a one-time reset link to <span className="font-medium text-foreground">{resetTarget.email}</span>
              ? Prior unused links for this user will be invalidated.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={resetBusy} onClick={() => void onSendPasswordReset()}>
              {resetBusy ? 'Sending…' : 'Send link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateFieldErrors({});
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input
                value={createEmail}
                onChange={(e) => {
                  setCreateFieldErrors((p) => ({ ...p, email: undefined }));
                  setCreateEmail(e.target.value);
                }}
                autoComplete="off"
                aria-invalid={!!createFieldErrors.email}
                className={createFieldErrors.email ? 'border-destructive' : undefined}
              />
              {createFieldErrors.email ? (
                <p className="text-xs text-destructive">{createFieldErrors.email}</p>
              ) : null}
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Display name</label>
              <Input
                value={createName}
                onChange={(e) => {
                  setCreateFieldErrors((p) => ({ ...p, name: undefined }));
                  setCreateName(e.target.value);
                }}
                autoComplete="off"
                aria-invalid={!!createFieldErrors.name}
                className={createFieldErrors.name ? 'border-destructive' : undefined}
              />
              {createFieldErrors.name ? (
                <p className="text-xs text-destructive">{createFieldErrors.name}</p>
              ) : null}
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <Input
                type="password"
                value={createPassword}
                onChange={(e) => {
                  setCreateFieldErrors((p) => ({ ...p, password: undefined }));
                  setCreatePassword(e.target.value);
                }}
                autoComplete="new-password"
                aria-invalid={!!createFieldErrors.password}
                className={createFieldErrors.password ? 'border-destructive' : undefined}
              />
              {createFieldErrors.password ? (
                <p className="text-xs text-destructive">{createFieldErrors.password}</p>
              ) : null}
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">App role</label>
              <SearchableSelect
                size="sm"
                triggerClassName="h-9"
                options={APP_ROLE_SELECT_OPTIONS}
                value={createRole}
                onValueChange={setCreateRole}
                searchPlaceholder="Search role…"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              App role is stored in <code className="rounded bg-muted px-1">profiles.role</code> (authorization).
              It is not the same as a roster job title on the Team screen.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={createBusy} onClick={() => void onCreate()}>
              {createBusy ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
