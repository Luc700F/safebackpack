import type { Metadata } from 'next';

import { SiteHeader } from '@/components/SiteHeader/SiteHeader';

import { ModerationQueue } from './ModerationQueue';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Moderation',
  // Not for readers and not for search engines.
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Moderation</h1>
        <p className={styles.lede}>
          Reports the screening held back. Each one is invisible to everybody
          until it is decided here, so an untouched queue is reports nobody can
          read.
        </p>
        <ModerationQueue />
      </main>
    </>
  );
}
