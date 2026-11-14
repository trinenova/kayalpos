/**
 * Shared mappers between the real Stock Receipt API shape (Decimal fields
 * serialized as strings, dates as ISO strings, `status` a plain stored
 * column — see backend/src/modules/stock-receipt) and the shapes
 * StockReceiptTable / StockReceiptDetailsCard / StockReceiptSummaryCards
 * already expect. Every figure here comes straight from a real StockReceipt
 * row — a tenant with no receipts yet honestly shows zeros/empty lists,
 * never a placeholder number.
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

const STATUS_LABEL = { draft: 'Draft', received: 'Received' };

export function statusLabel(status) {
  return STATUS_LABEL[status] || status;
}

/** Row shape for StockReceiptTable. */
export function toReceiptRow(row) {
  return {
    id: row.id,
    code: row.code,
    date: formatDate(row.receiptDate),
    supplier: row.supplierName,
    purchaseType: row.purchaseType,
    invoiceNo: row.purchaseInvoiceNo || '-',
    items: row.totalItems,
    totalValue: num(row.totalEstimatedValue),
    status: row.status,
  };
}

/** Full detail shape for StockReceiptDetailsCard / ReceiptViewPage. */
export function toReceiptDetails(row) {
  return {
    id: row.id,
    code: row.code,
    date: formatDate(row.receiptDate),
    status: row.status,
    supplier: row.supplierName,
    purchaseType: row.purchaseType,
    fromOutlet: row.fromOutletName,
    contactPerson: row.contactPerson || '-',
    mobileNo: row.mobileNo || '-',
    invoiceNo: row.purchaseInvoiceNo || '-',
    invoiceDate: row.purchaseInvoiceDate ? formatDate(row.purchaseInvoiceDate) : '-',
    grnDcNo: row.grnDcNo || '-',
    vehicleNo: row.vehicleNo || '-',
    transporter: row.transporter || '-',
    costCenter: row.costCenter || '-',
    referenceNo: row.referenceNo || '-',
    items: row.totalItems,
    totalValue: num(row.totalEstimatedValue),
    createdBy: row.createdBy,
    receivedBy: row.receivedBy || '-',
    receivedOn: row.receivedOn ? formatDate(row.receivedOn) : '-',
    remarks: row.receiptRemarks || row.otherRemarks || '-',
    notes: row.notes || '',
    lineItems: (row.items || []).map((item) => ({
      code: item.itemCode,
      name: item.itemName,
      hsn: item.hsnCode || '-',
      barcode: item.barcode || '-',
      uom: item.uom || '-',
      orderedQty: num(item.orderedQty),
      receivedQty: num(item.receivedQty),
      mrp: item.mrp != null ? num(item.mrp) : null,
      unitCost: num(item.unitCost),
      discount: num(item.discount),
      tax: num(item.tax),
      totalCost: num(item.totalCost),
    })),
  };
}

/** 5-tile "Stock Receipt" summary strip — "This Month" captions reflect the
 * real current-calendar-month window getStockReceiptSummary() computes for
 * receivedThisMonth/valueReceived; the other three are honestly "All Time"
 * since they aggregate every receipt ever created. */
export function buildSummary(summary) {
  return {
    totalReceipts: { value: summary?.totalReceipts || 0, caption: 'All Time' },
    draftReceipts: { value: summary?.draftReceipts || 0, caption: 'Not Yet Received' },
    receivedReceipts: { value: summary?.receivedReceipts || 0, caption: 'Completed' },
    receivedThisMonth: { value: summary?.receivedThisMonth || 0, caption: 'This Month' },
    valueReceived: { value: summary?.valueReceived || 0, caption: 'This Month' },
  };
}

function itemToFormRow(item) {
  return {
    itemCode: item.itemCode || '',
    itemName: item.itemName || '',
    hsnCode: item.hsnCode || '',
    barcode: item.barcode || '',
    uom: item.uom || '',
    orderedQty: item.orderedQty !== null && item.orderedQty !== undefined ? String(item.orderedQty) : '',
    receivedQty: item.receivedQty !== null && item.receivedQty !== undefined ? String(item.receivedQty) : '',
    mrp: item.mrp !== null && item.mrp !== undefined ? String(item.mrp) : '',
    unitCost: item.unitCost !== null && item.unitCost !== undefined ? String(item.unitCost) : '0.00',
    discount: item.discount !== null && item.discount !== undefined ? String(item.discount) : '0.00',
    tax: item.tax !== null && item.tax !== undefined ? String(item.tax) : '0.00',
    warehouse: item.warehouse || '',
    batchNo: item.batchNo || '',
    expiryDate: item.expiryDate ? formatPickerDate(new Date(item.expiryDate)) : '',
    remarks: item.remarks || '',
  };
}

