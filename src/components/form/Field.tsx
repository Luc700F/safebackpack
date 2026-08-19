'use client';

import { useId } from 'react';

import styles from './Field.module.css';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (ids: {
    controlId: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
}

/**
 * Label, hint and error around a control, wired together for screen readers.
 *
 * Every field in the product goes through this, so the association between a
 * message and the input it belongs to cannot be forgotten in one place and
 * remembered in another.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: FieldShellProps) {
  const controlId = useId();
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
        {optional && <span className={styles.optional}>optional</span>}
      </label>
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
      {children({ controlId, describedBy, invalid: Boolean(error) })}
      {error && (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export { styles as fieldStyles };
