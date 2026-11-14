import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, Chip, IconButton, Stack, Typography, Link as MuiLink,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';

const COLUMNS = [
  { key: 'code', label: 'Item Group Code', align: 'left' },
  { key: 'name', label: 'Item Group Name', align: 'left' },
  { key: 'description', label: 'Description', align: 'left' },
  { key: 'totalItems', label: 'Total Items', align: 'center' },
  { key: 'status', label: 'Status', align: 'center' },
  { key: 'createdOn', label: 'Created On', align: 'center' },
  { key: 'action', label: 'Action', align: 'center' },
];

function formatCreatedOn(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ItemGroupRow({ row, totalItems, onOpen, onEditRow, onDeleteRow }) {
  const active = row.status === 'Active';
  return (
    <TableRow hover>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 26, height: 26, borderRadius: 1, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.12), color: 'primary.main',
            }}
          >
            <CategoryOutlinedIcon sx={{ fontSize: 15 }} />
          </Box>
          <MuiLink component="button" type="button" underline="hover" onClick={() => onOpen?.(row)} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
            {row.code}
          </MuiLink>
        </Stack>
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.name}</TableCell>
      <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</TableCell>
      <TableCell align="center">{totalItems}</TableCell>
      <TableCell align="center">
        <Chip
          label={row.status}
          size="small"
          sx={{
            bgcolor: (t) => alpha(active ? t.palette.success.main : t.palette.text.secondary, 0.12),
            color: active ? 'success.main' : 'text.secondary',
            fontWeight: 700, height: 22,
          }}
        />
      </TableCell>
      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{formatCreatedOn(row.createdAt)}</TableCell>
      <TableCell align="center" className="sticky-action">
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center' }}>
          <IconButton size="small" color="primary" onClick={() => onEditRow?.(row)} aria-label={`Edit ${row.name}`}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => onDeleteRow?.(row)} aria-label={`Delete ${row.name}`}>
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

/** "Item Group List" table. `itemCounts` maps a lower-cased group name to its product count. */
export default function ItemGroupTable({ rows, itemCounts = {}, onOpen, onEditRow, onDeleteRow }) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableCell
                key={col.key}
                align={col.align}
                className={col.key === 'action' ? 'sticky-action' : undefined}
                sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <ItemGroupRow key={row.id} row={row} totalItems={itemCounts[row.name.trim().toLowerCase()] || 0} onOpen={onOpen} onEditRow={onEditRow} onDeleteRow={onDeleteRow} />
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length}>
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                  No item groups found — create one to get started.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
