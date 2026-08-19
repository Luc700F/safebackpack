'use client';

import { Field, fieldStyles as styles } from './Field';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  placeholder?: string;
  hint?: string;
  error?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  error,
}: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ controlId, describedBy, invalid }) => (
        <select
          className={`${styles.control} ${invalid ? styles.controlInvalid : ''}`}
          id={controlId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
