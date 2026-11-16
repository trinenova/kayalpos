/**
 * DEPRECATED — no longer used.
 * -------------------------------------------------------------------------
 * The login screen's "Select Outlet" dropdown now reads from the real
 * Outlet API (see api/outletApi.js's useGetPublicOutletsQuery, wired in
 * LoginPage.jsx). This file is kept only so the diff is easy to review; it
 * is safe to delete this file.
 */
export const MOCK_OUTLETS = [
  { value: 'main-outlet', label: 'Sri Maruthamalai Andavar - Main Outlet' },
  { value: 'head-office', label: 'Sri Maruthamalai Andavar - Head Office' },
  { value: 'saravanampatti', label: 'Sri Maruthamalai Andavar - Saravanampatti' },
  { value: 'peelamedu', label: 'Sri Maruthamalai Andavar - Peelamedu' },
  { value: 'singanallur', label: 'Sri Maruthamalai Andavar - Singanallur' },
];
