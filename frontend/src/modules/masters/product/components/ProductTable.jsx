import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, Chip, IconButton, Stack, Typography, Link as MuiLink,
} from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';

import { formatCurrency, formatNumber } from '../../../../utils/format';
import { PRODUCT_GROUP_COLORS } from '../productMockData';

const COLUMNS = [
  { key: 'code', label: 'Product Code' },
  { key: 'shortId', label: 'Short ID' },
  { key: 'name', label: 'Product Name' },
  { key: 'group', label: 'Product Group' },
  { key: 'productType', label: 'Product Type' },
  { key: 'brand', label: 'Brand' },
  { key: 'uom', label: 'UOM' },
  { key: 'hsnSac', label: 'HSN / SAC' },
  { key: 'taxCode', label: 'Tax Code' },
  { key: 'salePrice', label: 'Sale Price (₹)' },
  { key: 'mrp', label: 'MRP (₹)' },
  { key: 'availableQty', label: 'Available Qty' },
  { key: 'status', label: 'Status' },
  { key: 'action', label: 'Action' },
];

// Above this many rows, plain DOM rendering starts costing real paint/scroll
// time — switch to windowed rendering (only the rows on screen + a small
// overscan actually mount) rather than rendering everything at once. Below
// it, the plain table is simpler and just as fast, so leave it alone.
const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT = 53;
const VIRTUAL_VIEWPORT_HEIGHT = 480;

function ProductRow({ row, onOpenProduct, onEditRow, onDeleteRow, style }) {
  const color = PRODUCT_GROUP_COLORS[row.group] || '#6B7280';
  return (
    <TableRow hover style={style}>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 26, height: 26, borderRadius: 1, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: `${color}1F`, color,
            }}
          >
            <Inventory2OutlinedIcon sx={{ fontSize: 15 }} />
          </Box>
          <MuiLink
            component="button"
            type="button"
            underline="hover"
            onClick={() => onOpenProduct?.(row)}
            sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {row.code}
          </MuiLink>
        </Stack>
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.shortId || '—'}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.name}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.group}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productType || '—'}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.brand}</TableCell>
      <TableCell>{row.uom}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.hsnSac}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.taxCode}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(row.salePrice, { decimals: true })}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(row.mrp, { decimals: true })}</TableCell>
      <TableCell>{formatNumber(row.availableQty)}</TableCell>
      <TableCell>
        <Chip
          label={row.status}
          size="small"
          sx={{
            bgcolor: row.status === 'Active' ? 'rgba(34,160,107,0.12)' : 'rgba(107,114,128,0.12)',
            color: row.status === 'Active' ? 'success.main' : 'text.secondary',
            fontWeight: 700, height: 22,
          }}
        />
      </TableCell>
      <TableCell className="sticky-action">
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" color="primary" onClick={() => onEditRow?.(row)} aria-label={`Edit ${row.code}`}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => onDeleteRow?.(row)} aria-label={`Delete ${row.code}`}>
            <DeleteOutlineOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

function Header() {
  return (
    <TableHead>
      <TableRow>
        {COLUMNS.map((col) => (
          <TableCell key={col.key} className={col.key === 'action' ? 'sticky-action' : undefined} sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' }}>
            {col.label}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

function EmptyRow() {
  return (
    <TableRow>
      <TableCell colSpan={COLUMNS.length}>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
          No products match your search.
        </Typography>
      </TableCell>
    </TableRow>
  );
}

/** Plain (non-virtualized) render path — used below VIRTUALIZE_THRESHOLD rows. */
function PlainProductTable({ rows, onOpenProduct, onEditRow, onDeleteRow }) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 1560 }}>
        <Header />
        <TableBody>
          {rows.map((row) => (
            <ProductRow key={row.code} row={row} onOpenProduct={onOpenProduct} onEditRow={onEditRow} onDeleteRow={onDeleteRow} />
          ))}
          {rows.length === 0 && <EmptyRow />}
        </TableBody>
      </Table>
    </Box>
  );
}

/**
 * Virtualized render path for large catalogs — only the rows currently
 * scrolled into view (plus a small overscan) are ever mounted, so scroll
 * performance stays flat whether there are 500 or 50,000 rows. Uses the
 * standard "two spacer rows" technique to keep a real <table>/<tbody>
 * structure (so column alignment/accessibility semantics are unchanged)
 * while only rendering a window of <tr>s in between.
 */
function VirtualizedProductTable({ rows, onOpenProduct, onEditRow, onDeleteRow }) {
  const scrollRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0;

  return (
    <Box ref={scrollRef} sx={{ overflow: 'auto', maxHeight: VIRTUAL_VIEWPORT_HEIGHT }}>
      <Table size="small" stickyHeader sx={{ minWidth: 1560 }}>
        <Header />
        <TableBody>
          {paddingTop > 0 && (
            <TableRow style={{ height: paddingTop }}>
              <TableCell colSpan={COLUMNS.length} sx={{ p: 0, border: 0 }} />
            </TableRow>
          )}
          {virtualItems.map((virtualRow) => (
            <ProductRow
              key={rows[virtualRow.index].code}
              row={rows[virtualRow.index]}
              onOpenProduct={onOpenProduct}
              onEditRow={onEditRow}
              onDeleteRow={onDeleteRow}
            />
          ))}
          {paddingBottom > 0 && (
            <TableRow style={{ height: paddingBottom }}>
              <TableCell colSpan={COLUMNS.length} sx={{ p: 0, border: 0 }} />
            </TableRow>
          )}
          {rows.length === 0 && <EmptyRow />}
        </TableBody>
      </Table>
    </Box>
  );
}

/**
 * "Product List" table — a small colored square stands in for each
 * product's photo (no real product images to show for mock data), the
 * Product Code is a link (matching the reference's blue-code convention
 * used elsewhere in this app), and Status is a green/grey chip.
 * Automatically switches to windowed/virtualized rendering above
 * VIRTUALIZE_THRESHOLD rows — see VirtualizedProductTable.
 */
export default function ProductTable({ rows, onOpenProduct, onEditRow, onDeleteRow }) {
  const Impl = rows.length > VIRTUALIZE_THRESHOLD ? VirtualizedProductTable : PlainProductTable;
  return <Impl rows={rows} onOpenProduct={onOpenProduct} onEditRow={onEditRow} onDeleteRow={onDeleteRow} />;
}
