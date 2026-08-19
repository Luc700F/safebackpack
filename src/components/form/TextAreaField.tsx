'use client';

import { Field, fieldStyles as styles } from './Field';

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  hint?: string;
  error?: string;
  placeholder?: string;
}

export function TextAreaField({
  label,
  value,
  onChange,
  maxLength,
  hint,
  error,
  placeholder,
}: TextAreaFieldProps) {
  const remaining = maxLength - value.length;

  return (
    <Field label={label} hint={hint} error={error}>
      {({ controlId, describedBy, invalid }) => (
        <>
          <textarea
            className={`${styles.control} ${styles.textarea} ${
              invalid ? styles.controlInvalid : ''
            }`}
            id={controlId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            placeholder={placeholder}
          />
          <span
            className={`${styles.counter} ${
              remaining < 0 ? styles.counterOver : ''
            }`}
            // Announced only when it starts to matter, not on every keystroke.
            aria-live={remaining < 0 ? 'polite' : 'off'}
          >
            {remaining} characters left
          </span>
        </>
      )}
    </Field>
  );
}
