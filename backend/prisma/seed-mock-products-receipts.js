// Mock data for Masters > Product and Stock Receipt — EVERY column filled.
// Run (from /backend):  npm run db:seed:mock
// Safe to re-run: MOCK-prefixed masters/products are upserted; mock receipts
// (RCPT-M0001…) and the stock lots they created are rebuilt each time.
// Needs: `npm run db:seed` already run (tenant + outlet), migrations applied.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const day = (n) => new Date(Date.now() + n * 86_400_000);
const r2 = (n) => Math.round(n * 100) / 100;
const SAP = { sapRef: 'SAP-MOCK', sapSyncStatus: 'Synced', sapSyncDate: new Date() };

// ---------------------------------------------------------------- masters
const BRANDS = [
  ['India Gate', 'Grocery'], ['Sunpure', 'Edible Oil'], ['Amul', 'Dairy Products'], ['Aashirvaad', 'Flour'],
  ['Lux', 'Personal Care'], ['Tata Tea', 'Beverages'], ['Parle', 'Snacks'],
];
const TAXES = [
  ['MOCK-GST0', 'GST 0%', 0], ['MOCK-GST5', 'GST 5%', 5], ['MOCK-GST12', 'GST 12%', 12], ['MOCK-GST18', 'GST 18%', 18],
];
const HSN = [
  ['10063010', 'Basmati rice', '10', 5, 'KGS'], ['15121100', 'Sunflower oil, crude', '15', 5, 'LTR'],
  ['04012010', 'Milk (toned)', '04', 0, 'LTR'], ['11010010', 'Wheat flour (atta)', '11', 5, 'KGS'],
  ['17019910', 'Refined sugar', '17', 5, 'KGS'], ['34011110', 'Toilet soap', '34', 18, 'NOS'],
  ['09021010', 'Tea packed', '09', 5, 'KGS'], ['19053100', 'Biscuits', '19', 18, 'KGS'],
  ['22021010', 'Aerated beverages', '22', 28, 'LTR'], ['21069099', 'Namkeen / snacks', '21', 12, 'KGS'],
];
const SUPPLIERS = [
  { code: 'MOCK-SUP01', name: 'Sri Lakshmi Traders', group: 'Wholesale', phone: '9840012345', email: 'sales@srilakshmitraders.in', gstNo: '33AABCS1234F1Z5', city: 'Coimbatore', state: 'Tamil Nadu', paymentTerms: 'Net 30', address: '12, Oppanakara St, Town Hall', country: 'India', remarks: 'Primary grocery supplier' },
  { code: 'MOCK-SUP02', name: 'Bharat Agro Distributors', group: 'Distributor', phone: '9944056789', email: 'orders@bharatagro.in', gstNo: '33AAECB5678K1Z2', city: 'Erode', state: 'Tamil Nadu', paymentTerms: 'Net 15', address: '45, Perundurai Rd', country: 'India', remarks: 'Oil & dairy distributor' },
  { code: 'MOCK-SUP03', name: 'Kovai FMCG Hub', group: 'Stockist', phone: '9786098765', email: 'hub@kovaifmcg.in', gstNo: '33AAFCK9012M1Z8', city: 'Coimbatore', state: 'Tamil Nadu', paymentTerms: 'Advance', address: '8, Avinashi Rd, Peelamedu', country: 'India', remarks: 'Personal care & snacks' },
];
const WAREHOUSES = [
  { code: 'MOCK-WH1', name: 'Main Warehouse', warehouseType: 'Central', location: 'Kurichi', pincode: '641021', landmark: 'Near SIDCO', totalCapacity: 5000, usedCapacity: 1800, inchargeName: 'Murugan S', inchargePhone: '9843011122' },
  { code: 'MOCK-WH2', name: 'Store Front', warehouseType: 'Retail', location: 'RS Puram', pincode: '641002', landmark: 'Opp. Town Hall', totalCapacity: 800, usedCapacity: 350, inchargeName: 'Divya R', inchargePhone: '9843033344' },
];

