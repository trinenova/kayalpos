import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, IconButton, Typography, Box, Stack, Chip, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Skeleton, Alert, Tooltip, CircularProgress, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';

import { useRecentSalesQuery, useLazyBillDetailQuery } from '../../../api/saleApi';
import { useCompanyProfileQuery } from '../../../api/companyApi';
import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/ui/uiSlice';
import { formatCurrency } from '../../../utils/format';
import { printReceipt } from '../receiptPrint';

const METHOD_LABEL = { cash: 'Cash', card: 'Card', upi: 'UPI' };
const methodLabel = (m) => METHOD_LABEL[String(m || '').toLowerCase()]
  || String(m || '-').replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());

const formatWhen = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const num = (v) => Number(v) || 0;

/** Builds the exact input printReceipt() expects from a saved bill. */
const billToReceipt = (bill, company) => {
  const cart = (bill.lines || []).map((l) => ({
    name: l.name, qty: num(l.qty), price: num(l.price), taxRate: num(l.taxRate),
  }));
  const subTotal = num(bill.subTotal);
  const discountAmount = num(bill.discountAmount);
  const taxable = Math.max(subTotal - discountAmount, 0);
  return {
    company,
    billNo: bill.billNo,
    cashierName: bill.cashierName || '-',
    dateTime: formatWhen(bill.createdAt),
    cart,
    totals: { subTotal, discountAmount, taxable, tax: num(bill.taxAmount), grandTotal: num(bill.grandTotal) },
    paymentMethod: bill.paymentMethod,
    receivedAmount: num(bill.receivedAmount),
    changeAmount: num(bill.changeAmount),
  };
};

/** "Recent Sales" popup for Line Sale — the outlet's last 10 bills, with View and Print. */
export default function RecentSalesDialog({ open, onClose }) {
  const dispatch = useAppDispatch();
  const { data = [], isFetching, isError, refetch } = useRecentSalesQuery(undefined, { skip: !open, refetchOnMountOrArgChange: true });
  const { data: company } = useCompanyProfileQuery(undefined, { skip: !open });
  const [loadBill] = useLazyBillDetailQuery();
  const [busy, setBusy] = useState('');
  const [viewing, setViewing] = useState(null);

  const fetchBill = async (billNo, action) => {
    setBusy(`${action}:${billNo}`);
    try {
      return await loadBill(billNo).unwrap();
    } catch (err) {
      dispatch(showToast(err?.data?.message || 'Could not load that bill', 'error'));
      return null;
    } finally {
      setBusy('');
    }
  };
  const handleView = async (billNo) => {
    const bill = await fetchBill(billNo, 'view');
    if (bill) setViewing(bill);
  };
  const handlePrint = async (billNo) => {
    const bill = await fetchBill(billNo, 'print');
    if (!bill) return;
    try {
      printReceipt(billToReceipt(bill, company));
    } catch {
      dispatch(showToast('The invoice could not be printed', 'warning'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800 }}>
        Recent Sales
        <Chip size="small" label="Last 10" sx={{ fontWeight: 700 }} />
        <IconButton onClick={onClose} size="small" sx={{ ml: 'auto' }} aria-label="Close"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isError && (
          <Alert severity="error" action={<Box component="button" onClick={refetch} style={{ cursor: 'pointer' }}>Retry</Box>}>
            Could not load recent sales.
          </Alert>
        )}
        {isFetching && data.length === 0 && (
          <Stack spacing={1}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={36} />)}</Stack>
        )}
        {!isFetching && !isError && data.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No sales yet.</Typography>
        )}
        {data.length > 0 && (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Bill No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date &amp; Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Items</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.billNo} hover>
                    <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>{row.billNo}</TableCell>
                    <TableCell>{formatWhen(row.createdAt)}</TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>{methodLabel(row.paymentMethod)}</TableCell>
                    <TableCell align="right">{row.items}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(row.amount, { decimals: true })}</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="View bill">
                        <span>
                          <IconButton size="small" color="primary" disabled={Boolean(busy)} onClick={() => handleView(row.billNo)} aria-label={`View ${row.billNo}`}>
                            {busy === `view:${row.billNo}` ? <CircularProgress size={18} /> : <VisibilityOutlinedIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Print bill">
                        <span>
                          <IconButton size="small" color="primary" disabled={Boolean(busy)} onClick={() => handlePrint(row.billNo)} aria-label={`Print ${row.billNo}`}>
                            {busy === `print:${row.billNo}` ? <CircularProgress size={18} /> : <PrintOutlinedIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} maxWidth="sm" fullWidth>
        {viewing && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800 }}>
              Bill {viewing.billNo}
              <Chip size="small" label={methodLabel(viewing.paymentMethod)} sx={{ fontWeight: 700 }} />
              <IconButton onClick={() => setViewing(null)} size="small" sx={{ ml: 'auto' }} aria-label="Close"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {formatWhen(viewing.createdAt)} · {viewing.customerName || 'Walk-in Customer'} · Cashier: {viewing.cashierName || '-'}
              </Typography>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Qty</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Rate</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(viewing.lines || []).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.name}</TableCell>
                        <TableCell align="right">{num(l.qty)}</TableCell>
                        <TableCell align="right">{formatCurrency(num(l.price), { decimals: true })}</TableCell>
                        <TableCell align="right">{formatCurrency(num(l.qty) * num(l.price), { decimals: true })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Divider sx={{ my: 1.5 }} />
              <Stack spacing={0.5} sx={{ ml: 'auto', maxWidth: 260 }}>
                {[
                  ['Sub total', num(viewing.subTotal)],
                  ['Discount', num(viewing.discountAmount)],
                  ['GST', num(viewing.taxAmount)],
                ].map(([label, value]) => (
                  <Stack key={label} direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2">{formatCurrency(value, { decimals: true })}</Typography>
                  </Stack>
                ))}
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: 800 }}>Total</Typography>
                  <Typography sx={{ fontWeight: 800 }}>{formatCurrency(num(viewing.grandTotal), { decimals: true })}</Typography>
                </Stack>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Dialog>
  );
}
