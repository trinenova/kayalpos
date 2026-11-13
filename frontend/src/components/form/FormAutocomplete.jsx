import { Controller, useFormContext } from 'react-hook-form';
import { Autocomplete, TextField } from '@mui/material';

/**
 * React Hook Form <-> MUI Autocomplete bridge for long, searchable lists
 * (country / state / city). `options` is a plain string array; the field
 * value is the chosen string ('' when cleared). `onValueChange` lets a
 * parent reset dependent fields (e.g. clear City when State changes).
 */
export default function FormAutocomplete({
  name, label, options, onValueChange, placeholder, disabled = false,
}) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Autocomplete
          options={options}
          value={field.value || null}
          disabled={disabled}
          autoHighlight
          openOnFocus
          onBlur={field.onBlur}
          onChange={(_e, newValue) => {
            field.onChange(newValue || '');
            onValueChange?.(newValue || '');
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              placeholder={placeholder}
              error={Boolean(error)}
              helperText={error?.message}
            />
          )}
          noOptionsText="No matches"
        />
      )}
    />
  );
}
