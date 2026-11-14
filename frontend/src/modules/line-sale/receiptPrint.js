import { PAYMENT_METHODS } from './lineSaleMockData';

const money = (n) => (Number(n) || 0).toFixed(2);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Escapes text dropped into the receipt's HTML (product/customer names
// aren't attacker-controlled here, but this is printed via
// document.write into a raw window, so it's cheap insurance against a
// name containing '<' or '&' breaking the markup).
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Builds the printable HTML for a thermal-style bill receipt (80mm roll
 * layout: centered business header, dashed separators, Item/Qty/Rate/Value
 * columns, a rounding + savings summary, and a GST%/Sale Amt/CGST/SGST
 * breakdown table), matching the paper receipt format the cashier screen's
 * "Print Invoice" button is meant to reproduce.
 *
 * `company` is the Company master's profile row (null if the tenant hasn't
 * saved one yet — every header line below falls back to an em dash rather
 * than fabricating a business name/address). GST is broken out by each
 * cart line's own `taxRate` (not hardcoded to one rate) so a catalog with
 * mixed tax rates still gets a correct per-rate table, the same way the
 * reference paper bill does for its 5% and 18% rows.
 */
export function buildReceiptHtml({
  company, billNo, cashierName, dateTime, cart, totals, paymentMethod, receivedAmount, changeAmount,
}) {
  const paymentLabel = PAYMENT_METHODS.find((m) => m.key === paymentMethod)?.label || paymentMethod;
  const totalQty = cart.reduce((sum, line) => sum + line.qty, 0);
  const roundedTotal = Math.round(totals.grandTotal);
  const roundOff = round2(roundedTotal - totals.grandTotal);

  const itemRows = cart.map((line) => `
    <tr>
      <td>${esc(line.name)}</td>
      <td class="num">${line.qty.toFixed(3)}</td>
      <td class="num">${money(line.price)}</td>
      <td class="num">${money(line.qty * line.price)}</td>
    </tr>`).join('');

  // Groups cart lines by their own tax rate and prorates each line's share
  // of the post-discount taxable amount — the same formula the Line Sale
  // page uses to compute `totals.tax`, just broken out per rate instead of
  // summed into one number.
  const taxGroups = new Map();
  cart.forEach((line) => {
    const lineTaxable = totals.subTotal > 0 ? ((line.qty * line.price) / totals.subTotal) * totals.taxable : 0;
    const key = line.taxRate;
    taxGroups.set(key, (taxGroups.get(key) || 0) + lineTaxable);
  });
  const taxRows = Array.from(taxGroups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, saleAmt]) => {
      const gst = round2(saleAmt * rate);
      const half = round2(gst / 2);
      return `
      <tr>
        <td class="num">${(rate * 100).toFixed(2)}</td>
        <td class="num">${money(saleAmt)}</td>
        <td class="num">${money(gst)}</td>
        <td class="num">${money(half)}</td>
        <td class="num">${money(half)}</td>
      </tr>`;
    }).join('');

  const addressLines = [
    company?.addressLine1, company?.addressLine2, company?.addressLine3, company?.addressLine4, company?.addressLandmark,
  ].filter(Boolean).join(', ');
  const phoneLine = [company?.phone, company?.mobile].filter(Boolean).join(', ');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${esc(billNo)}</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #000;
    width: 76mm;
    margin: 0 auto;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 1px 2px; text-align: left; font-size: 11px; }
  td.num, th.num { text-align: right; }
  .row { display: flex; justify-content: space-between; }
  .biz-name { font-size: 14px; }
  .footer { margin-top: 6px; }
</style>
</head>
<body>
  <div class="center bold biz-name">${esc(company?.companyName || company?.displayName || '—')}</div>
  ${addressLines ? `<div class="center">${esc(addressLines)}</div>` : ''}
  ${phoneLine ? `<div class="center">Ph: ${esc(phoneLine)}</div>` : ''}
  ${company?.gstin ? `<div class="center">GSTIN: ${esc(company.gstin)}</div>` : ''}
  ${company?.fssaiNo ? `<div class="center">FSSAI No: ${esc(company.fssaiNo)}</div>` : ''}

  <div class="divider"></div>
  <div class="row"><span>Bill No: ${esc(billNo)}</span></div>
  <div class="row"><span>Date &amp; Time:</span><span>${esc(dateTime)}</span></div>
  <div class="row"><span>Cashier:</span><span>${esc(cashierName)}</span></div>
  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th>Item Name</th>
        <th class="num">Qty</th>
        <th class="num">Rate</th>
        <th class="num">Value</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="divider"></div>

  <div class="row"><span>Items: ${cart.length}  Qty: ${totalQty}</span><span>Rnd: ${money(roundOff)}</span></div>
  <div class="row bold"><span>Total</span><span>${money(roundedTotal)}</span></div>
  ${totals.discountAmount > 0 ? `<div class="center">-** You have Saved Rs. ${money(totals.discountAmount)} **-</div>` : ''}
  <div class="row"><span>Paid by ${esc(paymentLabel)}</span></div>
  <div class="row"><span>Tendered:</span><span>${money(receivedAmount)}</span></div>
  <div class="row"><span>Balance:</span><span>${money(Math.max(changeAmount, 0))}</span></div>

  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th class="num">GST%</th>
        <th class="num">Sale Amt</th>
        <th class="num">GST</th>
        <th class="num">CGST</th>
        <th class="num">SGST</th>
      </tr>
    </thead>
    <tbody>${taxRows}</tbody>
  </table>

  <div class="divider"></div>
  <div class="center footer">
    Inclusive of all Taxes<br />
    Thank You! Visit Again!
  </div>
