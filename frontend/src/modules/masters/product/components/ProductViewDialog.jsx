import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Stack, Typography, Button, Grid, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

import { formatCurrency, formatNumber } from '../../../../utils/format';

function Field({ label, value }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{value ?? '-'}</Typography>
    </Grid>
  );
}

/**
 * Read-only "View Product" dialog opened from the Product Code link in
 * ProductTable. Offers an Edit button that swaps to ProductFormDialog in
 * edit mode (wired from ProductPage).
 */
export default function ProductViewDialog({ open, row, onClose, onEdit }) {
  if (!row) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Inventory2OutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Product Details</Typography>
        </Stack>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Field label="Product Code" value={row.code} />
          <Field label="Short ID" value={row.shortId || '-'} />
          <Field label="Product Name" value={row.name} />
          <Field label="Product Group" value={row.group} />
          <Field label="Product Type" value={row.productType} />
          <Field label="Brand" value={row.brand} />
          <Field label="UOM" value={row.uom} />
          <Field label="HSN / SAC" value={row.hsnSac} />
          <Field label="Tax Code" value={row.taxCode} />
          <Field label="Sale Price" value={formatCurrency(row.salePrice, { decimals: true })} />
          <Field label="MRP" value={formatCurrency(row.mrp, { decimals: true })} />
          <Field label="Available Qty" value={formatNumber(row.availableQty)} />
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Status</Typography>
            <Chip
              label={row.status}
              size="small"
              sx={{
                bgcolor: row.status === 'Active' ? 'rgba(34,160,107,0.12)' : 'rgba(107,114,128,0.12)',
                color: row.status === 'Active' ? 'success.main' : 'text.secondary',
                fontWeight: 700, height: 22, mt: 0.5,
              }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={onEdit}>Edit</Button>
      </DialogActions>
    </Dialog>
  );
}