// ---------------------------------------------------------------- products
// [code, shortId, name, foreign, group, type, subGroup, brand, pack, uom, hsn, tax, taxPct, taxGroup, supplierIdx,
//  cost, sale, mrp, reorder, barcode, shipping, manageBy, method, gst, excisable]
const P = [
  ['MOCK001', 'M-RICE5', 'India Gate Basmati Rice 5kg', 'இந்தியா கேட் பாஸ்மதி அரிசி', 'Grocery', 'Finished Goods', 'Premium', 'India Gate', '5kg', 'PCS', '10063010', 'GST 5%', 5, 'Taxable', 0, 480, 550, 600, 20, '8901000100011', 'Standard', 'Batches', 'On Every Transaction'],
  ['MOCK002', 'M-OIL1', 'Sunpure Sunflower Oil 1 Ltr', 'சன்பியூர் சூரியகாந்தி எண்ணெய்', 'Edible Oil', 'Finished Goods', 'General', 'Sunpure', '1ltr', 'LTR', '15121100', 'GST 5%', 5, 'Taxable', 1, 118, 135, 150, 30, '8901000100028', 'Fragile', 'Batches', 'On Every Transaction'],
  ['MOCK003', 'M-MILK1', 'Amul Toned Milk 1 Ltr', 'அமுல் பால்', 'Dairy Products', 'Finished Goods', 'Economy', 'Amul', '1ltr', 'LTR', '04012010', 'GST 0%', 0, 'Nil Rated', 1, 50, 56, 56, 40, '8901000100035', 'Cold Chain', 'Batches', 'Single in Document'],
  ['MOCK004', 'M-ATTA5', 'Aashirvaad Atta 5kg', 'ஆசிர்வாத் ஆட்டா', 'Flour', 'Finished Goods', 'General', 'Aashirvaad', '5kg', 'PCS', '11010010', 'GST 5%', 5, 'Taxable', 0, 148, 165, 175, 25, '8901000100042', 'Standard', 'Batches', 'On Every Transaction'],
  ['MOCK005', 'M-SUG1', 'Premium Sugar 1kg', 'சர்க்கரை', 'Grocery', 'Finished Goods', 'Economy', 'India Gate', '1kg', 'KG', '17019910', 'GST 5%', 5, 'Taxable', 0, 40, 46, 50, 50, '8901000100059', 'Standard', 'None', 'No Management'],
  ['MOCK006', 'M-SOAP', 'Lux Soap 125g', 'லக்ஸ் சோப்', 'Personal Care', 'Finished Goods', 'General', 'Lux', '125g', 'PCS', '34011110', 'GST 18%', 18, 'Taxable', 2, 30, 38, 45, 60, '8901000100066', 'Standard', 'None', 'No Management'],
  ['MOCK007', 'M-TEA250', 'Tata Tea Premium 250g', 'டாடா டீ', 'Beverages', 'Finished Goods', 'Premium', 'Tata Tea', '250g', 'PCS', '09021010', 'GST 5%', 5, 'Taxable', 2, 95, 112, 125, 25, '8901000100073', 'Standard', 'Batches', 'On Every Transaction'],
  ['MOCK008', 'M-BISC', 'Parle-G Biscuit 200g', 'பார்லே ஜி பிஸ்கட்', 'Snacks', 'Finished Goods', 'Economy', 'Parle', '200g', 'PCS', '19053100', 'GST 18%', 18, 'Taxable', 2, 16, 20, 25, 80, '8901000100080', 'Standard', 'Batches', 'Single in Document'],
  ['MOCK009', 'M-COLA', 'Coca Cola 750ml', 'கோகோ கோலா', 'Beverages', 'Finished Goods', 'General', 'Tata Tea', '750ml', 'PCS', '22021010', 'GST 28%', 28, 'Taxable', 1, 44, 55, 65, 40, '8901000100097', 'Fragile', 'Batches', 'On Every Transaction'],
  ['MOCK010', 'M-NAMK', 'Parle Namkeen Mix 400g', 'நம்கீன் மிக்ஸ்', 'Snacks', 'Finished Goods', 'Combo Pack', 'Parle', '400g', 'PCS', '21069099', 'GST 12%', 12, 'Taxable', 2, 62, 78, 90, 30, '8901000100103', 'Standard', 'Batches', 'On Every Transaction'],
  ['MOCK011', 'M-RICE1', 'India Gate Basmati Rice 1kg', 'இந்தியா கேட் அரிசி 1கிலோ', 'Grocery', 'Finished Goods', 'Premium', 'India Gate', '1kg', 'KG', '10063010', 'GST 5%', 5, 'Taxable', 0, 105, 120, 130, 40, '8901000100110', 'Standard', 'Batches', 'On Every Transaction'],
  ['MOCK012', 'M-OIL5', 'Sunpure Sunflower Oil 5 Ltr', 'சன்பியூர் எண்ணெய் 5லி', 'Edible Oil', 'Finished Goods', 'Combo Pack', 'Sunpure', '5ltr', 'LTR', '15121100', 'GST 5%', 5, 'Taxable', 1, 565, 640, 700, 10, '8901000100127', 'Fragile', 'Batches', 'On Every Transaction'],
  ['MOCK013', 'M-PANEER', 'Amul Fresh Paneer 200g', 'அமுல் பன்னீர்', 'Dairy Products', 'Finished Goods', 'Premium', 'Amul', '200g', 'PCS', '04012010', 'GST 0%', 0, 'Exempt', 1, 68, 80, 85, 20, '8901000100134', 'Cold Chain', 'Batches', 'Single in Document'],
  ['MOCK014', 'M-ATTA10', 'Aashirvaad Atta 10kg', 'ஆசிர்வாத் ஆட்டா 10கிலோ', 'Flour', 'Finished Goods', 'Economy', 'Aashirvaad', '10kg', 'PCS', '11010010', 'GST 5%', 5, 'Taxable', 0, 285, 320, 340, 15, '8901000100141', 'Express', 'Batches', 'On Every Transaction'],
  ['MOCK015', 'M-SOAP4', 'Lux Soap 4 Pack 500g', 'லக்ஸ் சோப் 4', 'Personal Care', 'Finished Goods', 'Combo Pack', 'Lux', '500g', 'BOX', '34011110', 'GST 18%', 18, 'Taxable', 2, 112, 135, 150, 25, '8901000100158', 'Standard', 'None', 'No Management'],
  ['MOCK016', 'M-TEA500', 'Tata Tea Gold 500g', 'டாடா டீ கோல்ட்', 'Beverages', 'Finished Goods', 'Premium', 'Tata Tea', '500g', 'PCS', '09021010', 'GST 5%', 5, 'Taxable', 2, 205, 232, 250, 20, '8901000100165', 'Standard', 'Batches', 'On Every Transaction'],
  ['MOCK017', 'M-BISC5', 'Parle-G Family Pack 800g', 'பார்லே ஜி 800', 'Snacks', 'Finished Goods', 'Combo Pack', 'Parle', '800g', 'PCS', '19053100', 'GST 18%', 18, 'Taxable', 2, 58, 72, 80, 35, '8901000100172', 'Standard', 'Batches', 'Single in Document'],
  ['MOCK018', 'M-COLA2', 'Coca Cola 2 Ltr', 'கோகோ கோலா 2லி', 'Beverages', 'Finished Goods', 'Economy', 'Tata Tea', '2ltr', 'LTR', '22021010', 'GST 28%', 28, 'Taxable', 1, 82, 98, 110, 30, '8901000100189', 'Fragile', 'Batches', 'On Every Transaction'],
  ['MOCK019', 'M-RAWSUG', 'Bulk Sugar Sack 50kg (Raw)', 'மொத்த சர்க்கரை', 'Grocery', 'Raw Material', 'General', 'India Gate', '50kg', 'KG', '17019910', 'GST 5%', 5, 'Taxable', 0, 1900, 2100, 2250, 5, '8901000100196', 'Express', 'Serial Numbers', 'On Every Transaction'],
  ['MOCK020', 'M-SEMI', 'Mixed Spice Blend 1kg (Semi)', 'மசாலா கலவை', 'Grocery', 'Semi-Finished', 'General', 'Parle', '1kg', 'KG', '21069099', 'GST 12%', 12, 'Taxable', 2, 210, 260, 290, 10, '8901000100202', 'Standard', 'Batches', 'Single in Document'],
];