/** Converts a real API receipt row into the Create/Edit form's default
 * values — used only in edit mode (see CreateStockReceiptPage). */
export function receiptToFormValues(row, emptyItemRow) {
  return {
    receiptDate: formatPickerDate(new Date(row.receiptDate)),
    purchaseType: row.purchaseType || '',
    purchaseInvoiceNo: row.purchaseInvoiceNo || '',
    purchaseInvoiceDate: row.purchaseInvoiceDate ? formatPickerDate(new Date(row.purchaseInvoiceDate)) : '',
    grnDcNo: row.grnDcNo || '',
    grnDcDate: row.grnDcDate ? formatPickerDate(new Date(row.grnDcDate)) : '',
    receiptRemarks: row.receiptRemarks || '',

    supplier: row.supplierId || '',
    fromOutlet: row.fromOutletId || '',
    costCenter: row.costCenter || '',
    contactPerson: row.contactPerson || '',
    mobileNo: row.mobileNo || '',

    referenceNo: row.referenceNo || '',
    vehicleNo: row.vehicleNo || '',
    transporter: row.transporter || '',
    deliveryChallanNo: row.deliveryChallanNo || '',
    deliveryDate: row.deliveryDate ? formatPickerDate(new Date(row.deliveryDate)) : '',
    otherRemarks: row.otherRemarks || '',

    notes: row.notes || '',
    items: row.items?.length ? row.items.map(itemToFormRow) : [emptyItemRow()],
  };
}

/** Converts the form's string-based values into the JSON payload the
 * backend's createStockReceiptSchema/updateStockReceiptSchema expect —
 * only rows with a non-blank Item Code are sent, same "filled row"
 * convention Stock Indent/Stock Transfer use. */
export function formValuesToPayload(values, { status, isBlankItemRow }) {
  const receiptDate = parsePickerDate(values.receiptDate);
  const purchaseInvoiceDate = values.purchaseInvoiceDate ? parsePickerDate(values.purchaseInvoiceDate) : null;
  const grnDcDate = values.grnDcDate ? parsePickerDate(values.grnDcDate) : null;
  const deliveryDate = values.deliveryDate ? parsePickerDate(values.deliveryDate) : null;

  const items = values.items
    .filter((row) => !isBlankItemRow(row))
    .map((row) => {
      const expiryDate = row.expiryDate ? parsePickerDate(row.expiryDate) : null;
      return {
        itemCode: row.itemCode.trim(),
        itemName: row.itemName.trim(),
        hsnCode: row.hsnCode?.trim() || '',
        barcode: row.barcode?.trim() || '',
        uom: row.uom?.trim() || '',
        orderedQty: row.orderedQty ? Number(row.orderedQty) : 0,
        receivedQty: Number(row.receivedQty),
        mrp: row.mrp ? Number(row.mrp) : null,
        unitCost: row.unitCost ? Number(row.unitCost) : 0,
        discount: row.discount ? Number(row.discount) : 0,
        tax: row.tax ? Number(row.tax) : 0,
        warehouse: row.warehouse?.trim() || '',
        batchNo: row.batchNo?.trim() || '',
        expiryDate: expiryDate ? expiryDate.toISOString() : null,
        remarks: row.remarks?.trim() || '',
      };
    });

  return {
    receiptDate: receiptDate ? receiptDate.toISOString() : undefined,
    purchaseType: values.purchaseType,
    purchaseInvoiceNo: values.purchaseInvoiceNo?.trim() || '',
    purchaseInvoiceDate: purchaseInvoiceDate ? purchaseInvoiceDate.toISOString() : null,
    grnDcNo: values.grnDcNo?.trim() || '',
    grnDcDate: grnDcDate ? grnDcDate.toISOString() : null,
    receiptRemarks: values.receiptRemarks?.trim() || '',

    supplierId: values.supplier,
    fromOutletId: values.fromOutlet,
    costCenter: values.costCenter?.trim() || '',
    contactPerson: values.contactPerson?.trim() || '',
    mobileNo: values.mobileNo?.trim() || '',

    referenceNo: values.referenceNo?.trim() || '',
    vehicleNo: values.vehicleNo?.trim() || '',
    transporter: values.transporter?.trim() || '',
    deliveryChallanNo: values.deliveryChallanNo?.trim() || '',
    deliveryDate: deliveryDate ? deliveryDate.toISOString() : null,
    otherRemarks: values.otherRemarks?.trim() || '',

    notes: values.notes?.trim() || '',
    status,
    items,
  };
}
