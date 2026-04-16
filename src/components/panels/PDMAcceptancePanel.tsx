import { useEffect, useMemo, useState } from 'react';
import { pdmSignoffApi, qaCyclesApi, PdmAcceptanceSignoffDto, QaCycleDto } from '@/lib/api-aisdlc';
import { listProductsForDropdown } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_LIST_PAGE_SIZE, ListPaginationBar } from '@/components/listing/listPageSearch';
import { SplmPageHeader } from '@/components/layout/SplmPageHeader';
import { Card } from '@/components/ui/card';

interface Product { id: string; name: string }

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
};

export default function PDMAcceptancePanel() {
  const [signoffRecords, setSignoffRecords] = useState<PdmAcceptanceSignoffDto[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [qaCycles, setQaCycles] = useState<QaCycleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PdmAcceptanceSignoffDto | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [createForm, setCreateForm] = useState({
    product_id: '',
    qa_cycle_id: '',
    business_flows_validated: false,
    no_p1_p2_open: false,
    perf_benchmarks_met: false,
    pdm_notes: '',
  });

  const [reviewForm, setReviewForm] = useState({
    business_flows_validated: false,
    no_p1_p2_open: false,
    perf_benchmarks_met: false,
    rejection_reason: '',
  });
  const [recordPage, setRecordPage] = useState(1);
  const recordTotalPages = Math.max(1, Math.ceil(signoffRecords.length / DEFAULT_LIST_PAGE_SIZE));
  const pagedSignoffRecords = useMemo(() => {
    const start = (recordPage - 1) * DEFAULT_LIST_PAGE_SIZE;
    return signoffRecords.slice(start, start + DEFAULT_LIST_PAGE_SIZE);
  }, [signoffRecords, recordPage]);

  useEffect(() => {
    setRecordPage((p) => Math.min(Math.max(1, p), recordTotalPages));
  }, [recordTotalPages]);

  const pdmCreateProductOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name })),
    [products],
  );
  const pdmCreateQaCycleOptions = useMemo(
    () =>
      qaCycles.map((c) => ({
        value: c.id,
        label: c.version_label ? `Cycle ${c.cycle_number}: ${c.version_label}` : `Cycle ${c.cycle_number}`,
      })),
    [qaCycles],
  );

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [productsData, cyclesData, recordsData] = await Promise.all([
          listProductsForDropdown(),
          qaCyclesApi.getAll(),      // ← was list()
          pdmSignoffApi.getAll(),    // ← was list()
        ]);
        setProducts(productsData);
        setQaCycles(cyclesData);
        setSignoffRecords(recordsData);
      } catch (error) {
        toast.error('Failed to load data');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const reloadRecords = async () => {
    const records = await pdmSignoffApi.getAll();   // ← was list()
    setSignoffRecords(records);
  };

  const handleCreateRecord = async () => {
    if (!createForm.product_id || !createForm.qa_cycle_id) {
      toast.error('Please select a product and QA cycle');
      return;
    }
    try {
      setSubmitting(true);
      await pdmSignoffApi.upsert({               // ← was create()
        product_id: createForm.product_id,
        qa_cycle_id: createForm.qa_cycle_id,
        business_flows_validated: createForm.business_flows_validated,
        no_p1_p2_open: createForm.no_p1_p2_open,
        perf_benchmarks_met: createForm.perf_benchmarks_met,
        pdm_notes: createForm.pdm_notes,
      });
      toast.success('Sign-off record created');
      await reloadRecords();
      setCreateDialogOpen(false);
      setCreateForm({ product_id: '', qa_cycle_id: '', business_flows_validated: false, no_p1_p2_open: false, perf_benchmarks_met: false, pdm_notes: '' });
    } catch (error) {
      toast.error('Failed to create sign-off record');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRecord) return;
    if (!reviewForm.business_flows_validated || !reviewForm.no_p1_p2_open || !reviewForm.perf_benchmarks_met) {
      toast.error('All gates must be checked to approve');
      return;
    }
    try {
      setSubmitting(true);
      // First update gate values via upsert, then mark approved
      await pdmSignoffApi.upsert({
        product_id: selectedRecord.product_id,
        qa_cycle_id: selectedRecord.qa_cycle_id,
        business_flows_validated: reviewForm.business_flows_validated,
        no_p1_p2_open: reviewForm.no_p1_p2_open,
        perf_benchmarks_met: reviewForm.perf_benchmarks_met,
        pdm_notes: selectedRecord.pdm_notes,
      });
      await pdmSignoffApi.approve(selectedRecord.id, { status: 'approved' }); // ← fixed signature
      toast.success('Sign-off approved successfully');
      await reloadRecords();
      setReviewDialogOpen(false);
      setSelectedRecord(null);
    } catch (error) {
      toast.error('Failed to approve sign-off');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRecord || !reviewForm.rejection_reason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      setSubmitting(true);
      // ← was pdmSignoffApi.reject(id, reason) — method doesn't exist; use approve with status 'rejected'
      await pdmSignoffApi.approve(selectedRecord.id, {
        status: 'rejected',
        rejection_reason: reviewForm.rejection_reason,
      });
      toast.success('Sign-off rejected');
      await reloadRecords();
      setReviewDialogOpen(false);
      setSelectedRecord(null);
    } catch (error) {
      toast.error('Failed to reject sign-off');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const openReviewDialog = (record: PdmAcceptanceSignoffDto) => {
    setSelectedRecord(record);
    setReviewForm({
      business_flows_validated: record.business_flows_validated,
      no_p1_p2_open: record.no_p1_p2_open,
      perf_benchmarks_met: record.perf_benchmarks_met,
      rejection_reason: record.rejection_reason || '',
    });
    setReviewDialogOpen(true);
  };

  const getProductName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  // ← was c.name (doesn't exist); QaCycleDto has cycle_number and version_label
  const getCycleName = (id: string) => {
    const c = qaCycles.find((c) => c.id === id);
    if (!c) return id;
    return c.version_label ? `Cycle ${c.cycle_number}: ${c.version_label}` : `Cycle ${c.cycle_number}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-6">
      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 font-medium">
          Production release requires PDM sign-off approval
        </AlertDescription>
      </Alert>

      <SplmPageHeader
        title="PDM acceptance sign-off"
        subtitle="Manage product deployment approvals and release gates before production."
        actions={
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create sign-off record</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Create Sign-Off Record</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <SearchableSelect
                  id="product"
                  options={pdmCreateProductOptions}
                  value={createForm.product_id}
                  onValueChange={(v) => setCreateForm({ ...createForm, product_id: v })}
                  placeholder="Select product"
                  searchPlaceholder="Search products…"
                  contentWidth="wide"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qa-cycle">QA Cycle</Label>
                <SearchableSelect
                  id="qa-cycle"
                  options={pdmCreateQaCycleOptions}
                  value={createForm.qa_cycle_id}
                  onValueChange={(v) => setCreateForm({ ...createForm, qa_cycle_id: v })}
                  placeholder="Select QA cycle"
                  searchPlaceholder="Search QA cycles…"
                  contentWidth="wide"
                />
              </div>

              <div className="space-y-3 border-t pt-4">
                <h4 className="text-sm font-semibold">Release Gates</h4>
                {[
                  { id: 'create-flows', field: 'business_flows_validated' as const, label: 'Business flows validated' },
                  { id: 'create-p1p2',  field: 'no_p1_p2_open'            as const, label: 'No P1/P2 open issues' },
                  { id: 'create-perf',  field: 'perf_benchmarks_met'       as const, label: 'Performance benchmarks met' },
                ].map(({ id, field, label }) => (
                  <div key={id} className="flex items-center gap-3">
                    <Checkbox id={id} checked={createForm[field]} onCheckedChange={(v) => setCreateForm({ ...createForm, [field]: Boolean(v) })} />
                    <Label htmlFor={id} className="text-sm cursor-pointer flex-1">{label}</Label>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdm-notes">Notes</Label>
                <Textarea id="pdm-notes" placeholder="Add any notes..." value={createForm.pdm_notes}
                  onChange={(e) => setCreateForm({ ...createForm, pdm_notes: e.target.value })} className="min-h-20" />
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>Cancel</Button>
                <Button onClick={handleCreateRecord} disabled={submitting}>
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        }
      />

      {/* Single listing card: table + inset pagination share width (avoids footer narrower than grid). */}
      <Card className="flex min-w-0 flex-col overflow-hidden border-border/80 shadow-splm">
        {signoffRecords.length === 0 ? (
          <div className="flex items-center justify-center px-4 py-16 text-sm text-muted-foreground">
            <p>No sign-off records yet. Create one to get started.</p>
          </div>
        ) : (
          <Table wrapperClassName="overflow-x-auto overflow-y-visible">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>QA Cycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gates</TableHead>
                <TableHead>Signed Off By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedSignoffRecords.map((record) => (
                <TableRow key={record.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{getProductName(record.product_id)}</TableCell>
                  <TableCell>{getCycleName(record.qa_cycle_id)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG].color}>
                      {STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <span className="text-xs">{record.business_flows_validated ? '✓' : '✗'}</span>
                      <span className="text-xs">{record.no_p1_p2_open ? '✓' : '✗'}</span>
                      <span className="text-xs">{record.perf_benchmarks_met ? '✓' : '✗'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {record.signed_off_by_name ?? '—'}   {/* ← was signed_off_by */}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openReviewDialog(record)}>
                      {record.status === 'pending' ? 'Review' : 'View'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ListPaginationBar
          variant="inset"
          page={recordPage}
          totalPages={recordTotalPages}
          totalItems={signoffRecords.length}
          pageSize={DEFAULT_LIST_PAGE_SIZE}
          onPageChange={setRecordPage}
          disabled={submitting}
        />
      </Card>

      {/* Review Dialog */}
      {selectedRecord && (
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Review Sign-Off: {getProductName(selectedRecord.product_id)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded text-sm space-y-1">
                <p><span className="font-semibold">Product:</span> {getProductName(selectedRecord.product_id)}</p>
                <p><span className="font-semibold">QA Cycle:</span> {getCycleName(selectedRecord.qa_cycle_id)}</p>
                <p><span className="font-semibold">Status:</span>{' '}
                  <Badge className={STATUS_CONFIG[selectedRecord.status as keyof typeof STATUS_CONFIG].color}>
                    {STATUS_CONFIG[selectedRecord.status as keyof typeof STATUS_CONFIG].label}
                  </Badge>
                </p>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h4 className="text-sm font-semibold">Release Gates</h4>
                {[
                  { id: 'review-flows', field: 'business_flows_validated' as const, label: 'Business flows validated' },
                  { id: 'review-p1p2',  field: 'no_p1_p2_open'            as const, label: 'No P1/P2 open issues' },
                  { id: 'review-perf',  field: 'perf_benchmarks_met'       as const, label: 'Performance benchmarks met' },
                ].map(({ id, field, label }) => (
                  <div key={id} className="flex items-center gap-3">
                    <Checkbox id={id} checked={reviewForm[field]}
                      onCheckedChange={(v) => setReviewForm({ ...reviewForm, [field]: Boolean(v) })}
                      disabled={selectedRecord.status !== 'pending'} />
                    <Label htmlFor={id} className="text-sm cursor-pointer flex-1">{label}</Label>
                  </div>
                ))}
              </div>

              {selectedRecord.status === 'rejected' && selectedRecord.rejection_reason && (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 text-sm">
                    <strong>Rejection Reason:</strong> {selectedRecord.rejection_reason}
                  </AlertDescription>
                </Alert>
              )}

              {selectedRecord.status === 'pending' && (
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason">Rejection Reason (if rejecting)</Label>
                  <Textarea id="rejection-reason" placeholder="Provide a reason for rejection..."
                    value={reviewForm.rejection_reason}
                    onChange={(e) => setReviewForm({ ...reviewForm, rejection_reason: e.target.value })}
                    className="min-h-20" />
                </div>
              )}

              {selectedRecord.pdm_notes && (
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{selectedRecord.pdm_notes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setReviewDialogOpen(false)} disabled={submitting}>Close</Button>
                {selectedRecord.status === 'pending' && (
                  <>
                    <Button variant="destructive" onClick={handleReject}
                      disabled={submitting || !reviewForm.rejection_reason.trim()}>
                      {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rejecting...</> : 'Reject'}
                    </Button>
                    <Button onClick={handleApprove}
                      disabled={submitting || !reviewForm.business_flows_validated || !reviewForm.no_p1_p2_open || !reviewForm.perf_benchmarks_met}
                      className="bg-green-600 hover:bg-green-700">
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Approving...</>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4 mr-2" />Approve</>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
