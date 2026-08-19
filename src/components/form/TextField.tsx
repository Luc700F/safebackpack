'use client';

import { Field, fieldStyles as styles } from './Field';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'number';
  hint?: string;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'decimal';
  optional?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  error,
  placeholder,
  autoComplete,
  inputMode,
  optional,
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {({ controlId, describedBy, invalid }) => (
        <input
          className={`${styles.control} ${invalid ? styles.controlInvalid : ''}`}
          id={controlId}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
        />
      )}
    </Field>
  );
}
