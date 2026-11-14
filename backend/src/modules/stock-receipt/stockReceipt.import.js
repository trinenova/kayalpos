import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { createStockReceiptSchema } from './stockReceipt.schema.js';
import { createStockReceipt } from './stockReceipt.service.js';

export const importReceiptsSchema = z.object({
  receipts: z.array(z.record(z.any())).min(1, 'No receipts to import').max(100, 'Import at most 100 receipts per request'),
});

const PURCHASE_TYPES = ['Purchase', 'Purchase Return Reversal', 'Consignment', 'Direct Receipt'];

const lower = (v) => String(v ?? '').trim().toLowerCase();

// The form stores dropdown *values* (e.g. 'nos', 'main-warehouse'), while the
// sheet carries the human labels — map label (or value) back to the value.
const UOMS = { nos: 'nos', kg: 'kg', ltr: 'ltr', box: 'box' };
const WAREHOUSES = { 'main warehouse': 'main-warehouse', 'store front': 'store-front', 'cold storage': 'cold-storage' };
const COST_CENTERS = {
  'kitchen operations': 'kitchen-operations',
  'housekeeping operations': 'housekeeping-ops',
  'admin overheads': 'admin-overheads',
};
const mapOption = (table, raw) => {
  const key = lower(raw);
  if (!key) return '';
  return table[key] || (Object.values(table).includes(key) ? key : String(raw).trim());
};
const dateOrNull = (v) => (v ? v : null);

const FIELD_LABELS = {
  receiptDate: 'Receipt Date',
  purchaseType: 'Purchase Type',
  purchaseInvoiceDate: 'Purchase Invoice Date',
  grnDcDate: 'GRN / DC Date',
  deliveryDate: 'Delivery Date',
  mrp: 'MRP',
  itemCode: 'Item Code',
  itemName: 'Item Name',
  orderedQty: 'Ordered Qty',
  receivedQty: 'Received Qty',
  unitCost: 'Unit Cost',
  discount: 'Discount %',
  tax: 'Tax %',
  expiryDate: 'Expiry Date',
};

/** zod issues -> readable lines; item-level issues are prefixed with the sheet row of that item. */
function describeIssues(error, items) {
  return error.issues.map((issue) => {
    const [first, index, field] = issue.path;
    if (first === 'items' && typeof index === 'number') {
      const row = items[index]?._row;
      return `Row ${row ?? index + 2}: ${FIELD_LABELS[field] || field} — ${issue.message}`;
    }
    return `${FIELD_LABELS[first] || first}: ${issue.message}`;
  });
}

/**
 * Excel import for Stock Receipts. The client sends one unit per receipt:
 * header fields plus its `items` (the sheet's rows sharing a Receipt Ref).
 *
 * Supplier and From Outlet / HO are matched by code or name; Item Code by
 * product code or Short ID (name / HSN are filled from the Product master when
 * blank). Each receipt then goes through the same validation and the same
 * createStockReceipt() the form uses, so totals are computed server-side and
 * RCPT-##### numbers are generated normally. The Receipt Ref in the sheet is
 * only a grouping key — except that a ref equal to an existing receipt number
 * is rejected, so re-importing an export can't create duplicates.
 *
 * Each receipt is independent: a bad one is reported (sheet row + reasons) and
 * the rest still import.
 */
