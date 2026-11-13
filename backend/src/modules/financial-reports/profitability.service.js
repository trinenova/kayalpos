import { getGrossProfitReport } from '../gross-profit/grossProfit.service.js';
import { getExpenseReport } from '../expense-report/expenseReport.service.js';
import { round2 } from './common.js';

/**
 * Profitability report: Net sales (excl. GST) - cost of goods sold (FIFO lot
 * cost) = gross profit; minus expenses incurred in the period (incl. tax) =
 * net profit. Built from the Gross Profit and Expense reports so all three
 * always agree.
 */
export async function getProfitabilityReport(user, params) {
  const [gp, ex] = await Promise.all([getGrossProfitReport(user, params), getExpenseReport(user, params)]);

  const salesByDay = new Map(gp.trend.map((d) => [d.day, d]));
  const expByDay = new Map(ex.daily.map((d) => [d.day, d.total]));
  const days = [...new Set([...salesByDay.keys(), ...expByDay.keys()])].sort();
  const daily = days.map((day) => {
    const s = salesByDay.get(day);
    const netSales = s?.netSales || 0;
    const cost = s?.cost || 0;
    const grossProfit = round2(netSales - cost);
    const expenses = expByDay.get(day) || 0;
    return { day, netSales, cost, grossProfit, expenses, netProfit: round2(grossProfit - expenses) };
  });

  const { netSales, cost, grossProfit } = gp.summary;
  const expenses = ex.summary.totalAmount;
  const netProfit = round2(grossProfit - expenses);
  const pct = (v) => (netSales > 0 ? round2((v / netSales) * 100) : 0);

  return {
    from: gp.from,
    to: gp.to,
    summary: {
      netSales,
      cost,
      grossProfit,
      grossMarginPct: pct(grossProfit),
      expenses,
      netProfit,
      netMarginPct: pct(netProfit),
      productsWithoutCost: gp.summary.productsWithoutCost,
    },
    byCategory: ex.byCategory.map((c) => ({ category: c.category, total: c.total })),
    topProducts: gp.rows.slice().sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 10)
      .map((r) => ({ code: r.code, name: r.name, netSales: r.netSales, grossProfit: r.grossProfit, marginPct: r.marginPct })),
    daily,
    notes: {
      basis: 'Net profit = net sales (excl. GST) - cost of goods sold - expenses (incl. tax). Cost uses the purchase price of the batch each item was sold from; sales returns are not deducted.',
    },
  };
}
