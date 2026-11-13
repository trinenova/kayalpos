import { useEffect, useMemo, useState } from 'react';
import {
  Paper, Box, Autocomplete, TextField, Button, InputAdornment, Typography, CircularProgress,
} from '@mui/material';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';

import { useGetCustomersPageQuery } from '../../../api/customerApi';
import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../../features/auth/authSlice';
import { WALK_IN_CUSTOMER } from '../lineSaleMockData';
import { getRecentCustomers, addRecentCustomer } from '../recentCustomers';
import useDebouncedValue from '../../../hooks/useDebouncedValue';

// Reserved code for the tenant's dedicated Walk-in Customer row (see
// backend/src/modules/customer/customer.service.js) — it's a real Customer
// record now (so sales can reference it), but it should never show up as a
// *search result* here; Walk-in is always offered separately, pinned at the
// top of the list.
const WALKIN_CODE = 'WALKIN';
const MIN_SEARCH_CHARS = 2;

function toOption(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.mobile ?? row.phone,
    loyaltyPoints: row.loyaltyPoints || 0,
  };
}

/**
 * Customer bar above the Current Sale / Bill Summary panels: the customer
 * search, a read-only mobile-number display for whichever customer is
 * selected, and "Add Customer". (Item scan/search now lives in the Current
 * Sale table itself — see ItemSearchRow.)
 */
export default function CustomerSearchBar({ customer, onSelectCustomer, onAddCustomer }) {
  // ---- Customer search (server-side) --------------------------------
  const user = useAppSelector(selectCurrentUser);
  const [customerInput, setCustomerInput] = useState('');
  const debouncedCustomerQuery = useDebouncedValue(customerInput.trim(), 300);
  const searchActive = debouncedCustomerQuery.length >= MIN_SEARCH_CHARS;

  const {
    data: customerPage, isFetching: isSearchingCustomers, isError: customerSearchFailed,
  } = useGetCustomersPageQuery(
    { search: debouncedCustomerQuery, page: 1, pageSize: 15, status: 'ACTIVE' },
    { skip: !searchActive },
  );

  const recentCustomers = useMemo(() => getRecentCustomers(user?.id), [user?.id]);

  // Below the 2-character threshold: Walk-in + the last few customers
  // actually picked (no network call at all). At/above it: Walk-in + the
  // server's own search results (name / mobile / code — see
  // customer.routes.js's searchFields), capped at 15 by the query above and
  // with the reserved Walk-in row itself filtered out so it never appears
  // twice.
  const options = useMemo(() => {
    if (searchActive) {
      const rows = (customerPage?.rows || [])
        .filter((row) => row.code !== WALKIN_CODE)
        .map(toOption);
      return [WALK_IN_CUSTOMER, ...rows];
    }
    return [WALK_IN_CUSTOMER, ...recentCustomers];
  }, [searchActive, customerPage, recentCustomers]);

  // The field is always controlled directly by the parent's "customer" prop
  // (not looked up from "options") — the currently selected customer may
  // well not be present in whatever the last search/recent list happened to
  // contain, and still needs to display correctly.
  const mobileValue = customer?.phone && customer.phone !== '-' ? customer.phone : '';

  // Remember every registered customer actually selected (picked from
  // search, resumed from a held bill, or just created via Add Customer) as
  // a recent — Walk-in itself is excluded inside addRecentCustomer.
  useEffect(() => {
    if (customer?.id && customer.id !== WALK_IN_CUSTOMER.id) {
      addRecentCustomer(user?.id, customer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  let customerNoOptionsText = 'No matching customers';
  if (!searchActive) customerNoOptionsText = `Type at least ${MIN_SEARCH_CHARS} characters to search`;
  else if (customerSearchFailed) customerNoOptionsText = 'Couldn’t search customers — try again';

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, px: 2, py: 1.5 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 1.5,
        }}
      >
        <Autocomplete
          size="small"
          fullWidth
          options={options}
          value={customer || WALK_IN_CUSTOMER}
          loading={searchActive && isSearchingCustomers}
          loadingText="Searching customers…"
          noOptionsText={customerNoOptionsText}
          onChange={(_e, value) => {
            const next = value || WALK_IN_CUSTOMER;
            onSelectCustomer(next);
            // Show the picked name in the box afterward (like an
            // uncontrolled Autocomplete would) instead of leaving whatever
            // search text was last typed.
            setCustomerInput(next.id === WALK_IN_CUSTOMER.id ? '' : next.name);
          }}
          inputValue={customerInput}
          onInputChange={(_e, value, reason) => {
            if (reason === 'reset') return;
            setCustomerInput(value);
          }}
          getOptionLabel={(option) => option?.name || ''}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          // Server already did the filtering (search param) / this is
          // already a short, pre-picked local list (recent customers) — no
          // further client-side filtering on top of either.
          filterOptions={(opts) => opts}
          groupBy={(option) => {
            if (option.id === WALK_IN_CUSTOMER.id) return '';
            return searchActive ? 'Search results' : 'Recent';
          }}
          renderOption={(props, option) => {
            // MUI's Autocomplete puts a `key` field inside `props` itself
            // (separate from React's own key mechanism) — it must be pulled
            // out and passed explicitly rather than left inside the spread,
            // or option clicks can misbehave.
            const { key, ...optionProps } = props;
            return (
              <li key={key} {...optionProps}>
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Typography variant="body2" noWrap>{option.name}</Typography>
                  {option.id !== WALK_IN_CUSTOMER.id && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {[option.code, option.phone && option.phone !== '-' ? option.phone : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  )}
                </Box>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder="Search by name, mobile or code"
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps?.input,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <PersonOutlineOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                      {params.slotProps?.input?.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {searchActive && isSearchingCustomers ? (
                        <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} />
                      ) : null}
                      {params.slotProps?.input?.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
          sx={{ minWidth: 0 }}
        />

        <TextField
          size="small"
          fullWidth
          placeholder="Mobile Number"
          value={mobileValue}
          slotProps={{
            input: {
              readOnly: true,
              startAdornment: (
                <InputAdornment position="start">
                  <LocalPhoneOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  +91
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 0 }}
        />

        <Button
          variant="contained"
          onClick={onAddCustomer}
          sx={{ minWidth: 0 }}
        >
          Add Customer
        </Button>
      </Box>
    </Paper>
  );
}
