import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Box } from '@mui/material';

/**
 * Generic table used for every list screen and every dashboard table
 * (Recent Transactions, Low Stock Items, Top Selling Items, Outlet
 * Performance, and later full module list pages). Configure via `columns`:
 * [{ key, label, align, width, wrap, render(row, index) }]. Horizontal
 * scroll on narrow screens instead of a bespoke mobile layout, per the
 * responsive rules.
 *
 * Pass `fitContainer` to opt a specific table OUT of that horizontal-scroll
 * behavior instead — it switches to a fixed table-layout that always fits
 * its container's width (each column sized by `col.width`, e.g. '25%';
 * overflowing text ellipsizes instead of growing the table). Used by the
 * Line Sale and Sales Return screens' Items/Cart panels, which must stay
 * fully visible with no side-scrolling however narrow the panel gets.
 * Defaults to false so every other existing table (Customer, Promotion,
 * dashboard widgets, ...) keeps its current scroll-on-narrow-screens
 * behavior unchanged.
 */
export default function DataTable({
  columns, rows, getRowKey, emptyMessage = 'No records found', dense = false, onRowClick, fitContainer = false,
}) {
  if (!rows || rows.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  // Default ("medium") MUI table cell padding is ~16px each side. Once a
  // column is squeezed down to a few percent of the panel's width (the "#"
  // column, action-button columns, ...) that padding alone can eat the
  // entire column, leaving no room for even a single digit — which is why
  // fitContainer tables force tight, explicit padding instead of relying on
  // the `dense` prop (which also shrinks font size, not just padding).
  // A column with width: 'auto' is sized by its content (table-layout switches
  // to auto; the other columns keep their % widths).
  const hasAutoCol = fitContainer && columns.some((c) => c.width === 'auto');
  const cellFitSx = (col) => {
    if (!fitContainer) return undefined;
    if (col.width === 'auto') {
      return { width: 'auto', whiteSpace: 'nowrap', padding: '8px 6px' };
    }
    return {
      width: col.width,
      maxWidth: col.width,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: col.wrap ? 'normal' : 'nowrap',
      padding: '8px 6px',
    };
  };

  return (
    <TableContainer sx={fitContainer ? { overflowX: 'hidden', width: '100%' } : { overflowX: 'auto' }}>
      <Table
        size={dense ? 'small' : 'medium'}
        sx={fitContainer ? { width: '100%', tableLayout: hasAutoCol ? 'auto' : 'fixed' } : { minWidth: dense ? 0 : 480 }}
      >
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={col.key}
                align={col.align || 'left'}
                className={!fitContainer && col.key === 'action' && col.sticky !== false ? 'sticky-action' : undefined}
                sx={{
                  color: 'text.secondary', fontWeight: 600, fontSize: 12.5, borderBottomColor: 'divider',
                  whiteSpace: 'nowrap',
                  ...cellFitSx(col),
                }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow
              key={getRowKey ? getRowKey(row) : rowIndex}
              hover
              onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
              sx={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  align={col.align || 'left'}
                  className={!fitContainer && col.key === 'action' && col.sticky !== false ? 'sticky-action' : undefined}
                  sx={{ fontSize: 13.5, borderBottomColor: 'divider', ...cellFitSx(col) }}
                  onClick={col.stopRowClick ? (e) => e.stopPropagation() : undefined}
                >
                  {col.render ? col.render(row, rowIndex) : row[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
