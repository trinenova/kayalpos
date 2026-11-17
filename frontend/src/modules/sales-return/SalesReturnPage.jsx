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
import { useGetProductsQuery } from '../../api/productApi';
import { useCompanyProfileQuery } from '../../api/companyApi';
import { printReturnReceipt } from '../line-sale/receiptPrint';
import { useTabDirty } from '../../hooks/useTabDirty';

import ReturnItemsPanel from './components/ReturnItemsPanel';
import ReturnCartPanel from './components/ReturnCartPanel';
import ExchangeCartPanel from './components/ExchangeCartPanel';
import ReturnInfoRow from './components/ReturnInfoRow';
import ReturnReasonCard from './components/ReturnReasonCard';
import ReturnTotalsCard from './components/ReturnTotalsCard';
import OriginalInvoiceSummaryCard from './components/OriginalInvoiceSummaryCard';
import RefundSummaryCard from './components/RefundSummaryCard';
import ExchangeSummaryCard from './components/ExchangeSummaryCard';
import PaymentMethodSummaryCard from './components/PaymentMethodSummaryCard';
import ReturnActionsCard from './components/ReturnActionsCard';
import FindInvoiceDialog from './components/FindInvoiceDialog';
import EvidenceDialog from './components/EvidenceDialog';
import {
  RETURN_REASONS, REFUND_PAYMENT_METHODS, SETTLEMENT_COLLECT_METHODS, SETTLEMENT_REFUND_METHODS,
} from './salesReturnConstants';

const WALK_IN_CUSTOMER_NAME = 'Walk-in Customer';

