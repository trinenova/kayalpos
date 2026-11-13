import { Fragment } from 'react';
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, Checkbox, Typography,
} from '@mui/material';

import {
  MENU_TREE, ACTIONS, ACTION_LABELS, actionState, allState, setAction, setAll,
} from '../../features/permissions/permissionCatalog';

const HEADER_BG = '#7F1D1D';
const GRID = '1px solid';

const COLUMNS = [...ACTIONS, 'all'];

/**
 * Role permission matrix: one row per menu, columns View / Add / Edit /
 * Delete / All. Group rows (Masters, Sales, ...) are bold and act on all of
 * their sub-menus at once; the checkbox in the header does the same for the
 * whole column. A "—" means that menu doesn't support the action. Add / Edit /
 * Delete tick View automatically, and clearing View clears the rest.
 *
 * Controlled: `value` is the permissions object, `onChange(next)` receives the
 * updated one.
 */
export default function PermissionMatrix({ value, onChange, disabled = false }) {
  const toggle = (key, column) => {
    const current = column === 'all' ? allState(value, key) : actionState(value, key, column);
    const checked = current !== 'all';
    onChange(column === 'all' ? setAll(value, key, checked) : setAction(value, key, column, checked));
  };

  const renderCell = (key, column) => {
    const state = column === 'all' ? allState(value, key) : actionState(value, key, column);
    return (
      <TableCell key={column} align="center" sx={{ borderLeft: GRID, borderColor: 'divider', p: 0.5 }}>
        {state === 'na' ? (
          <Typography component="span" sx={{ color: 'text.disabled' }}>—</Typography>
        ) : (
          <Checkbox
            size="small"
            checked={state === 'all'}
            indeterminate={state === 'some'}
            disabled={disabled}
            onChange={() => toggle(key, column)}
            slotProps={{ input: { 'aria-label': `${key} ${column}` } }}
          />
        )}
      </TableCell>
    );
  };

  const renderRow = (node, { indent = false, bold = false } = {}) => (
    <TableRow key={node.key} hover sx={{ '& td': { borderBottom: GRID, borderColor: 'divider' } }}>
      <TableCell sx={{ pl: indent ? 4 : 2, fontWeight: bold ? 700 : 400, fontSize: 14 }}>{node.label}</TableCell>
      {COLUMNS.map((column) => renderCell(node.key, column))}
    </TableRow>
  );

  return (
    <Box sx={{ border: GRID, borderColor: 'divider', borderRadius: 2, overflow: 'auto', maxHeight: '60vh' }}>
      <Table size="small" stickyHeader sx={{ minWidth: 640 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{
              bgcolor: HEADER_BG, color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: 0.6,
            }}
            >
              SECTION
            </TableCell>
            {COLUMNS.map((column) => {
              const state = column === 'all' ? allState(value, null) : actionState(value, null, column);
              return (
                <TableCell
                  key={column}
                  align="center"
                  sx={{
                    bgcolor: HEADER_BG, color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: 0.6, whiteSpace: 'nowrap',
                  }}
                >
                  {column === 'all' ? 'ALL' : ACTION_LABELS[column].toUpperCase()}
                  <Checkbox
                    size="small"
                    checked={state === 'all'}
                    indeterminate={state === 'some'}
                    disabled={disabled}
                    onChange={() => toggle(null, column)}
                    sx={{ color: '#fff', p: 0.5, ml: 0.5, '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#fff' } }}
                    slotProps={{ input: { 'aria-label': `Select all ${column}` } }}
                  />
                </TableCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {MENU_TREE.map((node) => (
            <Fragment key={node.key}>
              {renderRow(node, { bold: Boolean(node.children) })}
              {node.children?.map((child) => renderRow(child, { indent: true }))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
