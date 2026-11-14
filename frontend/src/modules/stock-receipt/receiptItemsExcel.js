import { mapSheetRows, toIsoDate, downloadWorkbook } from '../../utils/excel';

/**
 * Excel import / template for the line-items grid of ONE Stock Receipt (the
 * "Import Excel" / "Download Template" buttons above the Items table).
 * One row per item. Header-level fields (supplier, dates...) are not part of
 * this file — use the Stock Receipt list's Import for whole receipts.
 */

export const ITEM_COLUMNS = [
  'Item Code *', 'Item Name', 'Barcode', 'HSN Code', 'UoM', 'Ordered Qty', 'Received Qty *',
  'MRP', 'Unit Cost', 'Discount %', 'Tax %', 'Warehouse', 'Batch No', 'Expiry Date', 'Remarks',
];

const HEADER_FIELDS = {
  itemcode: 'itemCode', code: 'itemCode', shortid: 'itemCode',
  itemname: 'itemName', name: 'itemName',
  barcode: 'barcode',
  hsncode: 'hsnCode', hsn: 'hsnCode',
  uom: 'uom',
  orderedqty: 'orderedQty',
  receivedqty: 'receivedQty', qty: 'receivedQty', quantity: 'receivedQty',
  mrp: 'mrp',
  unitcost: 'unitCost', cost: 'unitCost', rate: 'unitCost',
  discount: 'discount', tax: 'tax',
  warehouse: 'warehouse',
  batchno: 'batchNo', batch: 'batchNo',
  expirydate: 'expiryDate', expiry: 'expiryDate',
  remarks: 'remarks', itemremarks: 'remarks',
};

const EXAMPLE_ROWS = [
  ['PRD001', '', '', '', 'Nos', 100, 100, 30, 25.5, 0, 5, 'Main Warehouse', 'B-001', '31 Dec 2027', ''],
  ['PRD002', '', '8901234567890', '', 'Kg', 50, 48, 140, 120, 2, 5, 'Cold Storage', 'B-002', '30 Jun 2027', 'Two units damaged'],
];

const INSTRUCTIONS = [
  ['Column', 'Required', 'Notes'],
  ['Item Code *', 'Yes', 'Product code or Short ID from Masters > Product. If it is blank, a Barcode that belongs to a product is used instead.'],
  ['Item Name / HSN Code', 'No', 'Filled from the product when left blank.'],
  ['Received Qty *', 'Yes', 'Must be greater than 0.'],
  ['UoM', 'No', 'Nos, Kg, Ltr or Box (taken from the product when blank).'],
  ['Warehouse', 'No', 'Main Warehouse, Store Front or Cold Storage.'],
  ['Ordered Qty / MRP / Unit Cost / Discount % / Tax %', 'No', 'Numbers. Blank = 0 (Ordered Qty defaults to Received Qty; MRP blank = the product\'s MRP).'],
  ['Expiry Date', 'No', 'e.g. 31 Dec 2027, 31/12/2027 or an Excel date.'],
  ['Barcode', 'No', 'Saved with the line and searchable in Line Sale.'],
];

export function downloadReceiptItemsTemplate() {
  downloadWorkbook('Stock_Receipt_Items_Template.xlsx', [
    { name: 'Items', rows: [ITEM_COLUMNS, ...EXAMPLE_ROWS] },
    { name: 'Instructions', rows: INSTRUCTIONS },
  ]);
}

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const UOM_VALUES = { nos: 'nos', kg: 'kg', ltr: 'ltr', box: 'box' };
const WAREHOUSE_VALUES = {
  'main warehouse': 'main-warehouse', 'store front': 'store-front', 'cold storage': 'cold-storage',
  'main-warehouse': 'main-warehouse', 'store-front': 'store-front', 'cold-storage': 'cold-storage',
};
const isNum = (v) => v === '' || (/^\d+(\.\d+)?$/.test(v) && Number(v) >= 0);
const money = (v) => (v === '' ? '0.00' : Number(v).toFixed(2));

/**
 * Sheet rows -> { rows, errors }. `rows` are form-ready item rows (strings, in
 * the shape of emptyItemRow()); `errors` are [{ row, message }] for sheet rows
 * that were skipped. `findProduct(code, barcode)` resolves a catalogue product.
 */
export function parseReceiptItemRows(rawRows, { findProduct, formatDate, emptyItemRow }) {
  const mapped = mapSheetRows(rawRows, HEADER_FIELDS);
  if (!mapped.length || !mapped.some((r) => r.itemCode !== undefined || r.barcode !== undefined)) {
    const error = new Error('No recognizable columns found');
    error.userMessage = 'No recognizable columns found. Download the template and keep its column headers (Item Code and Received Qty are required).';
    throw error;
  }

  const rows = [];
  const errors = [];
  mapped.forEach((r) => {
    const code = text(r.itemCode);
    const barcode = text(r.barcode);
    const product = findProduct(code, barcode);
    if (!product) {
      errors.push({ row: r._row, message: code || barcode ? `Item "${code || barcode}" was not found in Masters > Product` : 'Item Code is required' });
      return;
    }
    const received = text(r.receivedQty);
    if (!received || !isNum(received) || Number(received) <= 0) {
      errors.push({ row: r._row, message: `${product.code}: Received Qty must be greater than 0` });
      return;
    }
    const ordered = text(r.orderedQty);
    const mrp = text(r.mrp);
    const unitCost = text(r.unitCost);
    const discount = text(r.discount);
    const tax = text(r.tax);
    if (![ordered, mrp, unitCost, discount, tax].every(isNum)) {
      errors.push({ row: r._row, message: `${product.code}: Ordered Qty, MRP, Unit Cost, Discount and Tax must be numbers` });
      return;
    }
    if (Number(discount || 0) > 100 || Number(tax || 0) > 100) {
      errors.push({ row: r._row, message: `${product.code}: Discount and Tax must be between 0 and 100` });
      return;
    }
    let expiry = '';
    if (text(r.expiryDate)) {
      const iso = toIsoDate(r.expiryDate);
      const d = /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? new Date(`${iso}T00:00:00`) : null;
      if (!d || Number.isNaN(d.getTime())) {
        errors.push({ row: r._row, message: `${product.code}: Expiry Date "${text(r.expiryDate)}" is not a valid date` });
        return;
      }
      expiry = formatDate(d);
    }
    const uomKey = text(r.uom).toLowerCase();
    const whKey = text(r.warehouse).toLowerCase();
    rows.push({
      ...emptyItemRow(),
      itemCode: product.code,
      itemName: text(r.itemName) || product.name || '',
      hsnCode: text(r.hsnCode) || product.hsnSac || '',
      barcode,
      uom: UOM_VALUES[uomKey] || UOM_VALUES[String(product.uom || '').toLowerCase()] || '',
      orderedQty: ordered === '' ? Number(received).toFixed(2) : Number(ordered).toFixed(2),
      receivedQty: Number(received).toFixed(2),
      mrp: mrp === '' ? '' : money(mrp),
      unitCost: money(unitCost),
      discount: money(discount),
      tax: money(tax),
      warehouse: WAREHOUSE_VALUES[whKey] || '',
      batchNo: text(r.batchNo),
      expiryDate: expiry,
      remarks: text(r.remarks),
    });
  });
  return { rows, errors };
}
