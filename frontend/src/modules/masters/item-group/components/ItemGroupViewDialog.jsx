import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Stack, Typography, Button, Grid, Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';

function Field({ label, value }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{value ?? '-'}</Typography>
    </Grid>
  );
}

/** Read-only "Item Group Details" dialog opened from the code link in the table. */
export default function ItemGroupViewDialog({ open, row, totalItems = 0, onClose, onEdit }) {
  if (!row) return null;
  const active = row.status === 'Active';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CategoryOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Item Group Details</Typography>
        </Stack>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Field label="Item Group Code" value={row.code} />
          <Field label="Item Group Name" value={row.name} />
          <Field label="Total Items" value={totalItems} />
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Status</Typography>
            <Chip
              label={row.status}
              size="small"
              sx={{
                bgcolor: (t) => alpha(active ? t.palette.success.main : t.palette.text.secondary, 0.12),
                color: active ? 'success.main' : 'text.secondary',
                fontWeight: 700, height: 22, mt: 0.5,
              }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Description</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.description || '-'}</Typography>
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
