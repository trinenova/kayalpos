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

export const RECEIPT_COLUMNS = [
  'Receipt Ref *', 'Receipt Date *', 'Purchase Type *', 'Supplier *', 'From Outlet / HO *', 'Status',
  'Purchase Invoice No', 'Purchase Invoice Date', 'GRN / DC No', 'GRN / DC Date', 'Cost Center',
  'Contact Person', 'Mobile No', 'Reference No', 'Vehicle No', 'Transporter', 'Delivery Challan No', 'Receipt Remarks',
  'Item Code *', 'Item Name', 'Barcode', 'HSN Code', 'UoM', 'Ordered Qty', 'Received Qty *',
  'Unit Cost', 'Discount %', 'Tax %', 'Warehouse', 'Batch No', 'Expiry Date', 'Item Remarks',
];

const HEADER_FIELDS = {
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
  deliverychallanno: 'deliveryChallanNo',
  receiptremarks: 'receiptRemarks', remarks: 'receiptRemarks',
  itemcode: 'itemCode', itemname: 'itemName', barcode: 'barcode', hsncode: 'hsnCode', hsn: 'hsnCode',
  uom: 'uom', orderedqty: 'orderedQty', receivedqty: 'receivedQty', qty: 'receivedQty',
  unitcost: 'unitCost', cost: 'unitCost', discount: 'discount', tax: 'tax',
  warehouse: 'warehouse', batchno: 'batchNo', expirydate: 'expiryDate', itemremarks: 'itemRemarks',
};

const HEADER_KEYS = [
  'receiptDate', 'purchaseType', 'supplier', 'fromOutlet', 'status', 'purchaseInvoiceNo', 'purchaseInvoiceDate',
  'grnDcNo', 'grnDcDate', 'costCenter', 'contactPerson', 'mobileNo', 'referenceNo', 'vehicleNo', 'transporter',
  'deliveryChallanNo', 'receiptRemarks',
];
const ITEM_KEYS = [
  'itemCode', 'itemName', 'barcode', 'hsnCode', 'uom', 'orderedQty', 'receivedQty', 'unitCost', 'discount', 'tax',
  'warehouse', 'batchNo', 'expiryDate',
];
const DATE_KEYS = ['receiptDate', 'purchaseInvoiceDate', 'grnDcDate', 'expiryDate'];

const EXAMPLE_ROWS = [
  ['REC-A', '13 Nov 2026', 'Purchase', 'Sri Lakshmi Traders', 'Head Office', 'Draft', 'INV-1001', '12 Nov 2026', 'GRN-501', '13 Nov 2026',
    '', 'Ravi', '9876543210', 'PO-2026-17', 'TN37AB1234', 'Fast Logistics', 'DC-88', 'First delivery',
    'PRD001', '', '', '', 'Nos', 100, 100, 25.5, 0, 5, 'Main Warehouse', 'B-001', '31 Dec 2027', ''],
  ['REC-A', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'PRD002', '', '', '', 'Kg', 50, 48, 120, 2, 5, 'Cold Storage', 'B-002', '30 Jun 2027', 'Two units damaged'],
];

const INSTRUCTIONS = [
  ['Column', 'Required', 'Notes'],
  ['Layout', '', 'One row per item line. Rows with the same Receipt Ref become ONE receipt with several items. Header columns are read from the first row of each Receipt Ref (you may leave them blank on the other rows).'],
  ['Receipt Ref *', 'Yes', 'Only a grouping key in the file — the real receipt number (RCPT-#####) is generated on import. A ref equal to an existing receipt number is rejected so you cannot import the same receipt twice.'],
  ['Receipt Date *', 'Yes', 'e.g. 13 Nov 2026, 13/11/2026 or an Excel date.'],
  ['Purchase Type *', 'Yes', 'Purchase, Purchase Return Reversal, Consignment or Direct Receipt.'],
  ['Supplier *', 'Yes', 'Supplier name or code exactly as in Masters > Supplier.'],
  ['From Outlet / HO *', 'Yes', 'Outlet name or code exactly as in Masters > Outlet.'],
  ['Status', 'No', 'Draft (default) or Received.'],
  ['Cost Center', 'No', 'Kitchen Operations, Housekeeping Operations or Admin Overheads.'],
  ['Item Code *', 'Yes', 'Product code or Short ID from Masters > Product. Item Name and HSN Code are filled from the product when left blank.'],
  ['Received Qty *', 'Yes', 'Must be greater than 0.'],
  ['UoM', 'No', 'Nos, Kg, Ltr or Box.'],
  ['Warehouse', 'No', 'Main Warehouse, Store Front or Cold Storage.'],
  ['Ordered Qty / Unit Cost / Discount % / Tax %', 'No', 'Numbers. Blank = 0. Discount and Tax are percentages (0–100). Line totals are calculated automatically.'],
  ['Expiry Date', 'No', 'Same date formats as Receipt Date.'],
  ['Errors', '', 'A receipt with any invalid row is skipped and reported with its row number; the other receipts still import.'],
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
      const item = { _row: r._row, remarks: text(r.itemRemarks) };
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
    const header = [
      r.code, isoDay(r.receiptDate), r.purchaseType, r.supplierName, r.fromOutletName, STATUS_LABEL[r.status] || r.status,
      r.purchaseInvoiceNo, isoDay(r.purchaseInvoiceDate), r.grnDcNo, isoDay(r.grnDcDate),
      COST_CENTER_LABEL[r.costCenter] || r.costCenter, r.contactPerson, r.mobileNo, r.referenceNo, r.vehicleNo,
      r.transporter, r.deliveryChallanNo, r.receiptRemarks,
    ];
    const items = r.items?.length ? r.items : [{}];
    items.forEach((i) => {
      body.push([
        ...header,
        i.itemCode, i.itemName, i.barcode, i.hsnCode, UOM_LABEL[i.uom] || i.uom, n(i.orderedQty), n(i.receivedQty),
        n(i.unitCost), n(i.discount), n(i.tax), WAREHOUSE_LABEL[i.warehouse] || i.warehouse, i.batchNo,
        isoDay(i.expiryDate), i.remarks,
      ]);
    });
  });
  downloadWorkbook(datedFileName('Stock_Receipts'), [{ name: 'Stock Receipts', rows: [RECEIPT_COLUMNS, ...body] }]);
}
