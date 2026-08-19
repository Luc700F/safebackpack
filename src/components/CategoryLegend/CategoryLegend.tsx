import { REPORT_CATEGORIES } from '@/lib/reports/categories';

import styles from './CategoryLegend.module.css';

/**
 * Colour key for the map. Reads straight from the category list, so adding a
 * category never means remembering to update the legend.
 */
export function CategoryLegend() {
  return (
    <ul className={styles.legend} aria-label="Report categories">
      {REPORT_CATEGORIES.map((category) => (
        <li key={category.id} className={styles.item}>
          <span
            className={styles.swatch}
            style={{ '--swatch-color': `var(${category.colorToken})` } as React.CSSProperties}
            aria-hidden="true"
          />
          {category.label}
        </li>
      ))}
    </ul>
  );
}
