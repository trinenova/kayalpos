/**
 * TEMPORARY mock data for the Company master. There's no Company backend
 * module yet, so this static snapshot stands in for
 * `useGetCompanyQuery()`. Replace with real API data once that module
 * exists — do not add more mock data here in the meantime.
 */

export const REGISTERED_ADDRESS = {
  line1: 'Door No. 12/3, Industrial Estate,',
  line2: 'S.F. No. 45/2B, Avinashi Road,',
  line3: 'Coimbatore - 641 037,',
  line4: 'Tamil Nadu, India.',
  landmark: 'Near KV School',
};

export const CONTACT_PERSONS = [
  { id: 'CP-001', name: 'R. Kannan', designation: 'Managing Director', email: 'kannan@sma.com', phone: '+91 94422 33445', primary: true },
];
