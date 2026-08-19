import Link from 'next/link';

import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/">
        <span className={styles.mark} aria-hidden="true">
          sb
        </span>
        SafeBackpack
      </Link>
      <nav className={styles.actions} aria-label="Main">
        <Link className={styles.reportButton} href="/report">
          Report an incident
        </Link>
      </nav>
    </header>
  );
}
