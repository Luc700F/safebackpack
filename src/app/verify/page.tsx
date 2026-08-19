import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';

import styles from './page.module.css';
import { VerifyPanel } from './VerifyPanel';

export const metadata: Metadata = {
  title: 'Confirm your report',
  // A confirmation link is private; keep it out of search results.
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <Suspense fallback={<p className={styles.text}>Loading…</p>}>
          <VerifyPanel />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
