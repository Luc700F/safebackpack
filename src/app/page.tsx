import { Suspense } from 'react';

import { MapExplorer } from '@/components/map/MapExplorer';
import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';

import styles from './page.module.css';

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>Know the risks before you get there</h1>
          <p className={styles.lede}>
            Travellers report robberies, thefts, scams, harassment, natural
            hazards and unrest on a shared world map. Reports fade after a month
            unless other travellers confirm them, so what you see is current.
          </p>
        </section>

        <Suspense fallback={null}>
          <MapExplorer />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
