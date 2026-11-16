import { z } from 'zod';

export const OUTLET_TYPE_OPTIONS = [
  { value: '', label: 'Select Outlet Type', disabled: true },
  { value: 'Retail Outlet', label: 'Retail Outlet' },
  { value: 'Warehouse Outlet', label: 'Warehouse Outlet' },
  { value: 'Franchise Outlet', label: 'Franchise Outlet' },
  { value: 'Online Outlet', label: 'Online Outlet' },
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

export const CITY_OPTIONS = [
  { value: '', label: 'Select City', disabled: true },
  { value: 'Coimbatore', label: 'Coimbatore' },
  { value: 'Chennai', label: 'Chennai' },
  { value: 'Madurai', label: 'Madurai' },
  { value: 'Salem', label: 'Salem' },
];

export const STATUS_OPTIONS = [
  { value: '', label: 'Select Status', disabled: true },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

// Client-side validation mirrors the server's createOutletSchema
// (backend/src/modules/outlet/outlet.schema.js) — required fields can't be
// blank, so a bad entry is caught before the request ever leaves the
// browser, not just on the server's 400 response.
export const createOutletSchema = z.object({
  outletCode: z.string().trim().min(1, 'Outlet code is required'),
  outletName: z.string().trim().min(1, 'Outlet name is required'),
  registrationNo: z.string().trim().optional(),
  gstin: z.string().trim().min(1, 'GSTIN is required'),
  panNo: z.string().trim().optional(),
  email: z.string().trim().optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email'),
  website: z.string().trim().optional(),

  outletType: z.string().trim().min(1, 'Select an outlet type'),
  company: z.string().trim().min(1, 'Select a company'),
  state: z.string().trim().min(1, 'Select a state'),
  city: z.string().trim().min(1, 'Select a city'),
  phone: z.string().trim().min(1, 'Phone is required'),
  mobile: z.string().trim().min(1, 'Mobile is required'),
  status: z.string().trim().min(1, 'Select a status'),

  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  addressLine3: z.string().trim().optional(),
  addressLine4: z.string().trim().optional(),
  addressLandmark: z.string().trim().optional(),
});

// Blank defaults for the "New Outlet" form — the Code field shows a live
// server-generated preview instead (see outletApi.js's useNextOutletCode),
// same convention as Brand's Add dialog.
export const createOutletDefaultValues = {
  outletCode: '',
  outletName: '',
  registrationNo: '',
  gstin: '',
  panNo: '',
  email: '',
  website: '',

  outletType: '',
  company: '',
  state: '',
  city: '',
  phone: '',
  mobile: '',
  status: 'Active',

  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  addressLine4: '',
  addressLandmark: '',
};

// Maps a real Outlet row (GET /outlets/:id — see outlet.routes.js's
// detailInclude for the `contacts` it also carries) to react-hook-form
// values. `status` is a form-only string derived from the real `isActive`
// boolean, converted back on save.
export function outletToFormValues(outlet) {
  if (!outlet) return createOutletDefaultValues;
  return {
    outletCode: outlet.code || '',
    outletName: outlet.name || '',
    registrationNo: outlet.registrationNo || '',
    gstin: outlet.gstin || '',
    panNo: outlet.panNo || '',
    email: outlet.email || '',
    website: outlet.website || '',

    outletType: outlet.outletType || '',
    company: outlet.companyName || '',
    state: outlet.state || '',
    city: outlet.city || '',
    phone: outlet.phone || '',
    mobile: outlet.mobile || '',
    status: outlet.isActive === false ? 'Inactive' : 'Active',

    addressLine1: outlet.addressLine1 || '',
    addressLine2: outlet.addressLine2 || '',
    addressLine3: outlet.addressLine3 || '',
    addressLine4: outlet.addressLine4 || '',
    addressLandmark: outlet.addressLandmark || '',
  };
}

// Converts the form's values into the real POST/PUT /outlets body —
// `outletCode`/`outletName`/`company` map back onto the Prisma column
// names (`code`/`name`/`companyName`), `status` becomes `isActive`, blank
// optional fields become undefined, and `logoName` (tracked outside
// react-hook-form, see OutletPage's own `logoName` state) is folded in
// here right before the request, same pattern as Company's own
// `companyFormValuesToPayload`.
export function outletFormValuesToPayload(values, logoName) {
  return {
    code: values.outletCode.trim(),
    name: values.outletName.trim(),
    registrationNo: values.registrationNo?.trim() || undefined,
    gstin: values.gstin.trim(),
    panNo: values.panNo?.trim() || undefined,
    email: values.email?.trim() || undefined,
    website: values.website?.trim() || undefined,

    outletType: values.outletType || undefined,
    companyName: values.company || undefined,
    state: values.state || undefined,
    city: values.city || undefined,
    phone: values.phone.trim(),
    mobile: values.mobile.trim(),
    isActive: values.status !== 'Inactive',

    logoName: logoName?.trim() || undefined,

    addressLine1: values.addressLine1?.trim() || undefined,
    addressLine2: values.addressLine2?.trim() || undefined,
    addressLine3: values.addressLine3?.trim() || undefined,
    addressLine4: values.addressLine4?.trim() || undefined,
    addressLandmark: values.addressLandmark?.trim() || undefined,
  };
}