// Receipt lines: [productCode, qty, costMultiplier, discount%, warehouseIdx, expiryDays]
const RECEIPTS = [
  { n: 1, status: 'received', sup: 0, purchaseType: 'Purchase', cc: 'kitchen-operations', ago: 20, lines: [['MOCK001', 60, 1, 2, 0, 365], ['MOCK004', 50, 1, 0, 0, 240], ['MOCK005', 120, 1, 1, 0, 540], ['MOCK011', 80, 1, 0, 0, 365], ['MOCK014', 30, 1, 0, 0, 240], ['MOCK019', 10, 1, 0, 0, 365]] },
  { n: 2, status: 'received', sup: 1, purchaseType: 'Direct Receipt', cc: 'admin-overheads', ago: 14, lines: [['MOCK002', 90, 1, 1, 0, 300], ['MOCK003', 100, 1, 0, 1, 7], ['MOCK009', 72, 1, 0, 1, 180], ['MOCK012', 20, 1, 0, 0, 300], ['MOCK013', 40, 1, 0, 1, 10], ['MOCK018', 48, 1, 0, 1, 180]] },
  { n: 3, status: 'received', sup: 2, purchaseType: 'Consignment', cc: 'housekeeping-ops', ago: 9, lines: [['MOCK006', 150, 1, 3, 1, 720], ['MOCK007', 60, 1, 0, 1, 420], ['MOCK008', 200, 1, 0, 1, 150], ['MOCK010', 70, 1, 0, 1, 120], ['MOCK015', 40, 1, 0, 1, 720], ['MOCK016', 45, 1, 0, 1, 420], ['MOCK017', 90, 1, 0, 1, 150], ['MOCK020', 25, 1, 0, 0, 200]] },
  { n: 4, status: 'received', sup: 0, purchaseType: 'Purchase', cc: 'kitchen-operations', ago: 3, lines: [['MOCK001', 40, 1.04, 0, 0, 365], ['MOCK005', 80, 1.05, 0, 0, 540], ['MOCK004', 30, 1.03, 0, 0, 240], ['MOCK002', 40, 1.05, 0, 0, 300]] },
  { n: 5, status: 'draft', sup: 1, purchaseType: 'Purchase Return Reversal', cc: 'admin-overheads', ago: 1, lines: [['MOCK003', 60, 1, 0, 1, 7], ['MOCK013', 25, 1, 0, 1, 10], ['MOCK009', 48, 1, 0, 1, 180]] },
  { n: 6, status: 'draft', sup: 2, purchaseType: 'Purchase', cc: 'housekeeping-ops', ago: 0, lines: [['MOCK006', 100, 1.02, 2, 1, 720], ['MOCK008', 120, 1.02, 0, 1, 150]] },
];

