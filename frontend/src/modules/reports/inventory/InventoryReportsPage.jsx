import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, Button, ButtonBase,
  TextField, MenuItem, InputAdornment,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/ui/uiSlice';

import {
  OUTLET_OPTIONS, WAREHOUSE_OPTIONS, DEFAULT_DATE_RANGE, INVENTORY_REPORT_ITEMS,
} from './inventoryReportsMockData';

function formatDisplayDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function ReportTypeCard({ item, onOpen }) {
  const Icon = item.icon;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
      <ButtonBase
        onClick={() => onOpen(item)}
        sx={{
          width: '100%',
          height: '100%',
          p: 2.25,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.75,
          textAlign: 'left',
          borderRadius: 3,
          transition: 'transform 0.15s, box-shadow 0.15s',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: `${item.color}1F`,
            color: item.color,
            flexShrink: 0,
          }}
        >
          <Icon />
        </Box>
        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: item.color }}>
              {item.label}
            </Typography>
            <NavigateNextIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {item.description}
          </Typography>
        </Stack>
      </ButtonBase>
    </Paper>
  );
}

/**
 * Inventory Reports — the Inventory Report category's landing screen,
 * reached from the Reports page's "Inventory Report" card. A grid of
 * individual inventory report types (Current Stock, Low Stock, Out-of-Stock,
 * Stock Movement, Stock Valuation, Stock Adjustment, Wastage, Batch Expiry,
 * Slow Moving Items, Fast Moving Items, Physical Stock Variance) — each tile
 * opens its own real report at /reports/inventory/:reportKey (see
 * InventoryReportDetailPage.jsx), which has its own date/outlet/warehouse
 * filters scoped to that report. The date/outlet/warehouse bar on this
 * landing page itself has no backend meaning of its own (there's nothing to
 * filter here but the tile grid), so it stays local state.
 */
export default function InventoryReportsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState(DEFAULT_DATE_RANGE.from);
  const [dateTo, setDateTo] = useState(DEFAULT_DATE_RANGE.to);
  const [outlet, setOutlet] = useState('All Outlets');
  const [warehouse, setWarehouse] = useState('All Warehouses');


  const handleDatePick = () => dispatch(showToast('Date range picker is coming soon', 'info'));
  const handleSearch = () => dispatch(showToast('Inventory report filters are coming soon', 'info'));
  const handleReset = () => {
    setDateFrom(DEFAULT_DATE_RANGE.from);
    setDateTo(DEFAULT_DATE_RANGE.to);
    setOutlet('All Outlets');
    setWarehouse('All Warehouses');
  };
  const handleOpenReport = (item) => navigate(`/reports/inventory/${item.key}`);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Inventory Reports</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/reports" underline="hover" color="text.secondary">Reports</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Inventory Reports</Typography>
          </Breadcrumbs>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'flex-end' }}>
          <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Date Range
            </Typography>
            <TextField
              size="medium"
              value={`${formatDisplayDate(dateFrom)} - ${formatDisplayDate(dateTo)}`}
              onClick={handleDatePick}
              fullWidth
              slotProps={{
                input: {
                  readOnly: true,
                  endAdornment: <InputAdornment position="end"><CalendarTodayOutlinedIcon fontSize="small" /></InputAdornment>,
                },
              }}
              sx={{ cursor: 'pointer' }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Outlet
            </Typography>
            <TextField select value={outlet} onChange={(e) => setOutlet(e.target.value)} fullWidth>
              <MenuItem value="All Outlets">All Outlets</MenuItem>
              {OUTLET_OPTIONS.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Warehouse
            </Typography>
            <TextField select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} fullWidth>
              <MenuItem value="All Warehouses">All Warehouses</MenuItem>
              {WAREHOUSE_OPTIONS.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 1.75 }}>
            <Button variant="contained" color="primary" startIcon={<SearchIcon fontSize="small" />} onClick={handleSearch} fullWidth>
              Search
            </Button>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 1.75 }}>
            <Button variant="outlined" color="inherit" startIcon={<CloseIcon fontSize="small" />} onClick={handleReset} fullWidth>
              Reset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2}>
        {INVENTORY_REPORT_ITEMS.map((item) => (
          <Grid key={item.key} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <ReportTypeCard item={item} onOpen={handleOpenReport} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
