import {
  mapSheetRows, toIsoDate, isoDay, downloadWorkbook, datedFileName, chunkArray,
} from '../../utils/excel';

/**
 * Excel import / export / template for Stock Receipts.
 *
 * Layout: one row per item line. The receipt header columns repeat on every
 * row; rows sharing the same "Receipt Ref" are grouped into ONE receipt with
 * several items (header values are read from the first row of the group).
 * Export uses the same layout, so an exported file can be edited and
 * re-imported with new Receipt Refs.
 */

// ---------------------------------------------------------------------------
// Single source of truth for the sheet's columns. `hidden: true` = the field is
// not on the Create Stock Receipt screen (commented out there), so it is left
// out of the template, the export AND the import. To bring a column back after
// re-enabling the field on the form, just delete its `hidden: true`.
// ---------------------------------------------------------------------------
const COLUMN_DEFS = [
  { key: 'ref', label: 'Receipt Ref *', scope: 'header' },
  { key: 'receiptDate', label: 'Receipt Date *', scope: 'header' },
  { key: 'purchaseType', label: 'Purchase Type *', scope: 'header' },
  { key: 'supplier', label: 'Supplier *', scope: 'header' },
  { key: 'fromOutlet', label: 'From Outlet / HO *', scope: 'header' },
  { key: 'status', label: 'Status', scope: 'header' },
  { key: 'purchaseInvoiceNo', label: 'Purchase Invoice No', scope: 'header', hidden: true },
  { key: 'purchaseInvoiceDate', label: 'Purchase Invoice Date', scope: 'header', hidden: true },
  { key: 'grnDcNo', label: 'GRN / DC No', scope: 'header', hidden: true },
  { key: 'grnDcDate', label: 'GRN / DC Date', scope: 'header', hidden: true },
  { key: 'costCenter', label: 'Cost Center', scope: 'header', hidden: true },
  { key: 'contactPerson', label: 'Contact Person', scope: 'header', hidden: true },
  { key: 'mobileNo', label: 'Mobile No', scope: 'header' },
  { key: 'referenceNo', label: 'Reference No', scope: 'header' },
  { key: 'vehicleNo', label: 'Vehicle No', scope: 'header' },
  { key: 'transporter', label: 'Transporter', scope: 'header' },
  { key: 'deliveryChallanNo', label: 'Delivery Challan No', scope: 'header' },
  { key: 'deliveryDate', label: 'Delivery Date', scope: 'header' },
  { key: 'receiptRemarks', label: 'Receipt Remarks', scope: 'header' },
  { key: 'otherRemarks', label: 'Other Remarks', scope: 'header' },
  { key: 'notes', label: 'Notes', scope: 'header' },
  { key: 'itemCode', label: 'Item Code *', scope: 'item' },
  { key: 'itemName', label: 'Item Name', scope: 'item' },
  { key: 'barcode', label: 'Barcode', scope: 'item' },
  { key: 'hsnCode', label: 'HSN Code', scope: 'item' },
  { key: 'uom', label: 'UoM', scope: 'item' },
  { key: 'orderedQty', label: 'Ordered Qty', scope: 'item' },
  { key: 'receivedQty', label: 'Received Qty *', scope: 'item' },
  { key: 'mrp', label: 'MRP', scope: 'item' },
  { key: 'unitCost', label: 'Unit Cost', scope: 'item' },
  { key: 'discount', label: 'Discount %', scope: 'item' },
  { key: 'tax', label: 'Tax %', scope: 'item' },
  { key: 'warehouse', label: 'Warehouse', scope: 'item' },
  { key: 'batchNo', label: 'Batch No', scope: 'item' },
  { key: 'expiryDate', label: 'Expiry Date', scope: 'item' },
  { key: 'itemRemarks', label: 'Item Remarks', scope: 'item' },
];

const VISIBLE = COLUMN_DEFS.filter((c) => !c.hidden);
const HIDDEN_KEYS = new Set(COLUMN_DEFS.filter((c) => c.hidden).map((c) => c.key));

