import {
  mapSheetRows, downloadWorkbook, datedFileName,
} from '../../../utils/excel';
import { SUPPLIER_GROUP_OPTIONS } from './supplierMockData';

/**
 * Excel import / export / template for the Supplier master. The export uses
 * exactly the import columns, so an exported file can be edited and imported
 * back (rows carrying a Supplier Code update that supplier).
 */

export const SUPPLIER_COLUMNS = [
  'Supplier Code', 'Supplier Name *', 'Supplier Group', 'Phone', 'Email', 'GST No.', 'Address',
  'Country', 'State', 'City', 'Payment Terms', 'Remarks', 'Status',
];

const HEADER_MAP = {
  suppliercode: 'code',
  code: 'code',
  suppliername: 'name',
  name: 'name',
  suppliergroup: 'group',
  group: 'group',
  phone: 'phone',
  mobile: 'phone',
  email: 'email',
  gstno: 'gstNo',
  gst: 'gstNo',
  gstin: 'gstNo',
  address: 'address',
  country: 'country',
  state: 'state',
  city: 'city',
  paymentterms: 'paymentTerms',
  remarks: 'remarks',
  status: 'status',
};

const EXAMPLE_ROW = [
  '', 'Sri Lakshmi Traders', 'General Suppliers', '9876543210', 'sales@srilakshmi.example', '33ABCDE1234F1Z5',
  '12, Market Road, RS Puram', 'India', 'Tamil Nadu', 'Coimbatore', '30 Days', 'Preferred vendor for dry goods', 'Active',
];

const INSTRUCTIONS = [
  ['Column', 'Required', 'Notes'],
  ['Supplier Code', 'No', 'Leave blank to create a new supplier (code is generated). If it matches an existing supplier, that supplier is updated.'],
  ['Supplier Name *', 'Yes', 'Up to 150 characters. A blank Supplier Code is matched to an existing supplier by GST No., then by exact name — a match is updated instead of duplicated.'],
  ['Supplier Group', 'No', `For example: ${SUPPLIER_GROUP_OPTIONS.slice(0, 4).join(', ')}`],
  ['Phone', 'No', '10 digits.'],
  ['Email', 'No', 'A valid email address.'],
  ['GST No.', 'No', '15-character GSTIN, e.g. 33ABCDE1234F1Z5.'],
  ['Address', 'No', 'Up to 500 characters.'],
  ['Country / State / City', 'No', 'Names as shown in the Add Supplier form (Country defaults to India).'],
  ['Payment Terms', 'No', 'e.g. 30 Days (up to 50 characters).'],
  ['Remarks', 'No', 'Up to 500 characters.'],
  ['Status', 'No', 'Active or Inactive (defaults to Active).'],
  ['Blank cells', '', 'On an existing supplier, a blank cell leaves the current value unchanged.'],
];

export function downloadSupplierTemplate() {
  downloadWorkbook('Supplier_Import_Template.xlsx', [
    { name: 'Suppliers', rows: [SUPPLIER_COLUMNS, EXAMPLE_ROW] },
    { name: 'Instructions', rows: INSTRUCTIONS },
  ]);
}

/** Sheet rows -> the objects POSTed to /masters/supplier/import. */
export function parseSupplierRows(rawRows) {
  const rows = mapSheetRows(rawRows, HEADER_MAP);
  if (!rows.length) {
    const error = new Error('No recognizable columns found');
    error.userMessage = 'No recognizable columns found. Download the template and keep its column headers (Supplier Name is required).';
    throw error;
  }
  return rows.map((row) => {
    const next = { ...row };
    ['code', 'name', 'group', 'phone', 'email', 'gstNo', 'address', 'country', 'state', 'city', 'paymentTerms', 'remarks']
      .forEach((field) => { if (next[field] !== undefined) next[field] = String(next[field]).trim(); });
    if (next.gstNo) next.gstNo = next.gstNo.toUpperCase();
    if (next.phone) next.phone = next.phone.replace(/\D/g, '').slice(-10);
    if (next.status !== undefined) next.status = String(next.status).trim().toLowerCase() === 'inactive' ? 'INACTIVE' : 'ACTIVE';
    return next;
  });
}

/** Exports the given (already filtered) supplier view rows. */
export function exportSuppliers(rows) {
  downloadWorkbook(datedFileName('Suppliers'), [{
    name: 'Suppliers',
    rows: [
      SUPPLIER_COLUMNS,
      ...rows.map((r) => [
        r.code, r.name, r.group, r.phone, r.email, r.gstNo, r.address, r.country || 'India',
        r.state, r.city, r.paymentTerms, r.remarks, r.status,
      ]),
    ],
  }]);
}
