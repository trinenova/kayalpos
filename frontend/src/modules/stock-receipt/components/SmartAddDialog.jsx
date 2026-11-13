import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Stack, Typography, Button, TextField,
  InputAdornment, Checkbox, List, ListItemButton, ListItemIcon, ListItemText, Chip, Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';

const SHOW_LIMIT = 300;

/**
 * "Smart Add" picker for the Stock Receipt items grid: lists every product by
 * name, lets the user tick as many as needed (search narrows the list) and adds
 * them all to the grid in one go. Products already on the grid are shown as
 * "In grid" and cannot be ticked again.
 */
export default function SmartAddDialog({ open, onClose, products = [], existingCodes, onAdd }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (open) { setQuery(''); setSelected(new Set()); }
  }, [open]);

  const sorted = useMemo(
    () => [...products].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [products],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => [p.name, p.code, p.shortId, p.hsnSac]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [sorted, query]);

  const visible = matches.slice(0, SHOW_LIMIT);
  const pickable = visible.filter((p) => !existingCodes.has(p.code));
  const allTicked = pickable.length > 0 && pickable.every((p) => selected.has(p.code));

  const toggle = (code) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allTicked) pickable.forEach((p) => next.delete(p.code));
    else pickable.forEach((p) => next.add(p.code));
    return next;
  });

  const handleAdd = () => {
    const chosen = sorted.filter((p) => selected.has(p.code));
    if (!chosen.length) return;
    onAdd(chosen);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        Smart Add
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Select the items to add to the receipt</Typography>
        <IconButton onClick={onClose} aria-label="Close" sx={{ position: 'absolute', right: 12, top: 12 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Search by item name, code, Short ID or HSN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <Stack direction="row" sx={{ mt: 1, alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Checkbox size="small" checked={allTicked} indeterminate={!allTicked && pickable.some((p) => selected.has(p.code))} onChange={toggleAll} disabled={!pickable.length} slotProps={{ input: { 'aria-label': 'Select all listed items' } }} />
              <Typography variant="body2">Select all{query ? ' listed' : ''}</Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{selected.size} selected</Typography>
          </Stack>
        </Box>
        <List dense disablePadding sx={{ minHeight: 280, maxHeight: 420, overflowY: 'auto' }}>
          {visible.map((p) => {
            const inGrid = existingCodes.has(p.code);
            return (
              <ListItemButton key={p.code} disabled={inGrid} onClick={() => toggle(p.code)} sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox edge="start" size="small" checked={selected.has(p.code)} tabIndex={-1} disableRipple />
                </ListItemIcon>
                <ListItemText
                  primary={p.name}
                  secondary={[p.code, p.hsnSac && `HSN ${p.hsnSac}`, p.uom].filter(Boolean).join(' · ')}
                  slotProps={{ primary: { noWrap: true, sx: { fontWeight: 600 } } }}
                />
                {inGrid && <Chip size="small" label="In grid" />}
              </ListItemButton>
            );
          })}
          {!visible.length && (
            <Typography variant="body2" sx={{ color: 'text.secondary', p: 3, textAlign: 'center' }}>
              {products.length ? 'No items match your search' : 'No products found in Masters > Product'}
            </Typography>
          )}
          {matches.length > SHOW_LIMIT && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', p: 1.5, textAlign: 'center' }}>
              Showing the first {SHOW_LIMIT} of {matches.length} items — type in the search box to narrow the list.
            </Typography>
          )}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="warning" onClick={handleAdd} disabled={!selected.size}>
          Add {selected.size ? `${selected.size} item${selected.size === 1 ? '' : 's'}` : 'items'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
