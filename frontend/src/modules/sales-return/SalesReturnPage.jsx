import { useMemo, useState } from 'react';
import {
  Stack, Box, Typography, Button, Menu, MenuItem, Grid, Breadcrumbs, Link as MuiLink,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { showToast } from '../../features/ui/uiSlice';
import {
  useNextSalesReturnNoQuery, useLazyLookupOriginalInvoiceQuery, useCreateSalesReturnMutation,
  useUploadSalesReturnEvidenceMutation,
} from '../../api/salesReturnApi';
import { useCompanyProfileQuery } from '../../api/companyApi';
import { printReturnReceipt } from '../line-sale/receiptPrint';

import ReturnItemsPanel from './components/ReturnItemsPanel';
import ReturnCartPanel from './components/ReturnCartPanel';
import ReturnInfoRow from './components/ReturnInfoRow';
import ReturnReasonCard from './components/ReturnReasonCard';
import RefundAdjustmentCard from './components/RefundAdjustmentCard';
import ReturnTotalsCard from './components/ReturnTotalsCard';
import OriginalInvoiceSummaryCard from './components/OriginalInvoiceSummaryCard';
import RefundSummaryCard from './components/RefundSummaryCard';
import PaymentMethodSummaryCard from './components/PaymentMethodSummaryCard';
import ReturnActionsCard from './components/ReturnActionsCard';
import FindInvoiceDialog from './components/FindInvoiceDialog';
import EvidenceDialog from './components/EvidenceDialog';
import { RETURN_REASONS, REFUND_PAYMENT_METHODS } from './salesReturnConstants';

const WALK_IN_CUSTOMER_NAME = 'Walk-in Customer';

const PAYMENT_METHOD_LABEL = {
  cash: 'Cash', upi: 'UPI', card: 'Card', wallet: 'Wallet', credit: 'Credit',
};

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

/**
 * Sales Return (POS refund) screen — find the original invoice, pick which
 * lines are coming back, capture why, and settle the refund. Fully wired to
 * the real backend (see backend/src/modules/sales-return): "Find Original
 * Invoice" looks up an actual Sale by its billNo, each returnable line's
 * remaining qty is computed from real prior returns (never fabricated),
 * and "Process Return" writes a real SalesReturn + SalesReturnItem rows,
 * validated again server-side (over-returning a line is rejected there even
 * if this page's own qty caps were somehow bypassed).
 */
export default function SalesReturnPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [originalInvoice, setOriginalInvoice] = useState(null);
  const [cart, setCart] = useState([]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [refundMode, setRefundMode] = useState('refund');
  const [refundTo, setRefundTo] = useState('');
  const [printSettingsEnabled, setPrintSettingsEnabled] = useState(false);
  const [moreActionsAnchor, setMoreActionsAnchor] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Snapshot of the last processed return, so "Print Return" still works
  // after Process Return has reset the working form.
  const [lastReturn, setLastReturn] = useState(null);

  const { data: returnNo } = useNextSalesReturnNoQuery();
  const [lookupInvoice, { isFetching: isLookingUp }] = useLazyLookupOriginalInvoiceQuery();
  const [createSalesReturn, { isLoading: isProcessing }] = useCreateSalesReturnMutation();
  const [uploadEvidence] = useUploadSalesReturnEvidenceMutation();
  const { data: companyProfile } = useCompanyProfileQuery();

  const returnDate = useMemo(
    () => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()),
    [],
  );

  // The items panel's "returnable" figure accounts for lines already added
  // to *this* not-yet-submitted cart too, on top of what the backend
  // reported as returnable — so a user can't add the same line twice past
  // what's actually left, without a round trip per click.
  const displayItems = useMemo(() => {
    if (!originalInvoice) return [];
    return originalInvoice.items.map((item) => {
      const inCart = cart.find((line) => line.saleLineId === item.saleLineId);
      return { ...item, returnableQty: Math.max(item.returnableQty - (inCart?.qty || 0), 0) };
    });
  }, [originalInvoice, cart]);

  const totals = useMemo(() => {
    const subTotal = cart.reduce((sum, line) => sum + line.qty * line.rate, 0);
    const discountAmount = 0;
    const taxable = Math.max(subTotal - discountAmount, 0);
    const tax = cart.reduce((sum, line) => sum + line.qty * line.rate * line.taxRate, 0);
    const grandTotal = taxable + tax;
    return { subTotal, discountAmount, tax, grandTotal };
  }, [cart]);

  const handleOpenFindInvoice = () => {
    setDialogError('');
    setDialogOpen(true);
  };

  const handleFindInvoiceSubmit = async (billNo) => {
    try {
      const data = await lookupInvoice(billNo).unwrap();
      setOriginalInvoice(data);
      setCart([]);
      setDialogOpen(false);
      setDialogError('');
    } catch (err) {
      setDialogError(err?.data?.message || 'No invoice found with that bill number');
    }
  };

  const handleAddItem = (saleLineId) => {
    const item = originalInvoice?.items.find((i) => i.saleLineId === saleLineId);
    if (!item) return;
    setCart((prev) => {
      const existing = prev.find((line) => line.saleLineId === saleLineId);
      if (existing) {
        return prev.map((line) => (
          line.saleLineId === saleLineId ? { ...line, qty: Math.min(item.returnableQty, line.qty + 1) } : line
        ));
      }
      if (item.returnableQty <= 0) return prev;
      return [...prev, {
        saleLineId,
        code: item.code,
        name: item.name,
        uom: item.uom,
        rate: item.rate,
        taxRate: item.taxRate,
        qty: 1,
        maxQty: item.returnableQty,
      }];
    });
  };

  const handleQtyChange = (saleLineId, qty) => {
    setCart((prev) => prev.map((line) => (line.saleLineId === saleLineId ? { ...line, qty } : line)));
  };

  const handleRemove = (saleLineId) => {
    setCart((prev) => prev.filter((line) => line.saleLineId !== saleLineId));
  };

  const handleClear = () => {
    setCart([]);
    setReason('');
    setNote('');
    setRefundTo('');
    dispatch(showToast('Return cleared', 'info'));
  };
  // One click selects every line that still has something left to return, at
  // its full remaining qty (the invoice's returnableQty already nets off
  // earlier returns, so a partly-returned line only adds what's left).
  const handleReturnAll = () => {
    setMoreActionsAnchor(null);
    if (!originalInvoice) {
      dispatch(showToast('Find the original invoice first', 'warning'));
      return;
    }
    const returnable = originalInvoice.items.filter((item) => item.returnableQty > 0);
    if (returnable.length === 0) {
      dispatch(showToast('Every item on this invoice has already been returned', 'info'));
      return;
    }
    setCart(returnable.map((item) => ({
      saleLineId: item.saleLineId,
      code: item.code,
      name: item.name,
      uom: item.uom,
      rate: item.rate,
      taxRate: item.taxRate,
      qty: item.returnableQty,
      maxQty: item.returnableQty,
    })));
    dispatch(showToast(`${returnable.length} item${returnable.length === 1 ? '' : 's'} added for return`, 'success'));
  };

  const handleOpenEvidence = () => {
    setMoreActionsAnchor(null);
    setEvidenceOpen(true);
  };

  // A return is only saved when "Process Return" succeeds (there is no
  // draft/pending record), so cancelling just discards the in-progress form.
  const handleOpenCancel = () => {
    setMoreActionsAnchor(null);
    if (!originalInvoice && cart.length === 0 && evidence.length === 0 && !reason && !note) {
      dispatch(showToast('There is no return in progress', 'info'));
      return;
    }
    setCancelOpen(true);
  };
  const handleConfirmCancel = () => {
    setCancelOpen(false);
    setOriginalInvoice(null);
    setCart([]);
    setReason('');
    setNote('');
    setRefundMode('refund');
    setRefundTo('');
    setEvidence([]);
    dispatch(showToast('Return cancelled', 'info'));
  };
  const handleAddCustomer = () => dispatch(showToast('Add Customer is coming soon', 'info'));

  const handleProcessReturn = async () => {
    if (!originalInvoice) {
      dispatch(showToast('Find the original invoice first', 'warning'));
      return;
    }
    if (cart.length === 0) {
      dispatch(showToast('Add at least one item before processing the return', 'warning'));
      return;
    }
    if (!reason) {
      dispatch(showToast('Select a return reason first', 'warning'));
      return;
    }
    if (refundMode === 'refund' && !refundTo) {
      dispatch(showToast('Select where the refund is going', 'warning'));
      return;
    }

    try {
      const saved = await createSalesReturn({
        saleId: originalInvoice.saleId,
        items: cart.map((line) => ({ saleLineId: line.saleLineId, qty: line.qty })),
        reason,
        note: note || undefined,
        refundMode,
        refundTo: refundMode === 'refund' ? refundTo : undefined,
      }).unwrap();

      // Keep a print-ready snapshot (before the form resets below).
      const printable = {
        returnNo: saved.returnNo,
        originalInvoiceNo: originalInvoice.invoiceNo,
        invoiceDate: formatDate(originalInvoice.invoiceDate),
        customerName: originalInvoice.customerName || WALK_IN_CUSTOMER_NAME,
        reasonLabel: RETURN_REASONS.find((r) => r.value === reason)?.label || reason,
        lines: cart.map((line) => ({ name: line.name, qty: line.qty, rate: line.rate, taxRate: line.taxRate })),
        totals: { subTotal: totals.subTotal, tax: totals.tax, grandTotal: totals.grandTotal },
        refundMode,
        refundToLabel: REFUND_PAYMENT_METHODS.find((m) => m.value === refundTo)?.label || refundTo,
        dateTime: new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date()),
      };
      setLastReturn(printable);

      // Photo evidence goes up against the saved return; a failed upload
      // never undoes the return itself.
      if (evidence.length > 0) {
        let failed = 0;
        for (const photo of evidence) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await uploadEvidence({ returnId: saved.id, fileName: photo.name, dataUrl: photo.dataUrl }).unwrap();
          } catch {
            failed += 1;
          }
        }
        if (failed > 0) dispatch(showToast(`${failed} photo${failed === 1 ? '' : 's'} could not be uploaded`, 'warning'));
      }
      if (printSettingsEnabled) {
        printReturnReceipt({ ...printable, company: companyProfile, cashierName: user?.name || 'Admin' });
      }

      dispatch(showToast(`Return ${saved.returnNo} processed — refund initiated`, 'success'));

      // Refresh the same invoice's returnable/alreadyRefunded figures (this
      // return just changed both) and reset the working cart/reason/note
      // for the next return against the same or a different invoice.
      const refreshed = await lookupInvoice(originalInvoice.invoiceNo).unwrap();
      setOriginalInvoice(refreshed);
      setCart([]);
      setReason('');
      setNote('');
      setRefundTo('');
      setEvidence([]);
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Failed to process the return', 'error'));
    }
  };
  // Prints the return being built (marked PREVIEW — its number isn't final
  // until processed), otherwise the last processed return.
  const handlePrintReturn = () => {
    const base = { company: companyProfile, cashierName: user?.name || 'Admin' };
    if (originalInvoice && cart.length > 0) {
      printReturnReceipt({
        ...base,
        isPreview: true,
        returnNo: returnNo || '-',
        originalInvoiceNo: originalInvoice.invoiceNo,
        invoiceDate: formatDate(originalInvoice.invoiceDate),
        customerName: originalInvoice.customerName || WALK_IN_CUSTOMER_NAME,
        reasonLabel: RETURN_REASONS.find((r) => r.value === reason)?.label || '',
        lines: cart.map((line) => ({ name: line.name, qty: line.qty, rate: line.rate, taxRate: line.taxRate })),
        totals,
        refundMode,
        refundToLabel: REFUND_PAYMENT_METHODS.find((m) => m.value === refundTo)?.label || '',
        dateTime: new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date()),
      });
      return;
    }
    if (lastReturn) {
      printReturnReceipt({ ...base, ...lastReturn });
      return;
    }
    dispatch(showToast('Add items to the return (or process one) before printing', 'warning'));
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Sales Return</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Sales Return</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="warning" onClick={handleOpenFindInvoice}>Find Original Invoice (F3)</Button>
          <Button variant="outlined" color="error" onClick={handleClear}>Clear</Button>
          <Button
            variant="outlined"
            color="inherit"
            endIcon={<ExpandMoreIcon />}
            onClick={(e) => setMoreActionsAnchor(e.currentTarget)}
          >
            More Actions
          </Button>
          <Menu anchorEl={moreActionsAnchor} open={Boolean(moreActionsAnchor)} onClose={() => setMoreActionsAnchor(null)}>
            <MenuItem onClick={handleReturnAll}>Return All Items</MenuItem>
            <MenuItem onClick={handleOpenEvidence}>Attach Photo Evidence{evidence.length > 0 ? ` (${evidence.length})` : ''}</MenuItem>
            <MenuItem onClick={handleOpenCancel}>Cancel Return</MenuItem>
          </Menu>
        </Stack>
      </Stack>

      <ReturnInfoRow
        customerName={originalInvoice?.customerName || WALK_IN_CUSTOMER_NAME}
        returnNo={returnNo || 'Generating…'}
        returnDate={returnDate}
        originalInvoiceNo={originalInvoice?.invoiceNo || '-'}
        invoiceDate={originalInvoice ? formatDate(originalInvoice.invoiceDate) : '-'}
        cashierName={user?.name || 'Admin'}
        onAddCustomer={handleAddCustomer}
        onFindOriginalInvoice={handleOpenFindInvoice}
      />

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Box sx={{ height: { lg: 520 } }}>
            <ReturnItemsPanel items={displayItems} onAddItem={handleAddItem} />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Stack spacing={2}>
            <Box sx={{ height: { lg: 340 } }}>
              <ReturnCartPanel lines={cart} onQtyChange={handleQtyChange} onRemove={handleRemove} />
            </Box>
            <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <ReturnReasonCard reason={reason} onReasonChange={setReason} note={note} onNoteChange={setNote} reasons={RETURN_REASONS} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                <RefundAdjustmentCard
                  refundMode={refundMode}
                  onRefundModeChange={setRefundMode}
                  refundTo={refundTo}
                  onRefundToChange={setRefundTo}
                  paymentMethods={REFUND_PAYMENT_METHODS}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 12, lg: 4 }}>
                <ReturnTotalsCard totals={totals} />
              </Grid>
            </Grid>
          </Stack>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          {originalInvoice ? (
            <OriginalInvoiceSummaryCard
              invoice={{
                invoiceNo: originalInvoice.invoiceNo,
                invoiceDate: formatDate(originalInvoice.invoiceDate),
                totalAmount: originalInvoice.totalAmount,
                paidAmount: originalInvoice.paidAmount,
              }}
            />
          ) : (
            <EmptySummaryPlaceholder title="Original Invoice Summary" />
          )}
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          {originalInvoice ? (
            <RefundSummaryCard
              totalReturnAmount={totals.grandTotal}
              alreadyRefunded={originalInvoice.alreadyRefunded}
              invoicePaidAmount={originalInvoice.paidAmount}
            />
          ) : (
            <EmptySummaryPlaceholder title="Refund Summary" />
          )}
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          {originalInvoice ? (
            <PaymentMethodSummaryCard
              method={PAYMENT_METHOD_LABEL[originalInvoice.paymentMethod] || originalInvoice.paymentMethod}
              amount={originalInvoice.paidAmount}
            />
          ) : (
            <EmptySummaryPlaceholder title="Payment Method (Original Invoice)" />
          )}
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <ReturnActionsCard
            onProcessReturn={handleProcessReturn}
            onPrintReturn={handlePrintReturn}
            printSettingsEnabled={printSettingsEnabled}
            onTogglePrintSettings={setPrintSettingsEnabled}
            disabled={cart.length === 0 || !originalInvoice || isProcessing}
            printDisabled={!lastReturn && (cart.length === 0 || !originalInvoice)}
          />
        </Grid>
      </Grid>

      <FindInvoiceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleFindInvoiceSubmit}
        isLoading={isLookingUp}
        error={dialogError}
      />

      <EvidenceDialog open={evidenceOpen} onClose={() => setEvidenceOpen(false)} photos={evidence} onChange={setEvidence} />

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Cancel this return?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This discards the invoice, selected items, reason, refund details and attached photos on screen.
            Nothing has been saved yet, so stock and refunds are not affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelOpen(false)}>Keep editing</Button>
          <Button color="error" variant="contained" onClick={handleConfirmCancel}>Cancel return</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// Same outlined-Paper shell as the three real summary cards it stands in
// for, so the bottom grid row doesn't visibly shift once an invoice loads —
// shown only until "Find Original Invoice" actually returns a real Sale, so
// nothing here is ever mistaken for a real (zeroed) figure.
function EmptySummaryPlaceholder({ title }) {
  return (
    <Box sx={{
      border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2, height: '100%',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 0.5,
    }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>{title}</Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>Find an invoice to see this</Typography>
    </Box>
  );
}
