import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Stack, Box, Typography, Breadcrumbs, Link as MuiLink, Grid, Paper, Button, ButtonBase,
  TextField, MenuItem,
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CloseIcon from '@mui/icons-material/Close';

import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/ui/uiSlice';

import { useSalesReportFiltersQuery } from '../../../api/salesReportsApi';
import { SALES_REPORT_ITEMS } from './salesReportsMockData';
import { SALES_REPORT_DEFINITIONS } from './salesReportDefinitions';
import { SALES_REPORTS, todayIso } from './salesReportConfig';

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
 * Sales Reports — the Sales Report category's landing screen, reached from
 * the Reports page's "Sales Report" card. Every tile opens a live report at
 * /reports/sales/:reportKey:
 *  - Daily, Monthly, Outlet-wise, Cashier-wise, Item-wise, Category-wise,
 *    Brand-wise and Customer-wise (SALES_REPORTS in salesReportConfig.js) get
 *    the date range / outlet / cashier chosen here carried into the report;
 *  - Hourly, Payment-wise, Discount, Tax and Return
 *    (SALES_REPORT_DEFINITIONS) have their own filter bar on the report page.
 * Outlets and cashiers come from real data.
 */
export default function SalesReportsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const today = todayIso();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [outletId, setOutletId] = useState('');
  const [cashier, setCashier] = useState('');

  const { data: filterData } = useSalesReportFiltersQuery();
  const outlets = filterData?.outlets || [];
  const cashiers = filterData?.cashiers || [];
  const canChooseOutlet = filterData?.canChooseOutlet !== false;
  const dateError = dateFrom && dateTo && dateFrom > dateTo ? '"To" date cannot be before "From" date' : '';

  const handleReset = () => {
    setDateFrom(today);
    setDateTo(today);
    setOutletId('');
    setCashier('');
  };
  const handleOpenReport = (item) => {
    // Reports with their own filter bar open straight away.
    if (SALES_REPORT_DEFINITIONS[item.key]) {
      navigate(`/reports/sales/${item.key}`);
      return;
    }
    if (!SALES_REPORTS[item.key]) {
      dispatch(showToast(`${item.label} report is coming soon`, 'info'));
      return;
    }
    if (dateError || !dateFrom || !dateTo) {
      dispatch(showToast(dateError || 'Pick a date range first', 'warning'));
      return;
    }
    const q = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (canChooseOutlet && outletId) q.set('outletId', outletId);
    if (cashier) q.set('cashier', cashier);
    navigate(`/reports/sales/${item.key}?${q.toString()}`);
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Sales Reports</Typography>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14 }} />} sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 12.5 } }}>
            <MuiLink component={RouterLink} to="/home" underline="hover" color="text.secondary">Home</MuiLink>
            <MuiLink component={RouterLink} to="/reports" underline="hover" color="text.secondary">Reports</MuiLink>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Sales Reports</Typography>
          </Breadcrumbs>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <Grid size={{ xs: 6, md: 2.5 }}>
            <TextField label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} error={Boolean(dateError)} />
          </Grid>
          <Grid size={{ xs: 6, md: 2.5 }}>
            <TextField label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} error={Boolean(dateError)} helperText={dateError} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              select
              label="Outlet"
              value={canChooseOutlet ? outletId : (outlets[0]?.id || '')}
              onChange={(e) => setOutletId(e.target.value)}
              disabled={!canChooseOutlet}
              fullWidth
            >
              {canChooseOutlet ? <MenuItem value="">All Outlets</MenuItem> : null}
              {outlets.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField select label="Cashier" value={cashier} onChange={(e) => setCashier(e.target.value)} fullWidth>
              <MenuItem value="">All Cashiers</MenuItem>
              {cashiers.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 1 }}>
            <Button variant="outlined" color="inherit" startIcon={<CloseIcon fontSize="small" />} onClick={handleReset} fullWidth sx={{ height: 56 }}>
              Reset
            </Button>
          </Grid>
        </Grid>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          These filters are applied to Daily, Monthly, Outlet-wise, Cashier-wise, Item-wise, Category-wise, Brand-wise and Customer-wise reports.
          The other reports have their own filters.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {SALES_REPORT_ITEMS.map((item) => (
          <Grid key={item.key} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <ReportTypeCard item={item} onOpen={handleOpenReport} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