export const RECEIPT_COLUMNS = VISIBLE.map((c) => c.label);

const ALL_HEADER_FIELDS = {
  receiptref: 'ref', ref: 'ref', receiptno: 'ref', receiptnumber: 'ref', receiptcode: 'ref',
  receiptdate: 'receiptDate', date: 'receiptDate',
  purchasetype: 'purchaseType',
  supplier: 'supplier', suppliername: 'supplier', suppliercode: 'supplier',
  fromoutlet: 'fromOutlet', fromoutletho: 'fromOutlet', outlet: 'fromOutlet',
  status: 'status',
  purchaseinvoiceno: 'purchaseInvoiceNo', invoiceno: 'purchaseInvoiceNo',
  purchaseinvoicedate: 'purchaseInvoiceDate', invoicedate: 'purchaseInvoiceDate',
  grndcno: 'grnDcNo', grndcdate: 'grnDcDate',
  costcenter: 'costCenter',
  contactperson: 'contactPerson', mobileno: 'mobileNo', mobile: 'mobileNo',
  referenceno: 'referenceNo', vehicleno: 'vehicleNo', transporter: 'transporter',
  deliverychallanno: 'deliveryChallanNo', deliverydate: 'deliveryDate',
  receiptremarks: 'receiptRemarks', remarks: 'receiptRemarks', otherremarks: 'otherRemarks', notes: 'notes',
  itemcode: 'itemCode', itemname: 'itemName', barcode: 'barcode', hsncode: 'hsnCode', hsn: 'hsnCode',
  uom: 'uom', orderedqty: 'orderedQty', receivedqty: 'receivedQty', qty: 'receivedQty', mrp: 'mrp',
  unitcost: 'unitCost', cost: 'unitCost', discount: 'discount', tax: 'tax',
  warehouse: 'warehouse', batchno: 'batchNo', expirydate: 'expiryDate', itemremarks: 'itemRemarks',
};
// Columns of hidden fields that still appear in an older file are ignored.
const HEADER_FIELDS = Object.fromEntries(Object.entries(ALL_HEADER_FIELDS).filter(([, key]) => !HIDDEN_KEYS.has(key)));

const HEADER_KEYS = VISIBLE.filter((c) => c.scope === 'header' && c.key !== 'ref').map((c) => c.key);
const ITEM_KEYS = VISIBLE.filter((c) => c.scope === 'item' && c.key !== 'itemRemarks').map((c) => c.key);
const HAS_ITEM_REMARKS = !HIDDEN_KEYS.has('itemRemarks');
const DATE_KEYS = ['receiptDate', 'purchaseInvoiceDate', 'grnDcDate', 'deliveryDate', 'expiryDate'];

const sheetRow = (values) => VISIBLE.map((c) => values[c.key] ?? '');

const EXAMPLE_ROWS = [
  sheetRow({
    ref: 'REC-A', receiptDate: '13 Nov 2026', purchaseType: 'Purchase', supplier: 'Sri Lakshmi Traders', fromOutlet: 'Head Office',
    status: 'Draft', mobileNo: '9876543210', referenceNo: 'PO-2026-17', vehicleNo: 'TN37AB1234', transporter: 'Fast Logistics',
    deliveryChallanNo: 'DC-88', deliveryDate: '13 Nov 2026', receiptRemarks: 'First delivery', otherRemarks: 'Unload at dock 2', notes: 'Handle with care',
    itemCode: 'PRD001', uom: 'Nos', orderedQty: 100, receivedQty: 100, mrp: 30, unitCost: 25.5, discount: 0, tax: 5,
    warehouse: 'Main Warehouse', batchNo: 'B-001', expiryDate: '31 Dec 2027',
  }),
  sheetRow({
    ref: 'REC-A', itemCode: 'PRD002', barcode: '8901234567890', uom: 'Kg', orderedQty: 50, receivedQty: 48, mrp: 140, unitCost: 120, discount: 2, tax: 5,
    warehouse: 'Cold Storage', batchNo: 'B-002', expiryDate: '30 Jun 2027', itemRemarks: 'Two units damaged',
  }),
];