const PAYMENT_METHOD_LABEL = {
  cash: 'Cash', upi: 'UPI', card: 'Card', wallet: 'Wallet', credit: 'Credit',
};

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Sales Return (POS refund/exchange) screen — find the original invoice,
 * pick which lines are coming back, capture why, and either refund the
 * customer (Return mode) or hand over new goods for the difference
 * (Exchange mode). Fully wired to the real backend (see
 * backend/src/modules/sales-return): "Find Original Invoice" looks up an
 * actual Sale by its billNo, each returnable line's remaining qty is
 * computed from real prior returns, exchanged-out goods are priced/taxed/
 * stocked by the exact same FIFO + tax-resolver machinery a normal Line
 * Sale uses, and "Process Return" writes a real SalesReturn row (plus
 * SalesReturnItem / SalesReturnExchangeItem lines) — validated again
 * server-side, so nothing this page allows can slip past the backend's own
 * checks (over-returning a line, an unsettled exchange balance, ...).
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

  // Return mode: how the refund leaves the till.
  const [refundMode, setRefundMode] = useState('refund');
  const [refundTo, setRefundTo] = useState('');

  // Exchange mode: what the customer is taking instead, and how the price
  // difference against the returned items is settled.
  const [returnType, setReturnType] = useState('return');
  const [exchangeQuery, setExchangeQuery] = useState('');
  const [exchangeCart, setExchangeCart] = useState([]);
  const [settlementMode, setSettlementMode] = useState('');

  const [printSettingsEnabled, setPrintSettingsEnabled] = useState(false);
  const [moreActionsAnchor, setMoreActionsAnchor] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Snapshot of the last processed return, so "Print Return" still works
  // after Process Return has reset the working form.
  const [lastReturn, setLastReturn] = useState(null);

  // Reported to the tab strip (see TabBar.jsx) so closing this tab while a
  // return is still in progress — items picked, a note typed, evidence
  // attached, but not yet processed — asks for confirmation instead of
  // silently discarding it. Everything here resets to empty on a
  // successful Process Return, so the flag clears itself the moment
  // there's genuinely nothing left to lose.
  useTabDirty(cart.length > 0 || exchangeCart.length > 0 || Boolean(reason) || Boolean(note) || evidence.length > 0);

  const { data: returnNo } = useNextSalesReturnNoQuery();
  const [lookupInvoice, { isFetching: isLookingUp }] = useLazyLookupOriginalInvoiceQuery();
  const [createSalesReturn, { isLoading: isProcessing }] = useCreateSalesReturnMutation();
  const [uploadEvidence] = useUploadSalesReturnEvidenceMutation();
  const { data: companyProfile } = useCompanyProfileQuery();

  const returnDate = useMemo(
    () => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()),
    [],
  );

  // Live catalog search for the item the customer is taking in exchange —
  // only fetched in Exchange mode (Return mode has nothing to buy, so
  // there is nothing honest to show here). An empty query still returns
  // the catalog's first page, so switching to Exchange shows something to
  // browse immediately rather than a blank "type to search" box.
  const isExchange = returnType === 'exchange';
  const { data: productResults = [], isFetching: isSearchingProducts } = useGetProductsQuery(
    { search: exchangeQuery.trim(), status: 'ACTIVE', pageSize: 20 },
    { skip: !isExchange },
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
    // Same proration the server applies: the original bill's discount share.
    const ratio = Number(originalInvoice?.discountRatio) || 0;
    const subTotal = cart.reduce((sum, line) => sum + line.qty * line.rate, 0);
    const discountAmount = subTotal * ratio;
    const taxable = Math.max(subTotal - discountAmount, 0);
    const tax = cart.reduce((sum, line) => {
      const gross = line.qty * line.rate * (1 - ratio);
      return sum + (gross - gross / (1 + line.taxRate));
    }, 0);
    const grandTotal = taxable;
    return { subTotal, discountAmount, tax, grandTotal };
  }, [cart, originalInvoice]);

  // Exchange goods are priced exactly as a normal sale (GST-inclusive, no
  // separate discount leg), matching how the backend's resolveExchangeLines
  // computes exchangeSubTotal/exchangeGrandTotal.
  const exchangeTotals = useMemo(() => {
    const grandTotal = exchangeCart.reduce((sum, line) => sum + line.qty * line.rate, 0);
    return { grandTotal };
  }, [exchangeCart]);

  // Positive = customer owes more; negative = store owes the customer;
  // zero = even swap, no settlement needed. Mirrors the backend's own
  // `balanceAmount = exchangeGrandTotal - grandTotal` exactly.
  const balanceAmount = useMemo(
    () => round2(exchangeTotals.grandTotal - totals.grandTotal),
    [exchangeTotals.grandTotal, totals.grandTotal],
  );
  const settlementMethods = balanceAmount > 0 ? SETTLEMENT_COLLECT_METHODS : SETTLEMENT_REFUND_METHODS;

  const handleOpenFindInvoice = () => {
    setDialogError('');
    setDialogOpen(true);
  };

  const handleFindInvoiceSubmit = async (billNo) => {
    try {
      const data = await lookupInvoice(billNo).unwrap();
      setOriginalInvoice(data);
      setCart([]);
      setExchangeCart([]);
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

  // Exchange cart: picked from the live catalog (Scan/Search tab). No
  // client-side stock cap — same convention LineSalePage.jsx's own
  // addItemToCart uses ("No stock validation — items can be sold even when
  // stock is 0"), since availableQty is only a denormalized snapshot and
  // isn't the real source of truth. The actual limit is enforced server
  // side: resolveExchangeLines runs the exact same FIFO lot allocator a
  // normal sale uses, and Process Return is rejected with a clear error if
  // there truly isn't enough stock to allocate.
  const handleAddExchangeItem = (product) => {
    setExchangeCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) => (
          line.productId === product.id ? { ...line, qty: line.qty + 1 } : line
        ));
      }
      return [...prev, {
        productId: product.id,
        code: product.code,
        name: product.name,
        uom: product.uom || '',
        rate: Number(product.salePrice) || 0,
        qty: 1,
        maxQty: Infinity,
      }];
    });
  };
  const handleExchangeQtyChange = (productId, qty) => {
    setExchangeCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, qty } : line)));
  };
  const handleRemoveExchangeItem = (productId) => {
    setExchangeCart((prev) => prev.filter((line) => line.productId !== productId));
  };

  const handleClear = () => {
    setCart([]);
    setExchangeCart([]);
    setReturnType('return');
    setExchangeQuery('');
    setSettlementMode('');
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
    if (!originalInvoice && cart.length === 0 && exchangeCart.length === 0 && evidence.length === 0 && !reason && !note) {
      dispatch(showToast('There is no return in progress', 'info'));
      return;
    }
    setCancelOpen(true);
  };
  const handleConfirmCancel = () => {
    setCancelOpen(false);
    setOriginalInvoice(null);
    setCart([]);
    setExchangeCart([]);
    setReturnType('return');
    setExchangeQuery('');
    setSettlementMode('');
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
    if (returnType === 'return') {
      if (refundMode === 'refund' && !refundTo) {
        dispatch(showToast('Select where the refund is going', 'warning'));
        return;
      }
    } else {
      if (exchangeCart.length === 0) {
        dispatch(showToast('Add at least one item the customer is taking in exchange', 'warning'));
        return;
      }
      if (Math.abs(balanceAmount) >= 0.005 && !settlementMode) {
        dispatch(showToast(
          balanceAmount > 0 ? 'Select how the customer is paying the balance' : 'Select how the balance is being refunded',
          'warning',
        ));
        return;
      }
    }

    const settlementModeLabel = settlementMode
      ? settlementMethods.find((m) => m.value === settlementMode)?.label || settlementMode
      : '';

    try {
      const payload = {
        saleId: originalInvoice.saleId,
        items: cart.map((line) => ({ saleLineId: line.saleLineId, qty: line.qty })),
        reason,
        note: note || undefined,
        returnType,
      };
      if (returnType === 'return') {
        payload.refundMode = refundMode;
        payload.refundTo = refundMode === 'refund' ? refundTo : undefined;
      } else {
        payload.exchangeItems = exchangeCart.map((line) => ({ productId: line.productId, qty: line.qty }));
        if (Math.abs(balanceAmount) >= 0.005) payload.settlementMode = settlementMode;
      }

      const saved = await createSalesReturn(payload).unwrap();

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
        returnType,
        exchangeLines: exchangeCart.map((line) => ({ name: line.name, qty: line.qty, rate: line.rate })),
        exchangeTotals: { grandTotal: exchangeTotals.grandTotal },
        balanceAmount,
        settlementModeLabel,
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

      dispatch(showToast(
        returnType === 'exchange' ? `Exchange ${saved.returnNo} processed` : `Return ${saved.returnNo} processed — refund initiated`,
        'success',
      ));

      // Refresh the same invoice's returnable/alreadyRefunded figures (this
      // return just changed both) and reset the working cart/reason/note
      // for the next return against the same or a different invoice.
      const refreshed = await lookupInvoice(originalInvoice.invoiceNo).unwrap();
      setOriginalInvoice(refreshed);
      setCart([]);
      setExchangeCart([]);
      setReturnType('return');
      setExchangeQuery('');
      setSettlementMode('');
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
      const settlementModeLabel = settlementMode
        ? settlementMethods.find((m) => m.value === settlementMode)?.label || settlementMode
        : '';
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
        returnType,
        exchangeLines: exchangeCart.map((line) => ({ name: line.name, qty: line.qty, rate: line.rate })),
        exchangeTotals: { grandTotal: exchangeTotals.grandTotal },
        balanceAmount,
        settlementModeLabel,
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
            <ReturnItemsPanel
              returnType={returnType}
              onReturnTypeChange={setReturnType}
              items={displayItems}
              onAddItem={handleAddItem}
              productQuery={exchangeQuery}
              onProductQueryChange={setExchangeQuery}
              productResults={productResults}
              isSearchingProducts={isSearchingProducts}
              onAddExchangeItem={handleAddExchangeItem}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Stack spacing={2}>
            <Box sx={{ height: { lg: isExchange ? 260 : 340 } }}>
              <ReturnCartPanel lines={cart} onQtyChange={handleQtyChange} onRemove={handleRemove} />
            </Box>
            {isExchange && (
              <Box sx={{ height: { lg: 260 } }}>
                <ExchangeCartPanel lines={exchangeCart} onQtyChange={handleExchangeQtyChange} onRemove={handleRemoveExchangeItem} />
              </Box>
            )}
            <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ReturnReasonCard reason={reason} onReasonChange={setReason} note={note} onNoteChange={setNote} reasons={RETURN_REASONS} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ReturnTotalsCard
                  returnType={returnType}
                  totals={totals}
                  refundMode={refundMode}
                  onRefundModeChange={setRefundMode}
                  refundTo={refundTo}
                  onRefundToChange={setRefundTo}
                  refundPaymentMethods={REFUND_PAYMENT_METHODS}
                  exchangeTotals={exchangeTotals}
                  balanceAmount={balanceAmount}
                  settlementMode={settlementMode}
                  onSettlementModeChange={setSettlementMode}
                  settlementMethods={settlementMethods}
                />
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
          {originalInvoice && isExchange && (
            <ExchangeSummaryCard
              returnedValue={totals.grandTotal}
              exchangeValue={exchangeTotals.grandTotal}
              balanceAmount={balanceAmount}
              settlementModeLabel={settlementMode ? settlementMethods.find((m) => m.value === settlementMode)?.label : ''}
            />
          )}
          {originalInvoice && !isExchange && (
            <RefundSummaryCard
              totalReturnAmount={totals.grandTotal}
              alreadyRefunded={originalInvoice.alreadyRefunded}
              invoicePaidAmount={originalInvoice.paidAmount}
            />
          )}
          {!originalInvoice && <EmptySummaryPlaceholder title={isExchange ? 'Exchange Summary' : 'Refund Summary'} />}
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
            disabled={cart.length === 0 || !originalInvoice || isProcessing || (isExchange && exchangeCart.length === 0)}
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
            This discards the invoice, selected items, reason, refund/exchange details and attached photos on screen.
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