export async function importStockReceipts(tenantId, receipts, actor) {
  const [suppliers, outlets, products] = await Promise.all([
    prisma.supplier.findMany({ where: { tenantId }, select: { id: true, code: true, name: true } }),
    prisma.outlet.findMany({ where: { tenantId }, select: { id: true, code: true, name: true } }),
    prisma.product.findMany({
      where: { tenantId }, select: { code: true, shortId: true, name: true, hsnSac: true },
    }),
  ]);

  const byCodeOrName = (list) => {
    const map = new Map();
    list.forEach((r) => { map.set(lower(r.name), r); });
    list.forEach((r) => { if (r.code) map.set(lower(r.code), r); }); // code wins over a same-text name
    return map;
  };
  const supplierMap = byCodeOrName(suppliers);
  const outletMap = byCodeOrName(outlets);
  const productMap = new Map();
  products.forEach((p) => { if (p.shortId) productMap.set(lower(p.shortId), p); });
  products.forEach((p) => productMap.set(lower(p.code), p));

  const summary = {
    total: receipts.length, created: 0, updated: 0, failed: 0, errors: [],
  };

  for (const unit of receipts) {
    const items = Array.isArray(unit.items) ? unit.items : [];
    const ref = unit.ref ? String(unit.ref) : '';
    const problems = [];

    if (!ref) problems.push('Receipt Ref is required');
    if (ref && await prisma.stockReceipt.findFirst({ where: { tenantId, code: ref }, select: { id: true } })) {
      problems.push(`Receipt ${ref} already exists — use a new Receipt Ref to import it as a new receipt`);
    }

    const supplier = supplierMap.get(lower(unit.supplier));
    if (!unit.supplier) problems.push('Supplier is required');
    else if (!supplier) problems.push(`Supplier "${unit.supplier}" not found in Masters > Supplier`);

    const outlet = outletMap.get(lower(unit.fromOutlet));
    if (!unit.fromOutlet) problems.push('From Outlet / HO is required');
    else if (!outlet) problems.push(`Outlet "${unit.fromOutlet}" not found in Masters > Outlet`);

    if (!unit.receiptDate) problems.push('Receipt Date is required');
    if (!unit.purchaseType) problems.push('Purchase Type is required');
    else if (!PURCHASE_TYPES.map(lower).includes(lower(unit.purchaseType))) {
      problems.push(`Purchase Type "${unit.purchaseType}" is not valid (use ${PURCHASE_TYPES.join(', ')})`);
    }

    const status = lower(unit.status) === 'received' ? 'received' : 'draft';

    const builtItems = items.map((item) => {
      const product = item.itemCode ? productMap.get(lower(item.itemCode)) : null;
      if (!item.itemCode) problems.push(`Row ${item._row}: Item Code is required`);
      else if (!product) problems.push(`Row ${item._row}: Item "${item.itemCode}" not found in Masters > Product`);
      return {
        itemCode: product?.code ?? String(item.itemCode ?? ''),
        itemName: item.itemName || product?.name || '',
        hsnCode: item.hsnCode ?? product?.hsnSac ?? '',
        barcode: item.barcode ?? '',
        uom: mapOption(UOMS, item.uom),
        orderedQty: item.orderedQty === '' ? undefined : item.orderedQty,
        receivedQty: item.receivedQty,
        mrp: item.mrp === '' || item.mrp === undefined ? undefined : item.mrp,
        unitCost: item.unitCost === '' ? undefined : item.unitCost,
        discount: item.discount === '' ? undefined : item.discount,
        tax: item.tax === '' ? undefined : item.tax,
        warehouse: mapOption(WAREHOUSES, item.warehouse),
        batchNo: item.batchNo ?? '',
        expiryDate: dateOrNull(item.expiryDate),
        remarks: item.remarks ?? '',
      };
    });
    if (!items.length) problems.push('No item rows');

    let payload = null;
    if (!problems.length) {
      const parsed = createStockReceiptSchema.safeParse({
        receiptDate: unit.receiptDate,
        purchaseType: PURCHASE_TYPES.find((t) => lower(t) === lower(unit.purchaseType)),
        purchaseInvoiceNo: unit.purchaseInvoiceNo ?? '',
        purchaseInvoiceDate: dateOrNull(unit.purchaseInvoiceDate),
        grnDcNo: unit.grnDcNo ?? '',
        grnDcDate: dateOrNull(unit.grnDcDate),
        receiptRemarks: unit.receiptRemarks ?? '',
        supplierId: supplier.id,
        fromOutletId: outlet.id,
        costCenter: mapOption(COST_CENTERS, unit.costCenter),
        contactPerson: unit.contactPerson ?? '',
        mobileNo: unit.mobileNo === undefined ? '' : String(unit.mobileNo),
        referenceNo: unit.referenceNo ?? '',
        vehicleNo: unit.vehicleNo ?? '',
        transporter: unit.transporter ?? '',
        deliveryChallanNo: unit.deliveryChallanNo ?? '',
        deliveryDate: dateOrNull(unit.deliveryDate),
        otherRemarks: unit.otherRemarks ?? '',
        notes: unit.notes ?? '',
        status,
        items: builtItems,
      });
      if (parsed.success) payload = parsed.data;
      else problems.push(...describeIssues(parsed.error, items));
    }

    if (!payload) {
      summary.failed += 1;
      summary.errors.push({ row: unit._row, ref, message: problems.join(' | ') });
      continue; // eslint-disable-line no-continue
    }

    try {
      await createStockReceipt(tenantId, payload, actor);
      summary.created += 1;
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({ row: unit._row, ref, message: err?.message || 'Failed to save receipt' });
    }
  }
  return summary;
}
