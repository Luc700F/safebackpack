'use client';

import { useId } from 'react';

import styles from './Field.module.css';

export interface Choice {
  value: string;
  label: string;
  hint?: string;
  /** CSS custom property holding the colour shown beside the label. */
  colorToken?: string;
}

interface ChoiceFieldProps {
  legend: string;
  value: string;
  onChange: (value: string) => void;
  choices: readonly Choice[];
  error?: string;
}

/**
 * A radio group rendered as cards.
 *
 * Still a real `fieldset` with real radio inputs: keyboard users get arrow-key
 * navigation and screen readers announce "3 of 7" without any extra work.
 */
export function ChoiceField({
  legend,
  value,
  onChange,
  choices,
  error,
}: ChoiceFieldProps) {
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <div className={styles.field}>
      <fieldset
        className={styles.choices}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
      >
        <legend className={styles.label}>{legend}</legend>
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={`${styles.choice} ${
              value === choice.value ? styles.choiceSelected : ''
            }`}
          >
            <input
              className={styles.choiceInput}
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
            />
            <span className={styles.choiceText}>
              <span className={styles.choiceLabel}>
                {choice.colorToken && (
                  <span
                    className={styles.choiceSwatch}
                    style={
                      {
                        '--swatch-color': `var(${choice.colorToken})`,
                      } as React.CSSProperties
                    }
                    aria-hidden="true"
                  />
                )}
                {choice.label}
              </span>
              {choice.hint && (
                <span className={styles.choiceHint}>{choice.hint}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
