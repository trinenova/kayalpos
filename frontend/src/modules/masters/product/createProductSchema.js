import { z } from 'zod';
import {
  PRODUCT_GROUP_OPTIONS, PRODUCT_TYPE_OPTIONS, UOM_OPTIONS,
  PRODUCT_SUB_GROUP_OPTIONS, MANAGE_ITEM_BY_OPTIONS, MANAGE_METHOD_OPTIONS, SHIPPING_TYPE_OPTIONS,
  TAX_GROUP_OPTIONS,
} from './productMockData';

export const PRODUCT_GROUP_SELECT_OPTIONS = PRODUCT_GROUP_OPTIONS.map((v) => ({ value: v, label: v }));
export const PRODUCT_TYPE_SELECT_OPTIONS = [
  { value: '', label: 'Select Product Type', disabled: true },
  ...PRODUCT_TYPE_OPTIONS.map((v) => ({ value: v, label: v })),
];
export const UOM_SELECT_OPTIONS = UOM_OPTIONS.map((v) => ({ value: v, label: v }));
export const PRODUCT_SUB_GROUP_SELECT_OPTIONS = [
  { value: '', label: 'Select Product Sub-Group', disabled: true },
  ...PRODUCT_SUB_GROUP_OPTIONS.map((v) => ({ value: v, label: v })),
];
export const MANAGE_ITEM_BY_SELECT_OPTIONS = MANAGE_ITEM_BY_OPTIONS.map((v) => ({ value: v, label: v }));
export const MANAGE_METHOD_SELECT_OPTIONS = [
  { value: '', label: 'Select Manage Method', disabled: true },
  ...MANAGE_METHOD_OPTIONS.map((v) => ({ value: v, label: v })),
];
export const SHIPPING_TYPE_SELECT_OPTIONS = [
  { value: '', label: 'Select Shipping Type', disabled: true },
  ...SHIPPING_TYPE_OPTIONS.map((v) => ({ value: v, label: v })),
];
export const TAX_GROUP_SELECT_OPTIONS = [
  { value: '', label: 'Select Tax Group', disabled: true },
  ...TAX_GROUP_OPTIONS.map((v) => ({ value: v, label: v })),
];

export const BRAND_PLACEHOLDER_OPTION = { value: '', label: 'Select Brand', disabled: true };
export const TAX_CODE_PLACEHOLDER_OPTION = { value: '', label: 'Select Tax Code', disabled: true };
export const UOM_GROUP_PLACEHOLDER_OPTION = { value: '', label: 'Select UoM Group', disabled: true };
export const PRICE_LIST_PLACEHOLDER_OPTION = { value: '', label: 'Select Price List', disabled: true };
export const HSN_PLACEHOLDER_OPTION = { value: '', label: 'Select HSN', disabled: true };
export const SUPPLIER_PLACEHOLDER_OPTION = { value: '', label: 'Select Preferred Vendor', disabled: true };
export const PURCHASING_UOM_PLACEHOLDER_OPTION = { value: '', label: 'Select Purchasing UoM', disabled: true };
export const SALES_UOM_PLACEHOLDER_OPTION = { value: '', label: 'Select Sales UoM', disabled: true };

export const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

// Client-side validation mirrors the server's createProductSchema
// (backend/src/modules/product/product.schema.js) — required fields can't
// be blank and the numeric fields are range-checked before the request ever
// leaves the browser, not just on the server's 400 response. Numeric fields
// are kept as form strings (same convention as Warehouse's capacity fields)
// and converted with Number() in productFormValuesToPayload below.
//
// uomGroup/foreignName/priceList/barcode/productSubGroup/productType/
// shippingType/manageMethod are all optional — their fields are hidden on
// the Create Product screen (see ProductFormDialog) but kept in the schema
// so existing rows that already have them keep round-tripping on Edit.
export const createProductSchema = z.object({
  shortId: z.string().trim().max(20, 'Short ID can be at most 20 characters').optional(),
  name: z.string().trim().min(1, 'Description is required'),
  foreignName: z.string().trim().optional(),
  group: z.string().trim().min(1, 'Select an item group'),
  productType: z.string().trim().optional(),
  productSubGroup: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  packSize: z.string().trim().optional(),
  uom: z.string().trim().min(1, 'Select a UOM'),
  uomGroup: z.string().trim().optional(),
  hsnSac: z.string().trim().optional(),
  taxCode: z.string().trim().optional(),
  taxGroup: z.string().trim().optional(),
  priceList: z.string().trim().optional(),
  preferredVendor: z.string().trim().optional(),
  purchasingUom: z.string().trim().optional(),
  salesUom: z.string().trim().optional(),
  unitPrice: z.string().trim().min(1, 'Unit price is required')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Enter a valid non-negative amount'),
  isSalesItem: z.boolean().optional(),
  isPurchaseItem: z.boolean().optional(),
  isInventoryItem: z.boolean().optional(),
  barcode: z.string().trim().optional(),
  additionalIdentifier: z.string().trim().optional(),
  shippingType: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  manageItemBy: z.string().trim().optional(),
  manageMethod: z.string().trim().optional(),
  isExcisable: z.boolean().optional(),
  isGst: z.boolean().optional(),
  salePrice: z.string().trim().min(1, 'Sale price is required')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Enter a valid non-negative amount'),
  mrp: z.string().trim().min(1, 'MRP is required')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Enter a valid non-negative amount'),
  availableQty: z.string().trim().min(1, 'Available qty is required')
    .refine((v) => /^\d+$/.test(v.trim()), 'Enter a whole, non-negative number'),
  status: z.string().trim().min(1, 'Select a status'),
}).superRefine((values, ctx) => {
  // "Item Category *" on the General tab — at least one of Excisable/GST
  // must be checked.
  if (!values.isExcisable && !values.isGst) {
    ctx.addIssue({ code: 'custom', path: ['isGst'], message: 'Select at least one item category' });
  }
});