async function ensure(model, where, data) {
  return (await prisma[model].findFirst({ where })) || prisma[model].create({ data: { ...where, ...data } });
}

async function main() {
  const tenant = (await prisma.tenant.findFirst({ where: { slug: 'kayal-agro-foods' } })) || (await prisma.tenant.findFirst());
  if (!tenant) throw new Error('No tenant — run `npm run db:seed` first.');
  const tenantId = tenant.id;
  const outlet = (await prisma.outlet.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: 'asc' } }));
  if (!outlet) throw new Error('No outlet — create one in Masters > Outlet first.');

  // ---- masters (reuse by name/code when they already exist)
  const grp = await ensure('uomGroup', { tenantId, code: 'MOCK-UG' }, { name: 'Weight & Volume', description: 'Mock UOM group', baseUom: 'PCS', ...SAP });
  for (const [code, name, factor] of [['PCS', 'Pieces', 1], ['KG', 'Kilogram', 1], ['LTR', 'Litre', 1], ['BOX', 'Box', 12]]) {
    await ensure('uom', { tenantId, code }, { name, groupId: grp.id, conversionFactor: factor, status: 'ACTIVE', ...SAP });
  }
  for (const [name, category] of BRANDS) {
    await ensure('brand', { tenantId, name }, { code: `MOCK-BR-${name.replace(/\W/g, '').slice(0, 6).toUpperCase()}`, description: `${name} products`, category, status: 'ACTIVE', ...SAP });
  }
  for (const [code, name, rate] of TAXES) {
    await ensure('taxCode', { tenantId, name }, { code, type: 'GST', category: 'Output', rate, calculationType: 'Percentage', appliesTo: 'Goods', effectiveFrom: day(-365), status: 'ACTIVE', ...SAP });
  }
  for (const [code, description, chapter, taxRate, uqc] of HSN) {
    await ensure('hsnSac', { tenantId, code }, { description, type: 'HSN', chapter, taxRate, uqc, effectiveFrom: day(-365), status: 'ACTIVE', ...SAP });
  }
  const suppliers = [];
  for (const s of SUPPLIERS) suppliers.push(await ensure('supplier', { tenantId, code: s.code }, { ...s, status: 'ACTIVE', ...SAP }));
  const warehouses = [];
  for (const w of WAREHOUSES) {
    warehouses.push(await ensure('warehouse', { tenantId, code: w.code }, {
      ...w, isActive: true, companyName: 'Kayal Agro Foods', outletId: outlet.id, state: 'Tamil Nadu', country: 'India', address: `${w.location}, Coimbatore`, capacityUnit: 'sqft', logoName: 'logo.png', ...SAP,
    }));
  }

  // ---- clean previous mock stock so re-runs don't double-count
  await prisma.productLot.deleteMany({ where: { tenantId, sourceRef: { startsWith: 'RCPT-M' } } });
  await prisma.stockReceipt.deleteMany({ where: { tenantId, code: { startsWith: 'RCPT-M' } } });

  // ---- products (qty starts at 0; received receipts add stock below)
  const priceLists = ['Retail Price List', 'Wholesale Price List'];
  const byCode = new Map();
  for (const [i, p] of P.entries()) {
    const [code, shortId, name, foreignName, group, productType, productSubGroup, brand, packSize, uom, hsnSac, taxCode, , taxGroup, supIdx, cost, sale, mrp, reorderLevel, barcode, shippingType, manageItemBy, manageMethod] = p;
    const data = {
      shortId, name, foreignName, group, productType, productSubGroup, brand, packSize, uom, uomGroup: 'Weight & Volume',
      hsnSac, taxCode, taxGroup, priceList: priceLists[i % 2], preferredVendor: SUPPLIERS[supIdx].name,
      purchasingUom: uom, salesUom: uom, unitPrice: cost, isSalesItem: true, isPurchaseItem: true, isInventoryItem: true,
      barcode, additionalIdentifier: `ADD-${code}`, shippingType, remarks: `Mock ${group.toLowerCase()} item for testing`,
      manageItemBy, manageMethod, isExcisable: taxCode === 'GST 28%', isGst: true,
      salePrice: sale, mrp, availableQty: 0, reorderLevel, status: 'ACTIVE',
      ...SAP, createdBy: 'Admin', updatedBy: 'Admin',
    };
    byCode.set(code, await prisma.product.upsert({
      where: { tenantId_code: { tenantId, code } },
      update: data,
      create: { ...data, code, tenantId },
    }));
  }
  const meta = new Map(P.map((p) => [p[0], { cost: p[15], sale: p[16], mrp: p[17], taxPct: p[12], hsn: p[10], uom: p[9], barcode: p[19], name: p[2] }]));
  const uomKey = { PCS: 'nos', KG: 'kg', LTR: 'ltr', BOX: 'box' };
  const whKey = ['main-warehouse', 'store-front'];

  // ---- stock receipts
  for (const r of RECEIPTS) {
    const sup = suppliers[r.sup];
    const code = `RCPT-M${String(r.n).padStart(4, '0')}`;
    const receiptDate = day(-r.ago);
    let qtySum = 0; let discSum = 0; let taxSum = 0; let valSum = 0;
    const items = r.lines.map(([pc, qty, mult, disc, wh, exp], idx) => {
      const m = meta.get(pc);
      const unitCost = r2(m.cost * mult);
      const base = qty * unitCost;
      const discAmt = (base * disc) / 100;
      const taxAmt = ((base - discAmt) * m.taxPct) / 100;
      const total = r2(base - discAmt + taxAmt);
      qtySum += qty; discSum += discAmt; taxSum += taxAmt; valSum += total;
      return {
        itemCode: pc, itemName: m.name, hsnCode: m.hsn, barcode: m.barcode, uom: uomKey[m.uom],
        orderedQty: qty + 5, receivedQty: qty, unitCost, discount: disc, tax: m.taxPct, totalCost: total,
        warehouse: whKey[wh], batchNo: `B${String(r.n).padStart(2, '0')}${String(idx + 1).padStart(2, '0')}-${receiptDate.getFullYear()}`,
        expiryDate: day(exp - r.ago), remarks: `Checked and counted — ${m.name}`,
        mrp: r2(m.mrp * mult), sellingPrice: r2(m.sale * mult),
      };
    });
    const received = r.status === 'received';
    const receipt = await prisma.stockReceipt.create({
      data: {
        tenantId, code, receiptDate, purchaseType: r.purchaseType,
        purchaseInvoiceNo: `INV-2026-${1000 + r.n}`, purchaseInvoiceDate: day(-r.ago - 1),
        grnDcNo: `GRN-${5000 + r.n}`, grnDcDate: receiptDate,
        receiptRemarks: `Goods received in good condition (${r.purchaseType})`,
        supplierId: sup.id, supplierName: sup.name, fromOutletId: outlet.id, fromOutletName: outlet.name,
        costCenter: r.cc, contactPerson: ['Ravi Kumar', 'Selvam P', 'Anitha M'][r.sup], mobileNo: sup.phone,
        referenceNo: `PO-${7000 + r.n}`, vehicleNo: `TN 66 AB ${1200 + r.n}`, transporter: ['VRL Logistics', 'SRS Transport', 'Gati Express'][r.sup],
        deliveryChallanNo: `DC-${300 + r.n}`, deliveryDate: receiptDate, otherRemarks: 'Unloaded at dock 2',
        notes: received ? 'Stock posted to inventory' : 'Draft — awaiting physical count',
        totalItems: items.length, totalReceivedQty: r2(qtySum), totalDiscount: r2(discSum), totalTax: r2(taxSum), totalEstimatedValue: r2(valSum),
        status: r.status, createdBy: 'Admin', receivedBy: received ? 'Admin' : null, receivedOn: received ? receiptDate : null,
        termsConditions: 'Payment as per agreed terms. Goods subject to quality inspection within 48 hours.',
        ...SAP, updatedBy: 'Admin',
        items: { create: items },
      },
    });

    // stock-in: one FIFO lot per line + product qty (what "received" does in the app)
    if (received) {
      for (const it of items) {
        const product = byCode.get(it.itemCode);
        await prisma.productLot.create({
          data: {
            tenantId, productId: product.id, lotNo: it.batchNo, source: 'RECEIPT', sourceRef: receipt.code, receivedAt: receiptDate,
            mrp: it.mrp, purchasePrice: it.unitCost, sellingPrice: it.sellingPrice, qtyReceived: it.receivedQty, qtyRemaining: it.receivedQty, expiryDate: it.expiryDate,
          },
        });
        await prisma.product.update({ where: { id: product.id }, data: { availableQty: { increment: Math.round(Number(it.receivedQty)) } } });
      }
    }
    console.log(`${code}  ${r.status.padEnd(8)} ${sup.name}  lines ${items.length}  value ${r2(valSum)}`);
  }

  // ---- barcode label batches (Barcode & Label module) — one per product family.
  // These barcodes feed the Stock Receipt "Barcode" dropdown and Line Sale search.
  await prisma.barcodeLabelBatch.deleteMany({ where: { tenantId, code: { startsWith: 'BL-M' } } });
  const LABELS = [
    { n: 1, name: 'Grocery & Flour Shelf Labels', category: 'Grocery', status: 'pending-print', codes: ['MOCK001', 'MOCK004', 'MOCK005', 'MOCK011', 'MOCK014', 'MOCK019'], type: 'barcode', size: '50x25mm' },
    { n: 2, name: 'Beverage & Snack Labels', category: 'Beverages', status: 'pending-print', codes: ['MOCK007', 'MOCK008', 'MOCK009', 'MOCK010', 'MOCK016', 'MOCK017', 'MOCK018'], type: 'barcode', size: '38x25mm' },
    { n: 3, name: 'Dairy, Oil & Care Price Tags', category: 'Dairy Products', status: 'draft', codes: ['MOCK002', 'MOCK003', 'MOCK006', 'MOCK012', 'MOCK013', 'MOCK015', 'MOCK020'], type: 'price-tag', size: '50x25mm' },
  ];
  for (const b of LABELS) {
    const rows = b.codes.map((c, i) => {
      const p = P.find((x) => x[0] === c);
      return {
        itemCode: c, itemName: p[2], hsnCode: p[10], uom: uomKey[p[9]], barcode: p[19],
        printQty: 10 * (i + 1), fromSerialBatch: `B01${String(i + 1).padStart(2, '0')}-2026`, toSerialBatch: `B04${String(i + 1).padStart(2, '0')}-2026`,
      };
    });
    await prisma.barcodeLabelBatch.create({
      data: {
        tenantId, code: `BL-M${String(b.n).padStart(4, '0')}`, labelName: b.name, labelType: b.type, labelSize: b.size,
        printTemplate: 'Standard 3-up', labelsAcross: 3, labelsDown: 8, remarks: `Mock label batch ${b.n}`,
        itemCategory: b.category, item: rows[0].itemName, uom: rows[0].uom, brand: P.find((x) => x[0] === b.codes[0])[7],
        warehouse: 'main-warehouse', batchNo: rows[0].fromSerialBatch, fromItemCode: b.codes[0], toItemCode: b.codes[b.codes.length - 1],
        barcodeType: 'ean-13', additionalFilter: 'In stock only', sortBy: 'item-name', notes: 'Generated for testing',
        totalItems: rows.length, totalLabels: rows.reduce((t, r) => t + r.printQty, 0), status: b.status, createdBy: 'Admin',
        printedOn: null, termsConditions: 'Labels must match the product master barcode.', ...SAP, updatedBy: 'Admin',
        items: { create: rows },
      },
    });
    console.log(`BL-M${String(b.n).padStart(4, '0')}  ${b.name}  items ${rows.length}`);
  }

  // products follow their oldest open lot's prices (same rule the app applies)
  for (const [code, product] of byCode) {
    const head = await prisma.productLot.findFirst({ where: { tenantId, productId: product.id, qtyRemaining: { gt: 0 } }, orderBy: { receivedAt: 'asc' } });
    if (head) await prisma.product.update({ where: { id: product.id }, data: { salePrice: head.sellingPrice, mrp: head.mrp } });
    const fresh = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`${code}  ${fresh.name}  stock ${fresh.availableQty}`);
  }
  console.log('\nDone. Open Masters > Product, Stock Receipt (RCPT-M0001 … M0006) and Barcode & Label (BL-M0001 … M0003).');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
