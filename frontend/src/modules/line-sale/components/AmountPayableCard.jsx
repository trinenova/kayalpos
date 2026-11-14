import { Box, Stack, Typography, Divider } from "@mui/material";
import { formatCurrency } from "../../../utils/format";

const money = (v) => formatCurrency(v, { decimals: true });

/**
 * Dark summary card at the top of the right column on the payment step:
 * the amount payable, the bill's line items and the sub / discount / tax
 * breakdown. Long carts show the first few lines and "+ N more".
 */
export default function AmountPayableCard({ billNo, lines, totals }) {
  const MAX_LINES = 3;
  const shown = lines.slice(0, MAX_LINES);
  const hidden = lines.length - shown.length;
  const groups = totals.taxGroups || [];
  const rates = [...new Set(lines.map((l) => l.taxRate).filter((r) => r > 0))];
  const gstLabel =
    rates.length === 1 ? `GST ${Number((rates[0] * 100).toFixed(2))}%` : "GST";

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 4,
        p: 3,
        color: "#fff",
        // Flat Dusty Navy fill — matches the Amount Payable bar on the
        // billing step's Bill Summary panel (BillSummaryPanel.jsx).
        bgcolor: "#4A6FA5",
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
      >
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            color: "rgba(255,255,255,0.65)",
          }}
        >
          AMOUNT PAYABLE
        </Typography>
        <Typography
          noWrap
          sx={{
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.65)",
          }}
        >
          {billNo}
        </Typography>
      </Stack>

      <Typography
        sx={{ fontSize: 40, fontWeight: 800, lineHeight: 1.2, my: 1 }}
      >
        {money(totals.grandTotal)}
      </Typography>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.14)", my: 1.5 }} />

      <Stack spacing={0.5}>
        {shown.map((l) => (
          <Stack
            key={l.code}
            direction="row"
            sx={{ justifyContent: "space-between", gap: 2, fontSize: 12.5 }}
          >
            <Typography
              noWrap
              sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}
            >
              {l.name} × {l.qty}
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>
              {money(l.qty * l.price)}
            </Typography>
          </Stack>
        ))}
        {hidden > 0 && (
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            + {hidden} more item{hidden === 1 ? "" : "s"}
          </Typography>
        )}
      </Stack>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.14)", my: 1.5 }} />

      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
          fontSize: 12,
        }}
      >
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          Sub <b style={{ color: "#fff" }}>{money(totals.subTotal)}</b>
        </Typography>
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          Disc <b style={{ color: "#fff" }}>{money(totals.discountAmount)}</b>
        </Typography>
        {totals.tax > 0 && (
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            {gstLabel} <b style={{ color: "#fff" }}>{money(totals.tax)}</b>
          </Typography>
        )}
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          {lines.length} item{lines.length === 1 ? "" : "s"}
        </Typography>
      </Stack>

      {/* GST summary: one row per rate when the bill mixes products with
          different GST rates (each product is taxed at its own rate). */}
      {groups.length > 1 && (
        <>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.14)", my: 1.5 }} />
          <Stack spacing={0.25}>
            {groups.map((g) => (
              <Stack
                key={g.rate}
                direction="row"
                sx={{ justifyContent: "space-between", gap: 2 }}
              >
                <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  GST {Number((g.rate * 100).toFixed(2))}% on {money(g.taxable)}
                  {" "}
                  <span style={{ opacity: 0.7 }}>
                    (CGST {money(g.tax / 2)} + SGST {money(g.tax / 2)})
                  </span>
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  {money(g.tax)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