export const createProductDefaultValues = {
  shortId: '',
  name: '',
  foreignName: '',
  group: '',
  productType: '',
  productSubGroup: '',
  brand: '',
  packSize: '',
  uom: '',
  uomGroup: '',
  hsnSac: '',
  taxCode: '',
  taxGroup: '',
  priceList: '',
  preferredVendor: '',
  purchasingUom: '',
  salesUom: '',
  unitPrice: '0',
  isSalesItem: true,
  isPurchaseItem: true,
  isInventoryItem: true,
  barcode: '',
  additionalIdentifier: '',
  shippingType: '',
  remarks: '',
  manageItemBy: 'None',
  manageMethod: '',
  isExcisable: false,
  isGst: false,
  salePrice: '',
  mrp: '',
  availableQty: '',
  status: 'Active',
};

// Maps a Product row to react-hook-form values. Accepts either shape ProductFormDialog
// can be opened with: the raw API row (GET /masters/product/:id — status:
// 'ACTIVE'/'INACTIVE', salePrice/mrp: Decimal serialized as string) or
// ProductPage's own view-mapped row (status: 'Active'/'Inactive', numeric
// salePrice/mrp) — see ProductPage.jsx's toViewRow, which is what actually
// gets passed in today since Edit is wired from the already-mapped table
// row. Comparing case-insensitively keeps this correct either way.
export function productToFormValues(product) {
  if (!product) return createProductDefaultValues;
  return {
    shortId: product.shortId || '',
    name: product.name || '',
    foreignName: product.foreignName || '',
    group: product.group || '',
    productType: product.productType || '',
    productSubGroup: product.productSubGroup || '',
    brand: product.brand || '',
    packSize: product.packSize || '',
    uom: product.uom || '',
    uomGroup: product.uomGroup || '',
    hsnSac: product.hsnSac || '',
    taxCode: product.taxCode || '',
    taxGroup: product.taxGroup || '',
    priceList: product.priceList || '',
    preferredVendor: product.preferredVendor || '',
    purchasingUom: product.purchasingUom || '',
    salesUom: product.salesUom || '',
    unitPrice: product.unitPrice != null ? String(product.unitPrice) : '0',
    isSalesItem: product.isSalesItem ?? true,
    isPurchaseItem: product.isPurchaseItem ?? true,
    isInventoryItem: product.isInventoryItem ?? true,
    barcode: product.barcode || '',
    additionalIdentifier: product.additionalIdentifier || '',
    shippingType: product.shippingType || '',
    remarks: product.remarks || '',
    manageItemBy: product.manageItemBy || 'None',
    manageMethod: product.manageMethod || '',
    isExcisable: product.isExcisable ?? false,
    isGst: product.isGst ?? false,
    salePrice: product.salePrice != null ? String(product.salePrice) : '',
    mrp: product.mrp != null ? String(product.mrp) : '',
    availableQty: product.availableQty != null ? String(product.availableQty) : '',
    status: String(product.status).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active',
  };
}

// Converts the form's values into the real POST/PUT /masters/product body.
export function productFormValuesToPayload(values) {
  return {
    // '' (not undefined) on purpose: clearing the field on Edit must reach
    // the API so the stored Short ID is removed (the API stores blank as NULL).
    shortId: values.shortId?.trim() || '',
    name: values.name.trim(),
    foreignName: values.foreignName?.trim() || undefined,
    group: values.group,
    productType: values.productType || undefined,
    productSubGroup: values.productSubGroup || undefined,
    brand: values.brand || undefined,
    packSize: values.packSize?.trim() || undefined,
    uom: values.uom,
    uomGroup: values.uomGroup || undefined,
    hsnSac: values.hsnSac?.trim() || undefined,
    taxCode: values.taxCode?.trim() || undefined,
    taxGroup: values.taxGroup || undefined,
    priceList: values.priceList || undefined,
    preferredVendor: values.preferredVendor || undefined,
    purchasingUom: values.purchasingUom || undefined,
    salesUom: values.salesUom || undefined,
    unitPrice: Number(values.unitPrice),
    isSalesItem: Boolean(values.isSalesItem),
    isPurchaseItem: Boolean(values.isPurchaseItem),
    isInventoryItem: Boolean(values.isInventoryItem),
    barcode: values.barcode?.trim() || undefined,
    additionalIdentifier: values.additionalIdentifier?.trim() || undefined,
    shippingType: values.shippingType || undefined,
    remarks: values.remarks?.trim() || undefined,
    manageItemBy: values.manageItemBy || undefined,
    manageMethod: values.manageMethod || undefined,
    isExcisable: Boolean(values.isExcisable),
    isGst: Boolean(values.isGst),
    salePrice: Number(values.salePrice),
    mrp: Number(values.mrp),
    availableQty: Number(values.availableQty),
    status: values.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE',
  };
}
