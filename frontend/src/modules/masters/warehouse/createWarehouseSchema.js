import { z } from 'zod';

export const WAREHOUSE_TYPE_OPTIONS = [
  { value: '', label: 'Select Warehouse Type', disabled: true },
  { value: 'General Warehouse', label: 'General Warehouse' },
  { value: 'Cold Storage', label: 'Cold Storage' },
  { value: 'Bonded Warehouse', label: 'Bonded Warehouse' },
  { value: 'Distribution Center', label: 'Distribution Center' },
];

export const LOCATION_OPTIONS = [
  { value: '', label: 'Select Location', disabled: true },
  { value: 'Coimbatore', label: 'Coimbatore' },
  { value: 'Chennai', label: 'Chennai' },
  { value: 'Madurai', label: 'Madurai' },
  { value: 'Salem', label: 'Salem' },
];

export const COMPANY_OPTIONS = [
  { value: '', label: 'Select Company', disabled: true },
  { value: 'Sri Maruthamalai Andavar', label: 'Sri Maruthamalai Andavar' },
];

export const STATE_OPTIONS = [
  { value: '', label: 'Select State', disabled: true },
  { value: 'Tamil Nadu', label: 'Tamil Nadu' },
  { value: 'Karnataka', label: 'Karnataka' },
  { value: 'Kerala', label: 'Kerala' },
  { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
  { value: 'Maharashtra', label: 'Maharashtra' },
];

export const COUNTRY_OPTIONS = [
  { value: '', label: 'Select Country', disabled: true },
  { value: 'India', label: 'India' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates' },
  { value: 'Singapore', label: 'Singapore' },
];

export const STATUS_OPTIONS = [
  { value: '', label: 'Select Status', disabled: true },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

export const CAPACITY_UNIT_OPTIONS = [
  { value: 'SQFT', label: 'SQFT' },
  { value: 'SQM', label: 'SQM' },
  { value: 'CBM', label: 'CBM' },
];

// "Select Outlet" placeholder shared with the real, API-backed outlet list
// built at runtime in WarehousePage.jsx (via useGetOutletsQuery) — unlike
// the other dropdowns above, Outlet is a real relation (Warehouse.outletId
// in schema.prisma), so its options can't be a static list here.
export const OUTLET_PLACEHOLDER_OPTION = { value: '', label: 'Select Outlet', disabled: true };

// Client-side validation mirrors the server's createWarehouseSchema
// (backend/src/modules/warehouse/warehouse.schema.js) — required fields
// can't be blank, so a bad entry is caught before the request ever leaves
// the browser, not just on the server's 400 response.
export const createWarehouseSchema = z.object({
  warehouseCode: z.string().trim().min(1, 'Warehouse code is required'),
  warehouseName: z.string().trim().min(1, 'Warehouse name is required'),
  company: z.string().trim().optional(),
  outlet: z.string().trim().min(1, 'Select an outlet'),
  address: z.string().trim().min(1, 'Address is required'),
  landmark: z.string().trim().optional(),

  warehouseType: z.string().trim().min(1, 'Select a warehouse type'),
  location: z.string().trim().optional(),
  state: z.string().trim().min(1, 'Select a state'),
  country: z.string().trim().min(1, 'Select a country'),
  pincode: z.string().trim().min(1, 'Pincode is required'),
  status: z.string().trim().min(1, 'Select a status'),

  totalCapacity: z.string().trim().min(1, 'Total capacity is required')
    .refine((v) => !Number.isNaN(Number(v)), 'Enter a valid number'),
  usedCapacity: z.string().trim().optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), 'Enter a valid number'),
  capacityUnit: z.string().trim().min(1, 'Select a unit'),

  inchargeName: z.string().trim().optional(),
  inchargePhone: z.string().trim().optional(),
});

// Blank defaults for the "New Warehouse" form — the Code field shows a live
// server-generated preview instead (see warehouseApi.js's
// useNextWarehouseCode), same convention as Outlet/Brand's Add forms.
export const createWarehouseDefaultValues = {
  warehouseCode: '',
  warehouseName: '',
  company: '',
  outlet: '',
  address: '',
  landmark: '',

  warehouseType: '',
  location: '',
  state: '',
  country: 'India',
  pincode: '',
  status: 'Active',

  totalCapacity: '',
  usedCapacity: '',
  capacityUnit: 'SQFT',

  inchargeName: '',
  inchargePhone: '',
};

// Maps a real Warehouse row (GET /warehouses/:id — see warehouse.routes.js's
// detailInclude for the `contacts` and `outlet` it also carries) to
// react-hook-form values. `status` is a form-only string derived from the
// real `isActive` boolean, converted back on save. Decimal fields
// (totalCapacity/usedCapacity) come back from Prisma as numeric strings —
// kept as plain strings here too, matching WarehouseCapacityCard's own
// parseFloat-on-read handling.
export function warehouseToFormValues(warehouse) {
  if (!warehouse) return createWarehouseDefaultValues;
  return {
    warehouseCode: warehouse.code || '',
    warehouseName: warehouse.name || '',
    company: warehouse.companyName || '',
    outlet: warehouse.outletId || warehouse.outlet?.id || '',
    address: warehouse.address || '',
    landmark: warehouse.landmark || '',

    warehouseType: warehouse.warehouseType || '',
    location: warehouse.location || '',
    state: warehouse.state || '',
    country: warehouse.country || '',
    pincode: warehouse.pincode || '',
    status: warehouse.isActive === false ? 'Inactive' : 'Active',

    totalCapacity: warehouse.totalCapacity != null ? String(warehouse.totalCapacity) : '',
    usedCapacity: warehouse.usedCapacity != null ? String(warehouse.usedCapacity) : '',
    capacityUnit: warehouse.capacityUnit || 'SQFT',

    inchargeName: warehouse.inchargeName || '',
    inchargePhone: warehouse.inchargePhone || '',
  };
}

// Converts the form's values into the real POST/PUT /warehouses body —
// `warehouseCode`/`warehouseName`/`company`/`outlet` map back onto the
// Prisma column names (`code`/`name`/`companyName`/`outletId`), `status`
// becomes `isActive`, blank optional fields become undefined, and
// `logoName` (tracked outside react-hook-form, see WarehousePage's own
// `logoName` state) is folded in here right before the request — same
// pattern as Outlet's own outletFormValuesToPayload.
export function warehouseFormValuesToPayload(values, logoName) {
  return {
    code: values.warehouseCode.trim(),
    name: values.warehouseName.trim(),
    companyName: values.company?.trim() || undefined,
    outletId: values.outlet || undefined,
    address: values.address?.trim() || undefined,
    landmark: values.landmark?.trim() || undefined,

    warehouseType: values.warehouseType || undefined,
    location: values.location || undefined,
    state: values.state || undefined,
    country: values.country || undefined,
    pincode: values.pincode?.trim() || undefined,
    isActive: values.status !== 'Inactive',

    totalCapacity: values.totalCapacity?.trim() || undefined,
    usedCapacity: values.usedCapacity?.trim() || undefined,
    capacityUnit: values.capacityUnit || undefined,

    inchargeName: values.inchargeName?.trim() || undefined,
    inchargePhone: values.inchargePhone?.trim() || undefined,

    logoName: logoName?.trim() || undefined,
  };
}