// [key(s) it documents, row] — rows documenting only hidden fields are dropped.
const INSTRUCTION_ROWS = [
  [null, ['Layout', '', 'One row per item line. Rows with the same Receipt Ref become ONE receipt with several items. Header columns are read from the first row of each Receipt Ref (you may leave them blank on the other rows).']],
  ['ref', ['Receipt Ref *', 'Yes', 'Only a grouping key in the file — the real receipt number (RCPT-#####) is generated on import. A ref equal to an existing receipt number is rejected so you cannot import the same receipt twice.']],
  ['receiptDate', ['Receipt Date *', 'Yes', 'e.g. 13 Nov 2026, 13/11/2026 or an Excel date.']],
  ['purchaseType', ['Purchase Type *', 'Yes', 'Purchase, Purchase Return Reversal, Consignment or Direct Receipt.']],
  ['supplier', ['Supplier *', 'Yes', 'Supplier name or code exactly as in Masters > Supplier.']],
  ['fromOutlet', ['From Outlet / HO *', 'Yes', 'Outlet name or code exactly as in Masters > Outlet.']],
  ['status', ['Status', 'No', 'Draft (default) or Received.']],
  ['costCenter', ['Cost Center', 'No', 'Kitchen Operations, Housekeeping Operations or Admin Overheads.']],
  ['deliveryDate', ['Delivery Date', 'No', 'Same date formats as Receipt Date.']],
  ['itemCode', ['Item Code *', 'Yes', 'Product code or Short ID from Masters > Product. Item Name and HSN Code are filled from the product when left blank.']],
  ['barcode', ['Barcode', 'No', 'Saved with the line and searchable in Line Sale.']],
  ['receivedQty', ['Received Qty *', 'Yes', 'Must be greater than 0.']],
  ['uom', ['UoM', 'No', 'Nos, Kg, Ltr or Box.']],
  ['warehouse', ['Warehouse', 'No', 'Main Warehouse, Store Front or Cold Storage.']],
  ['unitCost', ['Ordered Qty / MRP / Unit Cost / Discount % / Tax %', 'No', 'Numbers. Blank = 0 (MRP blank = the product\'s MRP). Discount and Tax are percentages (0–100). Line totals are calculated automatically.']],
  ['expiryDate', ['Expiry Date', 'No', 'Same date formats as Receipt Date.']],
  [null, ['Errors', '', 'A receipt with any invalid row is skipped and reported with its row number; the other receipts still import.']],
];
const INSTRUCTIONS = [
  ['Column', 'Required', 'Notes'],
  ...INSTRUCTION_ROWS.filter(([key]) => !key || !HIDDEN_KEYS.has(key)).map(([, row]) => row),
];

export function downloadReceiptTemplate() {
  downloadWorkbook('Stock_Receipt_Import_Template.xlsx', [
    { name: 'Stock Receipts', rows: [RECEIPT_COLUMNS, ...EXAMPLE_ROWS] },
    { name: 'Instructions', rows: INSTRUCTIONS },
  ]);
}

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());

