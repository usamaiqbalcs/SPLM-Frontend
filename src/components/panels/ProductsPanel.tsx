import { useEffect, useState } from 'react';
import { listProductsPage, getProduct, saveProduct, deleteProduct } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { ListPageSearchInput, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { StatusBadge, PriorityBar } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

/** Map legacy UI/DB status values to values allowed by chk_product_status. */
function normalizeProductStatus(s: string | undefined): string {
  const legacy: Record<string, string> = {
    draft: 'active',
    deprecated: 'maintenance',
    retired: 'archived',
    in_development: 'active',
    planned: 'active',
    staging: 'maintenance',
  };
  const v = (s || 'active').toLowerCase().trim();
  const out = legacy[v] ?? v;
  return ['active', 'maintenance', 'sunset', 'archived'].includes(out) ? out : 'active';
}

function mapProductToForm(row: Record<string, unknown>) {
  return {
    ...row,
    status: normalizeProductStatus(row.status as string | undefined),
    customer_count: Math.max(0, Math.floor(Number(row.customer_count ?? 0))),
    external_apis: row.external_apis != null ? String(row.external_apis) : '',
    type: row.type != null ? String(row.type) : 'web_app',
  };
}

export default function ProductsPanel() {
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const debouncedFilter = useListPageSearchDebounce(filter);
  const [statusF, setStatusF] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedFilter, statusF]);

  const load = () => {
    setLoading(true);
    listProductsPage({
      page,
      pageSize,
      search: debouncedFilter || undefined,
      status: statusF || undefined,
      sortBy: 'name',
      sortDir: 'asc',
    })
      .then((r) => {
        setItems(r.items);
        setTotalPages(Math.max(1, r.total_pages));
        setTotalCount(r.total_count);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [page, debouncedFilter, statusF]);

  const blank = {
    name: '',
    description: '',
    status: 'active',
    type: 'web_app',
    update_cadence: 'quarterly',
    market_category: 'Enterprise SaaS',
    tech_stack: '',
    external_apis: '',
    customer_count: 0,
    current_version: '1.0.0',
    priority_score: 0,
  };

  const doSave = async () => {
    if (!form.name) return toast.error('Product name is required');
    setSaving(true);
    try { await saveProduct(form); toast.success(form.id ? 'Product updated' : 'Product created'); load(); setForm(null); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    try { await deleteProduct(deleteId); toast.success('Product deleted'); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setDeleteId(null); }
  };

  if (form) return (
    <div className="bg-card rounded-lg border p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-primary">{form.id ? 'Edit Product' : 'New Product'}</h3>
        <Button variant="outline" onClick={() => setForm(null)}>← Back</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div><Label>Product Name *</Label><Input value={form.name || ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
        <div><Label>Market Category</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.market_category} onChange={e => setForm((f: any) => ({ ...f, market_category: e.target.value }))}>{['Enterprise SaaS', 'Defense', 'DaaS', 'IoT', 'Internal Tool', 'Other'].map(o => <option key={o}>{o}</option>)}</select></div>
        <div><Label>Status</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>{['active', 'maintenance', 'sunset', 'archived'].map(o => <option key={o}>{o}</option>)}</select></div>
        <div><Label>Update Cadence</Label><select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.update_cadence} onChange={e => setForm((f: any) => ({ ...f, update_cadence: e.target.value }))}>{['monthly', 'quarterly', 'yearly', 'on_demand'].map(o => <option key={o}>{o}</option>)}</select></div>
        <div><Label>Current Version</Label><Input className="font-mono" value={form.current_version || '1.0.0'} onChange={e => setForm((f: any) => ({ ...f, current_version: e.target.value }))} /></div>
        <div><Label>Customer Count</Label><Input type="number" min={0} value={form.customer_count || 0} onChange={e => setForm((f: any) => ({ ...f, customer_count: parseInt(e.target.value) || 0 }))} /></div>
        <div className="md:col-span-2"><Label>Description</Label><textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] bg-background" value={form.description || ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
        <div><Label>Tech Stack</Label><Input value={form.tech_stack || ''} onChange={e => setForm((f: any) => ({ ...f, tech_stack: e.target.value }))} placeholder="Flask, React, PostgreSQL" /></div>
        <div><Label>External APIs</Label><Input value={form.external_apis || ''} onChange={e => setForm((f: any) => ({ ...f, external_apis: e.target.value }))} placeholder="Twilio, Stripe" /></div>
      </div>
      <div className="flex gap-2">
        <Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</Button>
        <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete Product"
        description="This will permanently delete the product and all related data. This action cannot be undone."
        confirmLabel="Delete Product"
        variant="destructive"
        onConfirm={doDelete}
      />
      <div className="bg-card rounded-lg border p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-primary">
            📦 Products
            <span className="text-muted-foreground font-normal text-sm ml-2">
              ({items.length} of {totalCount.toLocaleString()})
            </span>
          </h3>
          <div className="flex gap-2 flex-wrap">
            <ListPageSearchInput value={filter} onChange={setFilter} />
            <select className="border rounded-md px-3 py-2 text-sm bg-background" value={statusF} onChange={e => setStatusF(e.target.value)}>
              <option value="">All Statuses</option>
              {['active', 'maintenance', 'sunset', 'archived'].map(o => <option key={o}>{o}</option>)}
            </select>
            {can('edit') && <Button onClick={() => setForm({ ...blank })}>+ New Product</Button>}
          </div>
        </div>
        {loading ? <TableSkeleton /> :
          items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <span className="text-4xl mb-3">📦</span>
              <p className="font-medium">No products found</p>
              <p className="text-xs mt-1">Create your first product to get started</p>
            </div>
          ) :
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted">{['Product', 'Version', 'Status', 'Priority', 'Cadence', 'Customers', 'Actions'].map(h => <th key={h} className="text-left px-3 py-2 font-bold text-xs text-foreground">{h}</th>)}</tr></thead>
                <tbody>{items.map(p => (
                  <tr key={p.id} className="border-b border-muted hover:bg-muted/50 transition-colors group">
                    <td className="px-3 py-3"><div className="font-semibold">{p.name}</div><div className="text-xs text-muted-foreground truncate max-w-[200px]">{p.description}</div></td>
                    <td className="px-3 py-3"><code className="bg-muted px-2 py-0.5 rounded text-xs font-semibold">{p.current_version ? `v${p.current_version}` : '—'}</code></td>
                    <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-3"><PriorityBar score={Number(p.priority_score || 0)} /></td>
                    <td className="px-3 py-3"><StatusBadge status={p.update_cadence || 'quarterly'} /></td>
                    <td className="px-3 py-3">{p.customer_count || 0}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        {can('edit') && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loadingEditId === p.id}
                            onClick={async () => {
                              setLoadingEditId(p.id);
                              try {
                                const full = await getProduct(p.id);
                                setForm(mapProductToForm(full as Record<string, unknown>));
                              } catch (e: unknown) {
                                const msg = e instanceof Error ? e.message : 'Failed to load product';
                                toast.error(msg);
                                setForm(mapProductToForm(p as Record<string, unknown>));
                              } finally {
                                setLoadingEditId(null);
                              }
                            }}
                          >
                            {loadingEditId === p.id ? '…' : 'Edit'}
                          </Button>
                        )}
                        {can('edit') && <Button size="sm" variant="destructive" onClick={() => setDeleteId(p.id)}>Delete</Button>}
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
        }
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
