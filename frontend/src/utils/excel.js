import * as XLSX from 'xlsx';

/**
 * Small SheetJS helpers shared by every Excel import / export / template
 * feature (Supplier, Stock Receipt, ...).
 */

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n) => String(n).padStart(2, '0');
export const normalizeHeader = (header) => String(header ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Reads the first sheet of an .xlsx/.xls/.csv File into an array of {header: value} rows. */
export async function readFirstSheet(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
}

/**
 * Maps spreadsheet headers to field names via `headerMap` (keys are
 * normalizeHeader()-style: lowercase letters/digits only, so "Supplier Name *"
 * and "supplier_name" both match "suppliername"). Blank cells are dropped.
 * `_row` is the row's number in the sheet (header = row 1), used in error
 * messages. Rows with no recognised, non-blank cell are skipped.
 */
export function mapSheetRows(rawRows, headerMap) {
  const out = [];
  rawRows.forEach((raw, index) => {
    const row = { _row: index + 2 };
    let hasData = false;
    Object.entries(raw).forEach(([header, value]) => {
      const field = headerMap[normalizeHeader(header)];
      if (!field) return;
      const cleaned = typeof value === 'string' ? value.trim() : value;
      if (cleaned === '' || cleaned === null || cleaned === undefined) return;
      row[field] = cleaned;
      hasData = true;
    });
    if (hasData) out.push(row);
  });
  return out;
}

/**
 * Cell value -> 'YYYY-MM-DD'. Handles Excel date serial numbers and the usual
 * typed formats (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, "13 Nov 2026"). Anything
 * unrecognised is returned unchanged so the server can report it.
 */
export function toIsoDate(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') {
    const parts = XLSX.SSF.parse_date_code(value);
    return parts ? `${parts.y}-${pad(parts.m)}-${pad(parts.d)}` : value;
  }
  const text = String(value).trim();
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = text.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ ,-]*(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
  return text;
}

/** ISO string -> 'YYYY-MM-DD' ('' when empty). */
export const isoDay = (value) => (value ? String(value).slice(0, 10) : '');

/**
 * Writes an .xlsx file. `sheets` is [{ name, rows }] where rows is an array of
 * arrays (first row = headers). Column widths follow the longest header/value.
 */
export function downloadWorkbook(fileName, sheets) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const widths = [];
    rows.forEach((r) => r.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] || 10, Math.min(String(cell ?? '').length + 2, 40));
    }));
    sheet['!cols'] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  });
  XLSX.writeFile(workbook, fileName);
}

export const datedFileName = (base) => `${base}_${new Date().toISOString().slice(0, 10)}.xlsx`;

export function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
