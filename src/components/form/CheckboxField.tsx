'use client';

import { useId } from 'react';

import styles from './Field.module.css';

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

export function CheckboxField({
  label,
  checked,
  onChange,
  hint,
}: CheckboxFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={styles.field}>
      <label className={styles.checkbox} htmlFor={id}>
        <input
          className={styles.checkboxInput}
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={hint ? hintId : undefined}
        />
        <span>{label}</span>
      </label>
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
