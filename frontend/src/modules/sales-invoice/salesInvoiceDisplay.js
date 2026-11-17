/**
 * Shared mappers between the real Sales Invoice API shape (Decimal fields
 * serialized as strings, dates as ISO strings, `status` already
 * live-computed by the backend — see backend/src/modules/sales-invoice's
 * computeStatus()) and the shapes SalesInvoiceTable / InvoiceDetailsCard /
 * SalesInvoiceSummaryCards / the status pages already expect. Every figure
 * here comes straight from a real SalesInvoice row — a tenant with no
 * invoices yet honestly shows zeros/empty lists, never a placeholder number.
 */
import { formatPickerDate, parsePickerDate } from '../../components/form/FormDatePicker';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function num(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

const STATUS_LABEL = { draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue' };

export function statusLabel(status) {
  return STATUS_LABEL[status] || status;
}

/** True when `row` (an API row, or a toInvoiceRow/toInvoiceDetails shape)
 * came from a Line Sale bill rather than a real SalesInvoice — see
 * backend/src/modules/sale/sale.service.js's listLineSaleBillsAsInvoices.
 * Edit/Duplicate/Delete never apply to one of these: it's a settled POS
 * transaction, not an editable document. */
export function isPosInvoiceRow(row) {
  return row?.source === 'pos';
}

/** Row shape for SalesInvoiceTable. */
export function toInvoiceRow(row) {
  return {
    id: row.id,
    code: row.code,
    date: formatDate(row.invoiceDate),
    customer: row.customerName,
    amount: num(row.grandTotal),
    dueDate: row.dueDate ? formatDate(row.dueDate) : '-',
    status: row.status,
    createdBy: row.createdBy,
    source: row.source || 'invoice',
  };
}

/** Full detail shape for InvoiceDetailsCard / InvoiceViewPage. */
export function toInvoiceDetails(row) {
  const sgstRate = 2.5;
  const cgstRate = 2.5;
  return {
    id: row.id,
    source: row.source || 'invoice',
    code: row.code,
    date: formatDate(row.invoiceDate),
    ref: row.salesOrderRef || row.quotationRef || '-',
    status: row.status,
    dbStatus: row.dbStatus,
    totalAmount: num(row.grandTotal),
    customer: {
      name: row.customerName,
      mobile: row.mobile || '-',
      email: row.email || '-',
      address: row.address || '-',
    },
    dueDate: row.dueDate ? formatDate(row.dueDate) : '-',
    paymentTerms: row.paymentTerms || '-',
    salesPerson: row.salesPerson,
    createdBy: row.createdBy,
    paidOn: row.paidOn ? formatDate(row.paidOn) : '-',
    items: (row.items || []).map((item) => ({
      code: item.itemCode,
      name: item.itemName,
      hsn: item.hsnCode || '-',
      qty: num(item.qty),
      unitPrice: num(item.unitPrice),
      discount: num(item.discountAmount),
      amount: num(item.amount),
    })),
    totals: {
      subTotal: num(row.subTotal),
      discount: num(row.discountAmount),
      taxableAmount: num(row.taxableAmount),
      sgst: { rate: sgstRate, amount: num(row.sgstAmount) },
      cgst: { rate: cgstRate, amount: num(row.cgstAmount) },
      grandTotal: num(row.grandTotal),
    },
  };
}

/** 5-tile "Sales Invoice" summary strip — captions are honestly "All Time"
 * since getSalesInvoiceSummary() aggregates every invoice ever created, not
 * a monthly window. */
export function buildSummary(summary) {
  const caption = 'All Time';
  return {
    totalInvoices: { value: summary?.totalInvoices || 0, caption },
    totalAmount: { value: summary?.totalAmount || 0, caption },
    paid: { value: summary?.paid || 0, caption },
    draft: { value: summary?.draft || 0, caption },
    overdue: { value: summary?.overdue || 0, caption },
  };
}

const STATUS_EXTRA_LABELS = {
  draft: ['Total Draft Amount', 'Average Invoice Value', 'Total Line Items'],
  sent: ['Total Sent Amount', 'Average Invoice Value', 'Total Line Items'],
  paid: ['Total Paid Amount', 'Average Invoice Value', 'Total Line Items'],
  overdue: ['Total Overdue Amount', 'Average Invoice Value', 'Total Line Items'],
};

/** 4-tile status-page strip (count + 3 real aggregates) for one status. */
export function buildStatusStats(status, statusSummary) {
  const labels = STATUS_EXTRA_LABELS[status] || STATUS_EXTRA_LABELS.draft;
  const caption = 'All Time';
  return {
    count: { value: statusSummary?.count || 0, caption },
    extra: [
      { label: labels[0], value: statusSummary?.totalAmount || 0, currency: true, caption },
      { label: labels[1], value: statusSummary?.averageAmount || 0, currency: true, caption },
      { label: labels[2], value: statusSummary?.totalItems || 0, currency: false, caption },
    ],
  };
}

function itemRowToFormRow(item) {
  return {
    itemCode: item.itemCode || '',
    itemName: item.itemName || '',
    hsnCode: item.hsnCode || '',
    qty: item.qty !== null && item.qty !== undefined ? String(item.qty) : '',
    unit: item.unit || '',
    unitPrice: item.unitPrice !== null && item.unitPrice !== undefined ? String(item.unitPrice) : '',
    discountPercent: item.discountPercent !== null && item.discountPercent !== undefined ? String(item.discountPercent) : '',
    taxCode: item.taxCode || '',
  };
}

/** Converts a real API invoice row into the Create/Edit form's default
 * values — used only in edit mode (see CreateSalesInvoicePage). */
export function invoiceToFormValues(row, emptyItemRow) {
  return {
    customerId: row.customerId || '',
    contactPerson: row.contactPerson || '',
    mobile: row.mobile || '',
    email: row.email || '',
    address: row.address || '',
    invoiceDate: formatPickerDate(new Date(row.invoiceDate)),
    dueDate: row.dueDate ? formatPickerDate(new Date(row.dueDate)) : '',
    salesOrderRef: row.salesOrderRef || '',
    quotationRef: row.quotationRef || '',
    salesPerson: row.salesPerson || '',
    currency: row.currency || 'INR',
    paymentTerms: row.paymentTerms || '',
    priceList: row.priceList || '',
    deliveryDate: row.deliveryDate ? formatPickerDate(new Date(row.deliveryDate)) : '',
    referenceNo: row.referenceNo || '',
    remarks: row.remarks || '',
    notes: row.notes || '',
    extraDiscount: row.extraDiscount !== null && row.extraDiscount !== undefined ? String(row.extraDiscount) : '0',
    items: row.items?.length ? row.items.map(itemRowToFormRow) : [emptyItemRow()],
  };
}

/** Converts the form's string-based values into the JSON payload the
 * backend's createSalesInvoiceSchema/updateSalesInvoiceSchema expect —
 * dates parsed back to real Date objects, numbers coerced, and any still-
 * blank spare item rows dropped (see isBlankItemRow in
 * createSalesInvoiceSchema.js) so they never reach the "add at least one
 * item" validation as empty entries. */
export function formValuesToPayload(values, { status, isBlankItemRow }) {
  const invoiceDate = parsePickerDate(values.invoiceDate);
  const dueDate = values.dueDate ? parsePickerDate(values.dueDate) : null;
  const deliveryDate = values.deliveryDate ? parsePickerDate(values.deliveryDate) : null;

  const items = values.items
    .filter((row) => !isBlankItemRow(row))
    .map((row) => ({
      itemCode: row.itemCode.trim(),
      itemName: row.itemName.trim(),
      hsnCode: row.hsnCode?.trim() || '',
      qty: Number(row.qty),
      unit: row.unit?.trim() || '',
      unitPrice: Number(row.unitPrice),
      discountPercent: row.discountPercent ? Number(row.discountPercent) : 0,
      taxCode: row.taxCode?.trim() || '',
    }));

  return {
    customerId: values.customerId,
    contactPerson: values.contactPerson?.trim() || '',
    mobile: values.mobile?.trim() || '',
    email: values.email?.trim() || '',
    address: values.address?.trim() || '',
    invoiceDate: invoiceDate ? invoiceDate.toISOString() : undefined,
    dueDate: dueDate ? dueDate.toISOString() : null,
    salesOrderRef: values.salesOrderRef?.trim() || '',
    quotationRef: values.quotationRef?.trim() || '',
    salesPerson: values.salesPerson,
    currency: values.currency || 'INR',
    paymentTerms: values.paymentTerms?.trim() || '',
    priceList: values.priceList?.trim() || '',
    deliveryDate: deliveryDate ? deliveryDate.toISOString() : null,
    referenceNo: values.referenceNo?.trim() || '',
    remarks: values.remarks?.trim() || '',
    notes: values.notes?.trim() || '',
    extraDiscount: values.extraDiscount ? Number(values.extraDiscount) : 0,
    status,
    items,
  };
}