</body>
</html>`;
}

/**
 * Prints the receipt through a hidden same-page iframe rather than
 * `window.open` — a popup can be silently blocked by the browser's own
 * pop-up blocker (or, same-origin policy aside, by extensions), which would
 * make "Print Invoice" sporadically do nothing with no way to recover
 * short of the user changing a browser setting. An iframe never triggers
 * that blocker since it isn't a new window, and is removed from the DOM
 * right after the print dialog closes.
 */
export function printHtml(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    win.focus();
    win.print();
    // No reliable onafterprint across browsers for an iframe's own print
    // dialog, so the iframe is cleaned up on a short delay instead of left
    // in the DOM indefinitely.
    setTimeout(cleanup, 1000);
  };
  iframe.srcdoc = html;
  return true;
}

export function printReceipt(data) {
  return printHtml(buildReceiptHtml(data));
}

/**
 * Sales Return slip — same 80mm thermal layout and styling as the bill
 * receipt, adapted for a return: original bill reference, returned lines,
 * the per-rate GST being reversed, and the refund mode/amount.
 * `isPreview` marks a slip printed before the return is processed (the
 * return number is then only the upcoming number, not yet final).
 */
export function buildReturnReceiptHtml({
  company, returnNo, originalInvoiceNo, invoiceDate, dateTime, cashierName, customerName,
  reasonLabel, lines, totals, refundMode, refundToLabel, isPreview,
}) {
  const totalQty = lines.reduce((sum, line) => sum + line.qty, 0);
  const roundedTotal = Math.round(totals.grandTotal);
  const roundOff = round2(roundedTotal - totals.grandTotal);

  const itemRows = lines.map((line) => `
    <tr>
      <td>${esc(line.name)}</td>
      <td class="num">${line.qty}</td>
      <td class="num">${money(line.rate)}</td>
      <td class="num">${money(line.qty * line.rate)}</td>
    </tr>`).join('');

  const taxGroups = new Map();
  lines.forEach((line) => {
    taxGroups.set(line.taxRate, (taxGroups.get(line.taxRate) || 0) + line.qty * line.rate);
  });
  const taxRows = Array.from(taxGroups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, saleAmt]) => {
      const gst = round2(saleAmt * rate);
      const half = round2(gst / 2);
      return `
      <tr>
        <td class="num">${(rate * 100).toFixed(2)}</td>
        <td class="num">${money(saleAmt)}</td>
        <td class="num">${money(gst)}</td>
        <td class="num">${money(half)}</td>
        <td class="num">${money(half)}</td>
      </tr>`;
    }).join('');

  const addressLines = [
    company?.addressLine1, company?.addressLine2, company?.addressLine3, company?.addressLine4, company?.addressLandmark,
  ].filter(Boolean).join(', ');
  const phoneLine = [company?.phone, company?.mobile].filter(Boolean).join(', ');
  const refundLine = refundMode === 'credit-note'
    ? 'Credit Note issued'
    : `Refund to ${esc(refundToLabel || '-')}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Sales Return ${esc(returnNo)}</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; width: 76mm; margin: 0 auto; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 1px 2px; text-align: left; font-size: 11px; }
  td.num, th.num { text-align: right; }
  .row { display: flex; justify-content: space-between; }
  .biz-name { font-size: 14px; }
  .footer { margin-top: 6px; }
</style>
</head>
<body>
  <div class="center bold biz-name">${esc(company?.companyName || company?.displayName || '—')}</div>
  ${addressLines ? `<div class="center">${esc(addressLines)}</div>` : ''}
  ${phoneLine ? `<div class="center">Ph: ${esc(phoneLine)}</div>` : ''}
  ${company?.gstin ? `<div class="center">GSTIN: ${esc(company.gstin)}</div>` : ''}

  <div class="divider"></div>
  <div class="center bold">SALES RETURN${isPreview ? ' (PREVIEW)' : ''}</div>
  <div class="row"><span>Return No: ${esc(returnNo)}</span></div>
  <div class="row"><span>Original Bill:</span><span>${esc(originalInvoiceNo)}</span></div>
  <div class="row"><span>Bill Date:</span><span>${esc(invoiceDate)}</span></div>
  <div class="row"><span>Date &amp; Time:</span><span>${esc(dateTime)}</span></div>
  <div class="row"><span>Customer:</span><span>${esc(customerName)}</span></div>
  <div class="row"><span>Cashier:</span><span>${esc(cashierName)}</span></div>
  <div class="row"><span>Reason:</span><span>${esc(reasonLabel || '-')}</span></div>
  <div class="divider"></div>

  <table>
    <thead>
      <tr><th>Item Name</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Value</th></tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="divider"></div>

  <div class="row"><span>Items: ${lines.length}  Qty: ${totalQty}</span><span>Rnd: ${money(roundOff)}</span></div>
  <div class="row"><span>Sub Total</span><span>${money(totals.subTotal)}</span></div>
  <div class="row"><span>GST</span><span>${money(totals.tax)}</span></div>
  <div class="row bold"><span>Refund Total</span><span>${money(roundedTotal)}</span></div>
  <div class="row"><span>${refundLine}</span></div>

  <div class="divider"></div>
  <table>
    <thead>
      <tr><th class="num">GST%</th><th class="num">Sale Amt</th><th class="num">GST</th><th class="num">CGST</th><th class="num">SGST</th></tr>
    </thead>
    <tbody>${taxRows}</tbody>
  </table>

  <div class="divider"></div>
  <div class="center footer">Goods returned against the bill above.<br />Thank You!</div>
</body>
</html>`;
}

export function printReturnReceipt(data) {
  return printHtml(buildReturnReceiptHtml(data));
}
