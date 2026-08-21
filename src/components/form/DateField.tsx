'use client';

import { Field, fieldStyles as styles } from './Field';

interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD`, the only format a date input speaks. */
  value: string;
  onChange: (value: string) => void;
  /** Bounds, same format. The browser greys out everything outside them. */
  min?: string;
  max?: string;
  hint?: string;
  error?: string;
}

/**
 * A day, picked from the browser's own date control.
 *
 * Its own component rather than a `type` on `TextField`, because `min` and
 * `max` are the whole point here and mean nothing on a text box. Native rather
 * than a custom calendar: it is already translated, already reachable by
 * keyboard, and on a phone it opens the picker the traveller knows.
 */
export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  error,
}: DateFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ controlId, describedBy, invalid }) => (
        <input
          className={`${styles.control} ${invalid ? styles.controlInvalid : ''}`}
          id={controlId}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          min={min}
          max={max}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </Field>
  );
}
