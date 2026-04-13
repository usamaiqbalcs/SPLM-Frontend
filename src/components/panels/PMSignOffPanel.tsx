import { useEffect, useState } from 'react';
import { pmChecklistApi, PmSignoffChecklistDto } from '@/lib/api-aisdlc';
import { listProductsPage } from '@/lib/api';
import { ListPageSearchInput, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
}

interface ChecklistItem {
  item: string;
  completed: boolean;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { item: 'All defined features are present and navigable in the beta build', completed: false },
  { item: 'Business flows have been validated by the PM against requirements', completed: false },
  { item: 'UI/UX designer has signed off on interface consistency', completed: false },
  { item: 'Application is deployed and accessible in the dedicated QA testing environment', completed: false },
];

export default function PMSignOffPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productTotalCount, setProductTotalCount] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [notes, setNotes] = useState('');
  const [signoffData, setSignoffData] = useState<PmSignoffChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useListPageSearchDebounce(productSearch);

  useEffect(() => {
    setProductPage(1);
  }, [debouncedProductSearch]);

  useEffect(() => {
    let cancelled = false;
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await listProductsPage({
          page: productPage,
          pageSize: 10,
          search: debouncedProductSearch || undefined,
        });
        if (cancelled) return;
        const data: Product[] = (res.items ?? []).map((p: { id: string; name?: string }) => ({
          id: p.id,
          name: p.name ?? p.id,
        }));
        setProducts(data);
        setProductTotalPages(Math.max(1, res.total_pages ?? 1));
        setProductTotalCount(res.total_count ?? data.length);
        setSelectedProductId((cur) => {
          if (data.length === 0) return null;
          if (cur && data.some((p) => p.id === cur)) return cur;
          return data[0].id;
        });
      } catch (error) {
        if (!cancelled) {
          toast.error('Failed to load products');
          console.error(error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [productPage, debouncedProductSearch]);

  // Load checklist when product changes
  useEffect(() => {
    if (!selectedProductId) return;
    const fetchChecklist = async () => {
      try {
        setLoading(true);
        const data = await pmChecklistApi.get(selectedProductId);   // ← was getByProduct
        if (data) {
          setSignoffData(data);
          const parsed = JSON.parse(data.items || '[]');            // ← was checklist_json
          setChecklist(parsed.length > 0 ? parsed : DEFAULT_CHECKLIST);
          setNotes(data.notes || '');
        } else {
          setSignoffData(null);
          setChecklist(DEFAULT_CHECKLIST);
          setNotes('');
        }
      } catch {
        setChecklist(DEFAULT_CHECKLIST);
        setNotes('');
      } finally {
        setLoading(false);
      }
    };
    fetchChecklist();
  }, [selectedProductId]);

  const toggleItem = (index: number) => {
    const updated = [...checklist];
    updated[index].completed = !updated[index].completed;
    setChecklist(updated);
  };

  const completedCount = checklist.filter((i) => i.completed).length;
  const totalCount = checklist.length;
  const progressPercent = (completedCount / totalCount) * 100;
  const allComplete = completedCount === totalCount;

  const handleSaveChanges = async () => {
    if (!selectedProductId) return;
    try {
      setSaving(true);
      await pmChecklistApi.upsert({
        product_id: selectedProductId,
        items: JSON.stringify(checklist),           // ← was checklist_json
        all_complete: false,
        notes,
      });
      toast.success('Changes saved successfully');
    } catch (error) {
      toast.error('Failed to save changes');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOff = async () => {
    if (!selectedProductId || !allComplete) return;
    try {
      setSaving(true);
      await pmChecklistApi.upsert({
        product_id: selectedProductId,
        items: JSON.stringify(checklist),           // ← was checklist_json
        all_complete: true,
        notes,
      });
      toast.success('PM sign-off completed successfully');
      const data = await pmChecklistApi.get(selectedProductId);  // ← was getByProduct
      if (data) setSignoffData(data);
    } catch (error) {
      toast.error('Failed to complete sign-off');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div className="flex h-full gap-4 p-6">
      {/* Left Sidebar: Product List */}
      <div className="w-64 border-r overflow-y-auto flex flex-col">
        <h3 className="text-sm font-semibold mb-2">Products</h3>
        <ListPageSearchInput
          value={productSearch}
          onChange={setProductSearch}
          className="w-full h-8 text-xs mb-2"
          placeholder="Search products…"
          aria-label="Search products for sign-off"
        />
        <p className="text-[10px] text-muted-foreground mb-3 tabular-nums">
          Page {productPage} of {productTotalPages} ({productTotalCount} total)
        </p>
        <div className="space-y-2 flex-1">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelectedProductId(product.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedProductId === product.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {product.name}
            </button>
          ))}
        </div>
        {productTotalPages > 1 && (
          <div className="flex gap-2 pt-3 mt-auto border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={loading || productPage <= 1}
              onClick={() => setProductPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={loading || productPage >= productTotalPages}
              onClick={() => setProductPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Right Content: Checklist */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {selectedProduct && (
          <>
            <div>
              <h2 className="text-2xl font-bold mb-2">{selectedProduct.name}</h2>
              <p className="text-sm text-muted-foreground mb-6">PM Sign-Off Checklist</p>
            </div>

            {/* Sign-off Status Banner */}
            {signoffData?.all_complete && (
              <Alert className="mb-6 border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {/* ← was signed_off_by, now signed_off_by_name */}
                  Signed off by {signoffData.signed_off_by_name ?? 'PM'} on{' '}
                  {signoffData.signed_off_at
                    ? new Date(signoffData.signed_off_at).toLocaleDateString()
                    : '—'}
                </AlertDescription>
              </Alert>
            )}

            {/* Progress */}
            <Card className="p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Progress</h3>
                <span className="text-sm font-medium">
                  {completedCount} of {totalCount} complete
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">{Math.round(progressPercent)}%</p>
            </Card>

            {/* Checklist Items */}
            <Card className="p-6 mb-6 flex-1 overflow-y-auto">
              <h3 className="font-semibold mb-4">Checklist Items</h3>
              <div className="space-y-3">
                {checklist.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-2">
                    <Checkbox
                      id={`item-${idx}`}
                      checked={item.completed}
                      onCheckedChange={() => toggleItem(idx)}
                      disabled={signoffData?.all_complete || false}
                      className="mt-1"
                    />
                    <label
                      htmlFor={`item-${idx}`}
                      className={`text-sm leading-relaxed cursor-pointer flex-1 ${
                        item.completed ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {item.item}
                    </label>
                  </div>
                ))}
              </div>
            </Card>

            {/* Notes */}
            <Card className="p-6 mb-6">
              <h3 className="font-semibold mb-3">Notes</h3>
              <Textarea
                placeholder="Add notes about this sign-off..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={signoffData?.all_complete || false}
                className="min-h-24"
              />
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleSaveChanges}
                disabled={saving || signoffData?.all_complete || false}
                variant="outline"
              >
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
              </Button>
              <Button
                onClick={handleSignOff}
                disabled={!allComplete || saving || signoffData?.all_complete || false}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing Off...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" />Sign Off</>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
