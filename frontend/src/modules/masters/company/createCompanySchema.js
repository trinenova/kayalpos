import { z } from 'zod';

import { formatPickerDate, parsePickerDate } from '../../../components/form/FormDatePicker';

export const COMPANY_TYPE_OPTIONS = [
  { value: '', label: 'Select Company Type', disabled: true },
  { value: 'Private Limited', label: 'Private Limited' },
  { value: 'Public Limited', label: 'Public Limited' },
  { value: 'Partnership', label: 'Partnership' },
  { value: 'Proprietorship', label: 'Proprietorship' },
  { value: 'LLP', label: 'LLP' },
];

export const COUNTRY_OPTIONS = [
  { value: '', label: 'Select Country', disabled: true },
  { value: 'India', label: 'India' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates' },
  { value: 'Singapore', label: 'Singapore' },
];

export const STATE_OPTIONS = [
  { value: '', label: 'Select State' },
  { value: 'Tamil Nadu', label: 'Tamil Nadu' },
  { value: 'Karnataka', label: 'Karnataka' },
  { value: 'Kerala', label: 'Kerala' },
  { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
  { value: 'Maharashtra', label: 'Maharashtra' },
];

export const CURRENCY_OPTIONS = [
  { value: '', label: 'Select Currency', disabled: true },
  { value: 'INR - Indian Rupee', label: 'INR - Indian Rupee' },
  { value: 'USD - US Dollar', label: 'USD - US Dollar' },
  { value: 'AED - UAE Dirham', label: 'AED - UAE Dirham' },
];

const COMPANY_TYPE_VALUES = COMPANY_TYPE_OPTIONS.filter((o) => o.value).map((o) => o.value);
const COUNTRY_VALUES = COUNTRY_OPTIONS.filter((o) => o.value).map((o) => o.value);
const STATE_VALUES = STATE_OPTIONS.filter((o) => o.value).map((o) => o.value);
const CURRENCY_VALUES = CURRENCY_OPTIONS.filter((o) => o.value).map((o) => o.value);

// Client-side validation mirrors the server's companyProfileSchema
// (backend/src/modules/company/company.schema.js) — required fields can't
// be blank and every dropdown must be one of the real options, so a bad
// entry is caught before the request ever leaves the browser, not just on
// the server's 400 response.
export const createCompanySchema = z.object({
  companyCode: z.string().trim().min(1, 'Company code is required'),
  companyName: z.string().trim().min(1, 'Company name is required'),
  displayName: z.string().trim().optional(),
  registrationNo: z.string().trim().optional(),
  gstin: z.string().trim().min(1, 'GSTIN is required'),
  panNo: z.string().trim().optional(),
  fssaiNo: z.string().trim().optional(),
  email: z.string().trim().optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email'),
  website: z.string().trim().optional(),

  companyType: z.string().trim().optional()
    .refine((v) => !v || COMPANY_TYPE_VALUES.includes(v), 'Select a valid company type'),
  // "DD Mon YYYY" — the format FormDatePicker actually reads/writes (see
  // formatPickerDate/parsePickerDate), same convention Expense's
  // expenseDate default follows; this used to default to the unparseable
  // "01-April" string, which the picker's own parser couldn't read back.
  financialYearStart: z.string().trim().min(1, 'Financial year start is required')
    .refine((v) => Boolean(parsePickerDate(v)), 'Enter a valid date'),
  country: z.string().trim().refine((v) => COUNTRY_VALUES.includes(v), 'Select a country'),
  // Optional: blank is allowed; if a state is chosen it must be one of the options.
  state: z.string().trim().refine((v) => v === '' || STATE_VALUES.includes(v), 'Select a valid state'),
  currency: z.string().trim().refine((v) => CURRENCY_VALUES.includes(v), 'Select a currency'),
  phone: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  fax: z.string().trim().optional(),

  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  addressLine3: z.string().trim().optional(),
  addressLine4: z.string().trim().optional(),
  addressLandmark: z.string().trim().optional(),
});

// Blank defaults — used until the real profile loads, and for a tenant
// that has never saved one (GET /company then returns `data: null`), so
// the form always has every field react-hook-form expects instead of
// `undefined`.
export const createCompanyDefaultValues = {
  companyCode: '',
  companyName: '',
  displayName: '',
  registrationNo: '',
  gstin: '',
  panNo: '',
  fssaiNo: '',
  email: '',
  website: '',

  companyType: '',
  financialYearStart: formatPickerDate(new Date(new Date().getFullYear(), 3, 1)),
  country: '',
  state: '',
  currency: '',
  phone: '',
  mobile: '',
  fax: '',

  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  addressLine4: '',
  addressLandmark: '',
};

// Maps the real GET /company row (see company.service.js's
// getCompanyProfile) to react-hook-form values — every field falls back to
// '' rather than null/undefined, since MUI TextFields need a defined value.
export function companyProfileToFormValues(profile) {
  if (!profile) return createCompanyDefaultValues;
  return {
    companyCode: profile.companyCode || '',
    companyName: profile.companyName || '',
    displayName: profile.displayName || '',
    registrationNo: profile.registrationNo || '',
    gstin: profile.gstin || '',
    panNo: profile.panNo || '',
    fssaiNo: profile.fssaiNo || '',
    email: profile.email || '',
    website: profile.website || '',

    companyType: profile.companyType || '',
    financialYearStart: profile.financialYearStart || createCompanyDefaultValues.financialYearStart,
    country: profile.country || '',
    state: profile.state || '',
    currency: profile.currency || '',
    phone: profile.phone || '',
    mobile: profile.mobile || '',
    fax: profile.fax || '',

    addressLine1: profile.addressLine1 || '',
    addressLine2: profile.addressLine2 || '',
    addressLine3: profile.addressLine3 || '',
    addressLine4: profile.addressLine4 || '',
    addressLandmark: profile.addressLandmark || '',
  };
}

// Converts the form's values into the real PUT /company body — blank
// optional fields become undefined rather than empty strings, and
// `logoName` (tracked outside react-hook-form, see CompanyPage's own
// `logoName` state) is folded in here right before the request, same
// "just the file name, no real upload backend" pattern as Expense's
// `attachmentName`.
export function companyFormValuesToPayload(values, logoName, logoData) {
  return {
    companyCode: values.companyCode.trim(),
    companyName: values.companyName.trim(),
    displayName: values.displayName?.trim() || undefined,
    registrationNo: values.registrationNo?.trim() || undefined,
    gstin: values.gstin.trim(),
    panNo: values.panNo?.trim() || undefined,
    fssaiNo: values.fssaiNo?.trim() || undefined,
    email: values.email?.trim() || undefined,
    website: values.website?.trim() || undefined,

    companyType: values.companyType || undefined,
    financialYearStart: values.financialYearStart.trim(),
    country: values.country,
    state: values.state,
    currency: values.currency,
    phone: values.phone?.trim() || undefined,
    mobile: values.mobile?.trim() || undefined,
    fax: values.fax?.trim() || undefined,

    logoName: logoName?.trim() || undefined,
    // null (not undefined) so removing the logo actually clears it on the server.
    logoData: logoData || null,

    addressLine1: values.addressLine1?.trim() || undefined,
    addressLine2: values.addressLine2?.trim() || undefined,
    addressLine3: values.addressLine3?.trim() || undefined,
    addressLine4: values.addressLine4?.trim() || undefined,
    addressLandmark: values.addressLandmark?.trim() || undefined,
  };
}
