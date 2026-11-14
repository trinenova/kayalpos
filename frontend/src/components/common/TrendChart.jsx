import { LineChart } from '@mui/x-charts/LineChart';
import { useTheme, alpha } from '@mui/material/styles';

const compactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Orange line trend chart (Sales Overview / Sales Trend on both
 * dashboards). One wrapper so every trend chart in the app shares the same
 * styling instead of hand-configuring @mui/x-charts per page.
 *
 * The y-axis always uses a short, compact label (e.g. ₹20K) so it never
 * gets truncated and doesn't need a wide left margin — full precision is
 * still shown via `valueFormatter` in the tooltip.
 */
export default function TrendChart({
  categories, values, height = 260, valueFormatter, area = false,
}) {
  const theme = useTheme();

  return (
    <LineChart
      height={height}
      series={[
        {
          data: values,
          // `area` (opt-in, used by the dashboards) fills under the line with a
          // soft tint of the theme's primary colour.
          area,
          showMark: true,
          curve: 'monotone',
          color: theme.palette.primary.main,
          valueFormatter,
        },
      ]}
      xAxis={[{ data: categories, scaleType: 'point', tickLabelStyle: { fontSize: 11 } }]}
      yAxis={[{ tickLabelStyle: { fontSize: 11 }, valueFormatter: (v) => compactFormatter.format(v) }]}
      grid={{ horizontal: true }}
      hideLegend
      margin={{ top: 16, bottom: 28, right: 16 }}
      sx={{
        '& .MuiLineElement-root': { strokeWidth: 2.5 },
        '& .MuiAreaElement-root': { fill: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.14) },
        '& .MuiMarkElement-root': { fill: theme.palette.primary.main, stroke: theme.palette.background.paper, strokeWidth: 2 },
        '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: theme.palette.divider },
      }}
    />
  );
}
