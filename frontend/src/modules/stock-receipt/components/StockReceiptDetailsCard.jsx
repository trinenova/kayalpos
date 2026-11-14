import {
  Paper, Stack, Box, Typography, Divider,
} from '@mui/material';

import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';
import { formatCurrency, formatNumber } from '../../../utils/format';

const STATUS_LABEL = { draft: 'Draft', received: 'Received' };

function DetailField({ label, value, valueColor }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color: valueColor || 'text.primary' }}>{value}</Typography>
    </Box>
  );
}

/**
 * Right-hand "Receipt Details" panel for whichever row is selected in
 * StockReceiptTable — receipt no/date/status header, supplier & source
 * details on the left and invoice/transport details on the right, plus a
 * real line-items table below (added on top of the old mock design, which
 * only showed an item count — the real StockReceipt row already carries the
 * full line detail, so showing it here is free and matches
 * TransferDetailsCard/IndentDetailsCard's own items table).
 */
export default function StockReceiptDetailsCard({ receipt }) {
  const itemColumns = [
    { key: 'index', label: '#', render: (_row, i) => i + 1 },
    { key: 'code', label: 'Item Code' },
    { key: 'name', label: 'Item Name' },
    { key: 'uom', label: 'UoM' },
    { key: 'orderedQty', label: 'Ordered Qty', align: 'right', render: (row) => row.orderedQty.toFixed(2) },
    { key: 'receivedQty', label: 'Received Qty', align: 'right', render: (row) => row.receivedQty.toFixed(2) },
    { key: 'mrp', label: 'MRP (₹)', align: 'right', render: (row) => (row.mrp == null ? '-' : formatCurrency(row.mrp, { decimals: true })) },
    { key: 'unitCost', label: 'Unit Cost (₹)', align: 'right', render: (row) => formatCurrency(row.unitCost, { decimals: true }) },
    { key: 'totalCost', label: 'Total Cost (₹)', align: 'right', render: (row) => formatCurrency(row.totalCost, { decimals: true }) },
  ];

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: { xs: 2.5, sm: 3 }, pb: 2 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Receipt Details</Typography>
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'rgba(37,99,235,0.12)', color: '#2563EB', fontWeight: 700, fontSize: 15,
              }}
            >
              RC
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>{receipt.code}</Typography>
                <StatusBadge status={receipt.status} label={STATUS_LABEL[receipt.status] || receipt.status} />
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{receipt.date}</Typography>
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              <DetailField label="Supplier" value={receipt.supplier} />
              <DetailField label="Purchase Type" value={receipt.purchaseType} />
              <DetailField label="From Outlet / HO" value={receipt.fromOutlet} />
              <DetailField label="Contact Person" value={receipt.contactPerson} />
              <DetailField label="Mobile No." value={receipt.mobileNo} />
            </Stack>
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              <DetailField label="Invoice No." value={receipt.invoiceNo} />
              <DetailField label="Invoice Date" value={receipt.invoiceDate} />
              <DetailField label="GRN / DC No." value={receipt.grnDcNo} />
              <DetailField label="Vehicle No." value={receipt.vehicleNo} />
              <DetailField label="Transporter" value={receipt.transporter} />
            </Stack>
          </Stack>

          <Stack direction="row" spacing={3}>
            <DetailField label="Items" value={formatNumber(receipt.items)} />
            <DetailField label="Total Value" value={formatCurrency(receipt.totalValue, { decimals: true })} valueColor="success.main" />
          </Stack>
        </Stack>
      </Box>

      {receipt.lineItems?.length > 0 && (
        <>
          <Divider />
          <Box sx={{ p: { xs: 2, sm: 2.5 }, flex: 1, minWidth: 0, overflow: 'auto' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Items</Typography>
            <Box sx={{ overflow: 'auto' }}>
              <DataTable columns={itemColumns} rows={receipt.lineItems} getRowKey={(r) => r.code} dense />
            </Box>
          </Box>
        </>
      )}
    </Paper>
  );
}
