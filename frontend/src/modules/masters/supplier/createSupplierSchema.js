import { z } from 'zod';
import { Country, State, City } from 'country-state-city';
import {
  SUPPLIER_GROUP_OPTIONS, CITY_OPTIONS, STATE_OPTIONS, STATUS_OPTIONS,
} from './supplierMockData';

export { SUPPLIER_GROUP_OPTIONS, CITY_OPTIONS, STATE_OPTIONS, STATUS_OPTIONS };

// Country / State / City come from the `country-state-city` package. Values
// are stored as plain names (same free-text columns as before), so the ISO
// codes the package needs are looked up from the chosen names on demand.
export const DEFAULT_COUNTRY = 'India';
export const DEFAULT_STATE = 'Tamil Nadu';
export const DEFAULT_CITY = 'Coimbatore';

export const COUNTRY_NAMES = Country.getAllCountries().map((c) => c.name);

const countryByName = (name) => Country.getAllCountries().find((c) => c.name === name);

export function getStateNames(countryName) {
  const country = countryByName(countryName);
  return country ? State.getStatesOfCountry(country.isoCode).map((s) => s.name) : [];
}

export function getCityNames(countryName, stateName) {
  const country = countryByName(countryName);
  if (!country) return [];
  const state = State.getStatesOfCountry(country.isoCode).find((s) => s.name === stateName);
  if (!state) return [];
  return City.getCitiesOfState(country.isoCode, state.isoCode).map((c) => c.name);
}

// FormSelect needs [{value,label}] — these three lists stay plain strings
// (frontend-owned free text, same "list lives in the frontend" convention as
// Product.brand/taxCode) so they're mapped here rather than changing their
// shape everywhere else they're already used (SupplierPage's filter bar
// reads them as plain strings).
export const GROUP_SELECT_OPTIONS = SUPPLIER_GROUP_OPTIONS.map((v) => ({ value: v, label: v }));

// A GSTIN is a fixed 15-character format: 2-digit state code, 10-character
// PAN, 1-digit entity code, the literal 'Z', and a final checksum character.
// Validated only when the field is non-empty — GST No. is optional (many
// small suppliers aren't GST-registered), same "optional, but well-formed
// when present" reasoning as email below.
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

// Client-side validation mirrors the server's createSupplierSchema (see
// backend/src/modules/supplier/supplier.schema.js) field-for-field, same
// convention as every other *FormDialog in this app (Brand/HSN-SAC/Price
// List) — a request that passes this form can't be rejected by the server
// for a reason the user wasn't already shown. Phone/GST No. add stricter
// format checks than the backend enforces (the backend only requires them
// to be non-empty strings when present) since the UI is the right place to
// catch a mistyped number before it's saved, not a reason to loosen what
// the server itself accepts.
export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(150, 'Name cannot exceed 150 characters'),
  group: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  gstNo: z.string().trim().optional(),
  address: z.string().trim().max(500, 'Address cannot exceed 500 characters').optional(),
  country: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  remarks: z.string().trim().max(500, 'Remarks cannot exceed 500 characters').optional(),
  paymentTerms: z.string().trim().max(50, 'Payment terms cannot exceed 50 characters').optional(),
  status: z.string().trim().min(1, 'Select a status'),
}).superRefine((data, ctx) => {
  if (data.phone) {
    const digits = data.phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: 'Enter a valid 10-digit phone number' });
    }
  }
  if (data.gstNo && !GSTIN_PATTERN.test(data.gstNo.toUpperCase())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gstNo'], message: 'Enter a valid 15-character GSTIN' });
  }
});

export const createSupplierDefaultValues = {
  name: '',
  group: SUPPLIER_GROUP_OPTIONS[0],
  phone: '',
  email: '',
  gstNo: '',
  address: '',
  country: DEFAULT_COUNTRY,
  city: DEFAULT_CITY,
  state: DEFAULT_STATE,
  remarks: '',
  paymentTerms: '30 Days',
  status: 'Active',
};

// Maps a Supplier row as returned by the API (status 'ACTIVE'/'INACTIVE')
// to react-hook-form values, for editing an existing row via the dialog.
export function supplierToFormValues(row) {
  if (!row) return createSupplierDefaultValues;
  return {
    name: row.name || '',
    group: row.group || SUPPLIER_GROUP_OPTIONS[0],
    phone: row.phone || '',
    email: row.email || '',
    gstNo: row.gstNo || '',
    address: row.address || '',
    country: row.country || DEFAULT_COUNTRY,
    city: row.city || '',
    state: row.state || '',
    remarks: row.remarks || '',
    paymentTerms: row.paymentTerms || '',
    status: String(row.status).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active',
  };
}

// Converts the form's values into the real POST/PUT /masters/supplier body.
export function supplierFormValuesToPayload(values) {
  return {
    name: values.name.trim(),
    group: values.group || undefined,
    phone: values.phone?.trim() || undefined,
    email: values.email?.trim() || undefined,
    gstNo: values.gstNo?.trim() ? values.gstNo.trim().toUpperCase() : undefined,
    address: values.address?.trim() || undefined,
    country: values.country || undefined,
    city: values.city || undefined,
    state: values.state || undefined,
    remarks: values.remarks?.trim() || undefined,
    paymentTerms: values.paymentTerms?.trim() || undefined,
    status: values.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE',
  };
}