/** Sheet rows -> one unit per receipt: { _row, ref, ...header, items:[{ _row, ... }] } */
export function parseReceiptRows(rawRows) {
  const rows = mapSheetRows(rawRows, HEADER_FIELDS);
  if (!rows.length || !rows.some((r) => r.itemCode !== undefined || r.ref !== undefined)) {
    const error = new Error('No recognizable columns found');
    error.userMessage = 'No recognizable columns found. Download the template and keep its column headers (Receipt Ref, Receipt Date, Supplier and Item Code are required).';
    throw error;
  }

  const groups = new Map();
  let anonymous = 0;
  rows.forEach((row) => {
    const ref = text(row.ref);
    // Rows without a ref cannot be grouped: report each as its own receipt.
    const key = ref || `__missing_${anonymous++}`;
    if (!groups.has(key)) groups.set(key, { ref, first: row, rows: [] });
    groups.get(key).rows.push(row);
  });

  return [...groups.values()].map(({ ref, first, rows: groupRows }) => {
    const unit = { _row: first._row, ref, items: [] };
    HEADER_KEYS.forEach((key) => {
      // First non-blank value within the group wins (header repeated or only on row 1).
      const found = groupRows.map((r) => r[key]).find((v) => text(v) !== '');
      unit[key] = DATE_KEYS.includes(key) ? toIsoDate(found) : text(found);
    });
    unit.mobileNo = unit.mobileNo.replace(/\D/g, '').slice(-10) || unit.mobileNo;
    groupRows.forEach((r) => {
      const item = { _row: r._row, remarks: HAS_ITEM_REMARKS ? text(r.itemRemarks) : '' };
      ITEM_KEYS.forEach((key) => {
        item[key] = DATE_KEYS.includes(key) ? toIsoDate(r[key]) : text(r[key]);
      });
      unit.items.push(item);
    });
    return unit;
  });
}

/** Receipts per request — each receipt is validated and saved in its own transaction. */
export const RECEIPT_CHUNK = 25;
export { chunkArray };

const UOM_LABEL = { nos: 'Nos', kg: 'Kg', ltr: 'Ltr', box: 'Box' };
const WAREHOUSE_LABEL = { 'main-warehouse': 'Main Warehouse', 'store-front': 'Store Front', 'cold-storage': 'Cold Storage' };
const COST_CENTER_LABEL = {
  'kitchen-operations': 'Kitchen Operations',
  'housekeeping-ops': 'Housekeeping Operations',
  'admin-overheads': 'Admin Overheads',
};
const STATUS_LABEL = { draft: 'Draft', received: 'Received' };
const n = (v) => (v === null || v === undefined || v === '' ? '' : Number(v));

/** Exports full receipts (with items) in the import layout, one row per item. */
export function exportReceipts(receipts) {
  const body = [];
  receipts.forEach((r) => {
    const header = {
      ref: r.code, receiptDate: isoDay(r.receiptDate), purchaseType: r.purchaseType, supplier: r.supplierName,
      fromOutlet: r.fromOutletName, status: STATUS_LABEL[r.status] || r.status,
      purchaseInvoiceNo: r.purchaseInvoiceNo, purchaseInvoiceDate: isoDay(r.purchaseInvoiceDate), grnDcNo: r.grnDcNo, grnDcDate: isoDay(r.grnDcDate),
      costCenter: COST_CENTER_LABEL[r.costCenter] || r.costCenter, contactPerson: r.contactPerson, mobileNo: r.mobileNo,
      referenceNo: r.referenceNo, vehicleNo: r.vehicleNo, transporter: r.transporter, deliveryChallanNo: r.deliveryChallanNo,
      deliveryDate: isoDay(r.deliveryDate), receiptRemarks: r.receiptRemarks, otherRemarks: r.otherRemarks, notes: r.notes,
    };
    const items = r.items?.length ? r.items : [{}];
    items.forEach((i) => {
      body.push(sheetRow({
        ...header,
        itemCode: i.itemCode, itemName: i.itemName, barcode: i.barcode, hsnCode: i.hsnCode, uom: UOM_LABEL[i.uom] || i.uom,
        orderedQty: n(i.orderedQty), receivedQty: n(i.receivedQty), mrp: n(i.mrp), unitCost: n(i.unitCost), discount: n(i.discount), tax: n(i.tax),
        warehouse: WAREHOUSE_LABEL[i.warehouse] || i.warehouse, batchNo: i.batchNo, expiryDate: isoDay(i.expiryDate), itemRemarks: i.remarks,
      }));
    });
  });
  downloadWorkbook(datedFileName('Stock_Receipts'), [{ name: 'Stock Receipts', rows: [RECEIPT_COLUMNS, ...body] }]);
}
