import { z } from 'zod';

// Kept loose on companyType/country/state/currency (non-empty string,
// not a hard enum) unlike Expense's category/paymentMode — those option
// lists live in the frontend's createCompanySchema.js and can grow without
// a matching backend redeploy; the required-field checks below are the
// real guard against bad data.
export const companyProfileSchema = z.object({
  companyCode: z.string().trim().min(1, 'Company code is required'),
  companyName: z.string().trim().min(1, 'Company name is required'),
  displayName: z.string().trim().optional(),
  registrationNo: z.string().trim().optional(),
  gstin: z.string().trim().min(1, 'GSTIN is required'),
  panNo: z.string().trim().optional(),
  fssaiNo: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  website: z.string().trim().optional(),
  companyType: z.string().trim().optional(),
  financialYearStart: z.string().trim().min(1, 'Financial year start is required'),
  country: z.string().trim().min(1, 'Country is required'),
  state: z.string().trim().min(1, 'State is required'),
  currency: z.string().trim().min(1, 'Currency is required'),
  phone: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  fax: z.string().trim().optional(),
  logoName: z.string().trim().optional(),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  addressLine3: z.string().trim().optional(),
  addressLine4: z.string().trim().optional(),
  addressLandmark: z.string().trim().optional(),
});

export const companyContactSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required'),
  designation: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  isPrimary: z.coerce.boolean().default(false),
});

export const updateCompanyContactSchema = companyContactSchema.partial();
